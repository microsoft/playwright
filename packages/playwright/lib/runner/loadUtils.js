"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.collectProjectsAndTestFiles = collectProjectsAndTestFiles;
exports.createRootSuite = createRootSuite;
exports.loadFileSuites = loadFileSuites;
exports.loadGlobalHook = loadGlobalHook;
exports.loadReporter = loadReporter;
var _path = _interopRequireDefault(require("path"));
var _loaderHost = require("./loaderHost");
var _test = require("../common/test");
var _util = require("../util");
var _projectUtils = require("./projectUtils");
var _transform = require("../transform/transform");
var _suiteUtils = require("../common/suiteUtils");
var _testGroups = require("./testGroups");
var _compilationCache = require("../transform/compilationCache");
var _utilsBundle = require("../utilsBundle");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

async function collectProjectsAndTestFiles(testRun, doNotRunTestsOutsideProjectFilter, additionalFileMatcher) {
  const config = testRun.config;
  const fsCache = new Map();
  const sourceMapCache = new Map();
  const cliFileMatcher = config.cliArgs.length ? (0, _util.createFileMatcherFromArguments)(config.cliArgs) : null;

  // First collect all files for the projects in the command line, don't apply any file filters.
  const allFilesForProject = new Map();
  const filteredProjects = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
  for (const project of filteredProjects) {
    const files = await (0, _projectUtils.collectFilesForProject)(project, fsCache);
    allFilesForProject.set(project, files);
  }

  // Filter files based on the file filters, eliminate the empty projects.
  const filesToRunByProject = new Map();
  for (const [project, files] of allFilesForProject) {
    const matchedFiles = files.filter(file => {
      const hasMatchingSources = sourceMapSources(file, sourceMapCache).some(source => {
        if (additionalFileMatcher && !additionalFileMatcher(source)) return false;
        if (cliFileMatcher && !cliFileMatcher(source)) return false;
        return true;
      });
      return hasMatchingSources;
    });
    const filteredFiles = matchedFiles.filter(Boolean);
    filesToRunByProject.set(project, filteredFiles);
  }

  // (Re-)add all files for dependent projects, disregard filters.
  const projectClosure = (0, _projectUtils.buildProjectsClosure)([...filesToRunByProject.keys()]);
  for (const [project, type] of projectClosure) {
    if (type === 'dependency') {
      const treatProjectAsEmpty = doNotRunTestsOutsideProjectFilter && !filteredProjects.includes(project);
      const files = treatProjectAsEmpty ? [] : allFilesForProject.get(project) || (await (0, _projectUtils.collectFilesForProject)(project, fsCache));
      filesToRunByProject.set(project, files);
    }
  }
  testRun.projectFiles = filesToRunByProject;
  testRun.projectSuites = new Map();
}
async function loadFileSuites(testRun, mode, errors) {
  // Determine all files to load.
  const config = testRun.config;
  const allTestFiles = new Set();
  for (const files of testRun.projectFiles.values()) files.forEach(file => allTestFiles.add(file));

  // Load test files.
  const fileSuiteByFile = new Map();
  const loaderHost = mode === 'out-of-process' ? new _loaderHost.OutOfProcessLoaderHost(config) : new _loaderHost.InProcessLoaderHost(config);
  if (await loaderHost.start(errors)) {
    for (const file of allTestFiles) {
      const fileSuite = await loaderHost.loadTestFile(file, errors);
      fileSuiteByFile.set(file, fileSuite);
      errors.push(...createDuplicateTitlesErrors(config, fileSuite));
    }
    await loaderHost.stop();
  }

  // Check that no test file imports another test file.
  // Loader must be stopped first, since it populates the dependency tree.
  for (const file of allTestFiles) {
    for (const dependency of (0, _compilationCache.dependenciesForTestFile)(file)) {
      if (allTestFiles.has(dependency)) {
        const importer = _path.default.relative(config.config.rootDir, file);
        const importee = _path.default.relative(config.config.rootDir, dependency);
        errors.push({
          message: `Error: test file "${importer}" should not import test file "${importee}"`,
          location: {
            file,
            line: 1,
            column: 1
          }
        });
      }
    }
  }

  // Collect file suites for each project.
  for (const [project, files] of testRun.projectFiles) {
    const suites = files.map(file => fileSuiteByFile.get(file)).filter(Boolean);
    testRun.projectSuites.set(project, suites);
  }
}
async function createRootSuite(testRun, errors, shouldFilterOnly) {
  const config = testRun.config;
  // Create root suite, where each child will be a project suite with cloned file suites inside it.
  const rootSuite = new _test.Suite('', 'root');
  const projectSuites = new Map();
  const filteredProjectSuites = new Map();

  // Filter all the projects using grep, testId, file names.
  {
    // Interpret cli parameters.
    const cliFileFilters = (0, _util.createFileFiltersFromArguments)(config.cliArgs);
    const grepMatcher = config.cliGrep ? (0, _util.createTitleMatcher)((0, _util.forceRegExp)(config.cliGrep)) : () => true;
    const grepInvertMatcher = config.cliGrepInvert ? (0, _util.createTitleMatcher)((0, _util.forceRegExp)(config.cliGrepInvert)) : () => false;
    const cliTitleMatcher = title => !grepInvertMatcher(title) && grepMatcher(title);

    // Filter file suites for all projects.
    for (const [project, fileSuites] of testRun.projectSuites) {
      const projectSuite = createProjectSuite(project, fileSuites);
      projectSuites.set(project, projectSuite);
      const filteredProjectSuite = filterProjectSuite(projectSuite, {
        cliFileFilters,
        cliTitleMatcher,
        testIdMatcher: config.testIdMatcher
      });
      filteredProjectSuites.set(project, filteredProjectSuite);
    }
  }
  if (shouldFilterOnly) {
    // Create a fake root to execute the exclusive semantics across the projects.
    const filteredRoot = new _test.Suite('', 'root');
    for (const filteredProjectSuite of filteredProjectSuites.values()) filteredRoot._addSuite(filteredProjectSuite);
    (0, _suiteUtils.filterOnly)(filteredRoot);
    for (const [project, filteredProjectSuite] of filteredProjectSuites) {
      if (!filteredRoot.suites.includes(filteredProjectSuite)) filteredProjectSuites.delete(project);
    }
  }

  // Add post-filtered top-level projects to the root suite for sharding and 'only' processing.
  const projectClosure = (0, _projectUtils.buildProjectsClosure)([...filteredProjectSuites.keys()], project => filteredProjectSuites.get(project)._hasTests());
  for (const [project, type] of projectClosure) {
    if (type === 'top-level') {
      var _project$fullConfig$c;
      project.project.repeatEach = (_project$fullConfig$c = project.fullConfig.configCLIOverrides.repeatEach) !== null && _project$fullConfig$c !== void 0 ? _project$fullConfig$c : project.project.repeatEach;
      rootSuite._addSuite(buildProjectSuite(project, filteredProjectSuites.get(project)));
    }
  }

  // Complain about only.
  if (config.config.forbidOnly) {
    const onlyTestsAndSuites = rootSuite._getOnlyItems();
    if (onlyTestsAndSuites.length > 0) {
      const configFilePath = config.config.configFile ? _path.default.relative(config.config.rootDir, config.config.configFile) : undefined;
      errors.push(...createForbidOnlyErrors(onlyTestsAndSuites, config.configCLIOverrides.forbidOnly, configFilePath));
    }
  }

  // Shard only the top-level projects.
  if (config.config.shard) {
    // Create test groups for top-level projects.
    const testGroups = [];
    for (const projectSuite of rootSuite.suites) testGroups.push(...(0, _testGroups.createTestGroups)(projectSuite, config.config.workers));

    // Shard test groups.
    const testGroupsInThisShard = (0, _testGroups.filterForShard)(config.config.shard, testGroups);
    const testsInThisShard = new Set();
    for (const group of testGroupsInThisShard) {
      for (const test of group.tests) testsInThisShard.add(test);
    }

    // Update project suites, removing empty ones.
    (0, _suiteUtils.filterTestsRemoveEmptySuites)(rootSuite, test => testsInThisShard.has(test));
  }

  // Now prepend dependency projects without filtration.
  {
    // Filtering 'only' and sharding might have reduced the number of top-level projects.
    // Build the project closure to only include dependencies that are still needed.
    const projectClosure = new Map((0, _projectUtils.buildProjectsClosure)(rootSuite.suites.map(suite => suite._fullProject)));

    // Clone file suites for dependency projects.
    for (const project of projectClosure.keys()) {
      if (projectClosure.get(project) === 'dependency') rootSuite._prependSuite(buildProjectSuite(project, projectSuites.get(project)));
    }
  }
  return rootSuite;
}
function createProjectSuite(project, fileSuites) {
  const projectSuite = new _test.Suite(project.project.name, 'project');
  for (const fileSuite of fileSuites) projectSuite._addSuite((0, _suiteUtils.bindFileSuiteToProject)(project, fileSuite));
  const grepMatcher = (0, _util.createTitleMatcher)(project.project.grep);
  const grepInvertMatcher = project.project.grepInvert ? (0, _util.createTitleMatcher)(project.project.grepInvert) : null;
  (0, _suiteUtils.filterTestsRemoveEmptySuites)(projectSuite, test => {
    const grepTitle = test._grepTitle();
    if (grepInvertMatcher !== null && grepInvertMatcher !== void 0 && grepInvertMatcher(grepTitle)) return false;
    return grepMatcher(grepTitle);
  });
  return projectSuite;
}
function filterProjectSuite(projectSuite, options) {
  // Fast path.
  if (!options.cliFileFilters.length && !options.cliTitleMatcher && !options.testIdMatcher) return projectSuite;
  const result = projectSuite._deepClone();
  if (options.cliFileFilters.length) (0, _suiteUtils.filterByFocusedLine)(result, options.cliFileFilters);
  if (options.testIdMatcher) (0, _suiteUtils.filterByTestIds)(result, options.testIdMatcher);
  (0, _suiteUtils.filterTestsRemoveEmptySuites)(result, test => {
    if (options.cliTitleMatcher && !options.cliTitleMatcher(test._grepTitle())) return false;
    return true;
  });
  return result;
}
function buildProjectSuite(project, projectSuite) {
  const result = new _test.Suite(project.project.name, 'project');
  result._fullProject = project;
  if (project.fullyParallel) result._parallelMode = 'parallel';
  for (const fileSuite of projectSuite.suites) {
    // Fast path for the repeatEach = 0.
    result._addSuite(fileSuite);
    for (let repeatEachIndex = 1; repeatEachIndex < project.project.repeatEach; repeatEachIndex++) {
      const clone = fileSuite._deepClone();
      (0, _suiteUtils.applyRepeatEachIndex)(project, clone, repeatEachIndex);
      result._addSuite(clone);
    }
  }
  return result;
}
function createForbidOnlyErrors(onlyTestsAndSuites, forbidOnlyCLIFlag, configFilePath) {
  const errors = [];
  for (const testOrSuite of onlyTestsAndSuites) {
    // Skip root and file.
    const title = testOrSuite.titlePath().slice(2).join(' ');
    const configFilePathName = configFilePath ? `'${configFilePath}'` : 'the Playwright configuration file';
    const forbidOnlySource = forbidOnlyCLIFlag ? `'--forbid-only' CLI flag` : `'forbidOnly' option in ${configFilePathName}`;
    const error = {
      message: `Error: item focused with '.only' is not allowed due to the ${forbidOnlySource}: "${title}"`,
      location: testOrSuite.location
    };
    errors.push(error);
  }
  return errors;
}
function createDuplicateTitlesErrors(config, fileSuite) {
  const errors = [];
  const testsByFullTitle = new Map();
  for (const test of fileSuite.allTests()) {
    const fullTitle = test.titlePath().slice(1).join(' › ');
    const existingTest = testsByFullTitle.get(fullTitle);
    if (existingTest) {
      const error = {
        message: `Error: duplicate test title "${fullTitle}", first declared in ${buildItemLocation(config.config.rootDir, existingTest)}`,
        location: test.location
      };
      errors.push(error);
    }
    testsByFullTitle.set(fullTitle, test);
  }
  return errors;
}
function buildItemLocation(rootDir, testOrSuite) {
  if (!testOrSuite.location) return '';
  return `${_path.default.relative(rootDir, testOrSuite.location.file)}:${testOrSuite.location.line}`;
}
async function requireOrImportDefaultFunction(file, expectConstructor) {
  let func = await (0, _transform.requireOrImport)(file);
  if (func && typeof func === 'object' && 'default' in func) func = func['default'];
  if (typeof func !== 'function') throw (0, _util.errorWithFile)(file, `file must export a single ${expectConstructor ? 'class' : 'function'}.`);
  return func;
}
function loadGlobalHook(config, file) {
  return requireOrImportDefaultFunction(_path.default.resolve(config.config.rootDir, file), false);
}
function loadReporter(config, file) {
  return requireOrImportDefaultFunction(config ? _path.default.resolve(config.config.rootDir, file) : file, true);
}
function sourceMapSources(file, cache) {
  let sources = [file];
  if (!file.endsWith('.js')) return sources;
  if (cache.has(file)) return cache.get(file);
  try {
    const sourceMap = _utilsBundle.sourceMapSupport.retrieveSourceMap(file);
    const sourceMapData = typeof (sourceMap === null || sourceMap === void 0 ? void 0 : sourceMap.map) === 'string' ? JSON.parse(sourceMap.map) : sourceMap === null || sourceMap === void 0 ? void 0 : sourceMap.map;
    if (sourceMapData !== null && sourceMapData !== void 0 && sourceMapData.sources) sources = sourceMapData.sources.map(source => _path.default.resolve(_path.default.dirname(file), source));
  } finally {
    cache.set(file, sources);
    return sources;
  }
}
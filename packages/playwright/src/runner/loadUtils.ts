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

import path from 'path';
import type { FullConfig, Reporter, TestError } from '../../types/testReporter';
import { InProcessLoaderHost, OutOfProcessLoaderHost } from './loaderHost';
import { Suite } from '../common/test';
import type { TestCase } from '../common/test';
import type { FullProjectInternal } from '../common/config';
import type { FullConfigInternal } from '../common/config';
import { createFileMatcherFromArguments, createFileFiltersFromArguments, createTitleMatcher, errorWithFile, forceRegExp } from '../util';
import type { Matcher, TestFileFilter } from '../util';
import { buildProjectsClosure, collectFilesForProject, filterProjects } from './projectUtils';
import type { TestRun } from './tasks';
import { requireOrImport } from '../transform/transform';
import { applyRepeatEachIndex, bindFileSuiteToProject, filterByFocusedLine, filterByTestIds, filterOnly, filterTestsRemoveEmptySuites } from '../common/suiteUtils';
import { createTestGroups, filterForShard, type TestGroup } from './testGroups';
import { dependenciesForTestFile } from '../transform/compilationCache';
import { sourceMapSupport } from '../utilsBundle';
import type { RawSourceMap } from 'source-map';


export async function collectProjectsAndTestFiles(testRun: TestRun, doNotRunTestsOutsideProjectFilter: boolean) {
  const config = testRun.config;
  const fsCache = new Map();
  const sourceMapCache = new Map();
  const cliFileMatcher = config.cliArgs.length ? createFileMatcherFromArguments(config.cliArgs) : null;

  // First collect all files for the projects in the command line, don't apply any file filters.
  const allFilesForProject = new Map<FullProjectInternal, string[]>();
  const filteredProjects = filterProjects(config.projects, config.cliProjectFilter);
  for (const project of filteredProjects) {
    const files = await collectFilesForProject(project, fsCache);
    allFilesForProject.set(project, files);
  }

  // Filter files based on the file filters, eliminate the empty projects.
  const filesToRunByProject = new Map<FullProjectInternal, string[]>();
  for (const [project, files] of allFilesForProject) {
    const matchedFiles = files.filter(file => {
      const hasMatchingSources = sourceMapSources(file, sourceMapCache).some(source => {
        if (cliFileMatcher && !cliFileMatcher(source))
          return false;
        return true;
      });
      return hasMatchingSources;
    });
    const filteredFiles = matchedFiles.filter(Boolean) as string[];
    filesToRunByProject.set(project, filteredFiles);
  }

  // (Re-)add all files for dependent projects, disregard filters.
  const projectClosure = buildProjectsClosure([...filesToRunByProject.keys()]);
  for (const [project, type] of projectClosure) {
    if (type === 'dependency') {
      const treatProjectAsEmpty = doNotRunTestsOutsideProjectFilter && !filteredProjects.includes(project);
      const files = treatProjectAsEmpty ? [] : allFilesForProject.get(project) || await collectFilesForProject(project, fsCache);
      filesToRunByProject.set(project, files);
    }
  }

  testRun.projectFiles = filesToRunByProject;
  testRun.projectSuites = new Map();
}

export async function loadFileSuites(testRun: TestRun, mode: 'out-of-process' | 'in-process', errors: TestError[]) {
  // Determine all files to load.
  const config = testRun.config;
  const allTestFiles = new Set<string>();
  for (const files of testRun.projectFiles.values())
    files.forEach(file => allTestFiles.add(file));

  // Load test files.
  const fileSuiteByFile = new Map<string, Suite>();
  const loaderHost = mode === 'out-of-process' ? new OutOfProcessLoaderHost(config) : new InProcessLoaderHost(config);
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
    for (const dependency of dependenciesForTestFile(file)) {
      if (allTestFiles.has(dependency)) {
        const importer = path.relative(config.config.rootDir, file);
        const importee = path.relative(config.config.rootDir, dependency);
        errors.push({
          message: `Error: test file "${importer}" should not import test file "${importee}"`,
          location: { file, line: 1, column: 1 },
        });
      }
    }
  }

  // Collect file suites for each project.
  for (const [project, files] of testRun.projectFiles) {
    const suites = files.map(file => fileSuiteByFile.get(file)).filter(Boolean) as Suite[];
    testRun.projectSuites.set(project, suites);
  }
}

export async function createRootSuite(testRun: TestRun, errors: TestError[], shouldFilterOnly: boolean, additionalFileMatcher?: Matcher): Promise<Suite> {
  const config = testRun.config;
  // Create root suite, where each child will be a project suite with cloned file suites inside it.
  const rootSuite = new Suite('', 'root');
  const projectSuites = new Map<FullProjectInternal, Suite>();
  const filteredProjectSuites = new Map<FullProjectInternal, Suite>();

  // Filter all the projects using grep, testId, file names.
  {
    // Interpret cli parameters.
    const cliFileFilters = createFileFiltersFromArguments(config.cliArgs);
    const grepMatcher = config.cliGrep ? createTitleMatcher(forceRegExp(config.cliGrep)) : () => true;
    const grepInvertMatcher = config.cliGrepInvert ? createTitleMatcher(forceRegExp(config.cliGrepInvert)) : () => false;
    const cliTitleMatcher = (title: string) => !grepInvertMatcher(title) && grepMatcher(title);

    // Filter file suites for all projects.
    for (const [project, fileSuites] of testRun.projectSuites) {
      const projectSuite = createProjectSuite(project, fileSuites);
      projectSuites.set(project, projectSuite);

      const filteredProjectSuite = filterProjectSuite(projectSuite, { cliFileFilters, cliTitleMatcher, testIdMatcher: config.testIdMatcher, additionalFileMatcher });
      filteredProjectSuites.set(project, filteredProjectSuite);
    }
  }

  if (shouldFilterOnly) {
    // Create a fake root to execute the exclusive semantics across the projects.
    const filteredRoot = new Suite('', 'root');
    for (const filteredProjectSuite of filteredProjectSuites.values())
      filteredRoot._addSuite(filteredProjectSuite);
    filterOnly(filteredRoot);
    for (const [project, filteredProjectSuite] of filteredProjectSuites) {
      if (!filteredRoot.suites.includes(filteredProjectSuite))
        filteredProjectSuites.delete(project);
    }
  }

  // Add post-filtered top-level projects to the root suite for sharding and 'only' processing.
  const projectClosure = buildProjectsClosure([...filteredProjectSuites.keys()], project => filteredProjectSuites.get(project)!._hasTests());
  for (const [project, type] of projectClosure) {
    if (type === 'top-level') {
      project.project.repeatEach = project.fullConfig.configCLIOverrides.repeatEach ?? project.project.repeatEach;
      rootSuite._addSuite(buildProjectSuite(project, filteredProjectSuites.get(project)!));
    }
  }

  // Complain about only.
  if (config.config.forbidOnly) {
    const onlyTestsAndSuites = rootSuite._getOnlyItems();
    if (onlyTestsAndSuites.length > 0) {
      const configFilePath = config.config.configFile ? path.relative(config.config.rootDir, config.config.configFile) : undefined;
      errors.push(...createForbidOnlyErrors(onlyTestsAndSuites, config.configCLIOverrides.forbidOnly, configFilePath));
    }
  }

  // Shard only the top-level projects.
  if (config.config.shard) {
    // Create test groups for top-level projects.
    const testGroups: TestGroup[] = [];
    for (const projectSuite of rootSuite.suites)
      testGroups.push(...createTestGroups(projectSuite, config.config.workers));

    // Shard test groups.
    const testGroupsInThisShard = filterForShard(config.config.shard, testGroups);
    const testsInThisShard = new Set<TestCase>();
    for (const group of testGroupsInThisShard) {
      for (const test of group.tests)
        testsInThisShard.add(test);
    }

    // Update project suites, removing empty ones.
    filterTestsRemoveEmptySuites(rootSuite, test => testsInThisShard.has(test));
  }

  // Now prepend dependency projects without filtration.
  {
    // Filtering 'only' and sharding might have reduced the number of top-level projects.
    // Build the project closure to only include dependencies that are still needed.
    const projectClosure = new Map(buildProjectsClosure(rootSuite.suites.map(suite => suite._fullProject!)));

    // Clone file suites for dependency projects.
    for (const [project, level] of projectClosure.entries()) {
      if (level === 'dependency')
        rootSuite._prependSuite(buildProjectSuite(project, projectSuites.get(project)!));
    }
  }

  return rootSuite;
}

function createProjectSuite(project: FullProjectInternal, fileSuites: Suite[]): Suite {
  const projectSuite = new Suite(project.project.name, 'project');
  for (const fileSuite of fileSuites)
    projectSuite._addSuite(bindFileSuiteToProject(project, fileSuite));

  const grepMatcher = createTitleMatcher(project.project.grep);
  const grepInvertMatcher = project.project.grepInvert ? createTitleMatcher(project.project.grepInvert) : null;
  filterTestsRemoveEmptySuites(projectSuite, (test: TestCase) => {
    const grepTitle = test._grepTitle();
    if (grepInvertMatcher?.(grepTitle))
      return false;
    return grepMatcher(grepTitle);
  });
  return projectSuite;
}

function filterProjectSuite(projectSuite: Suite, options: { cliFileFilters: TestFileFilter[], cliTitleMatcher?: Matcher, testIdMatcher?: Matcher, additionalFileMatcher?: Matcher }): Suite {
  // Fast path.
  if (!options.cliFileFilters.length && !options.cliTitleMatcher && !options.testIdMatcher && !options.additionalFileMatcher)
    return projectSuite;

  const result = projectSuite._deepClone();
  if (options.cliFileFilters.length)
    filterByFocusedLine(result, options.cliFileFilters);
  if (options.testIdMatcher)
    filterByTestIds(result, options.testIdMatcher);
  filterTestsRemoveEmptySuites(result, (test: TestCase) => {
    if (options.cliTitleMatcher && !options.cliTitleMatcher(test._grepTitle()))
      return false;
    if (options.additionalFileMatcher && !options.additionalFileMatcher(test.location.file))
      return false;
    return true;
  });
  return result;
}

function buildProjectSuite(project: FullProjectInternal, projectSuite: Suite): Suite {
  const result = new Suite(project.project.name, 'project');
  result._fullProject = project;
  if (project.fullyParallel)
    result._parallelMode = 'parallel';

  for (const fileSuite of projectSuite.suites) {
    // Fast path for the repeatEach = 0.
    result._addSuite(fileSuite);

    for (let repeatEachIndex = 1; repeatEachIndex < project.project.repeatEach; repeatEachIndex++) {
      const clone = fileSuite._deepClone();
      applyRepeatEachIndex(project, clone, repeatEachIndex);
      result._addSuite(clone);
    }
  }
  return result;
}

function createForbidOnlyErrors(onlyTestsAndSuites: (TestCase | Suite)[], forbidOnlyCLIFlag: boolean | undefined, configFilePath: string | undefined): TestError[] {
  const errors: TestError[] = [];
  for (const testOrSuite of onlyTestsAndSuites) {
    // Skip root and file.
    const title = testOrSuite.titlePath().slice(2).join(' ');
    const configFilePathName = configFilePath ? `'${configFilePath}'` : 'the Playwright configuration file';
    const forbidOnlySource = forbidOnlyCLIFlag ? `'--forbid-only' CLI flag` : `'forbidOnly' option in ${configFilePathName}`;
    const error: TestError = {
      message: `Error: item focused with '.only' is not allowed due to the ${forbidOnlySource}: "${title}"`,
      location: testOrSuite.location!,
    };
    errors.push(error);
  }
  return errors;
}

function createDuplicateTitlesErrors(config: FullConfigInternal, fileSuite: Suite): TestError[] {
  const errors: TestError[] = [];
  const testsByFullTitle = new Map<string, TestCase>();
  for (const test of fileSuite.allTests()) {
    const fullTitle = test.titlePath().slice(1).join(' › ');
    const existingTest = testsByFullTitle.get(fullTitle);
    if (existingTest) {
      const error: TestError = {
        message: `Error: duplicate test title "${fullTitle}", first declared in ${buildItemLocation(config.config.rootDir, existingTest)}`,
        location: test.location,
      };
      errors.push(error);
    }
    testsByFullTitle.set(fullTitle, test);
  }
  return errors;
}

function buildItemLocation(rootDir: string, testOrSuite: Suite | TestCase) {
  if (!testOrSuite.location)
    return '';
  return `${path.relative(rootDir, testOrSuite.location.file)}:${testOrSuite.location.line}`;
}

async function requireOrImportDefaultFunction(file: string, expectConstructor: boolean) {
  let func = await requireOrImport(file);
  if (func && typeof func === 'object' && ('default' in func))
    func = func['default'];
  if (typeof func !== 'function')
    throw errorWithFile(file, `file must export a single ${expectConstructor ? 'class' : 'function'}.`);
  return func;
}

export function loadGlobalHook(config: FullConfigInternal, file: string): Promise<(config: FullConfig) => any> {
  return requireOrImportDefaultFunction(path.resolve(config.config.rootDir, file), false);
}

export function loadReporter(config: FullConfigInternal | null, file: string): Promise<new (arg?: any) => Reporter> {
  return requireOrImportDefaultFunction(config ? path.resolve(config.config.rootDir, file) : file, true);
}

function sourceMapSources(file: string, cache: Map<string, string[]>): string[] {
  let sources = [file];
  if (!file.endsWith('.js'))
    return sources;
  if (cache.has(file))
    return cache.get(file)!;

  try {
    const sourceMap = sourceMapSupport.retrieveSourceMap(file);
    const sourceMapData: RawSourceMap | undefined = typeof sourceMap?.map === 'string' ? JSON.parse(sourceMap.map) : sourceMap?.map;
    if (sourceMapData?.sources)
      sources = sourceMapData.sources.map(source => path.resolve(path.dirname(file), source));
  } finally {
    cache.set(file, sources);
    return sources;
  }
}

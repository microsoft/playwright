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
import { buildFileSuiteForProject, filterByFocusedLine, filterByTestIds, filterOnly, filterTestsRemoveEmptySuites } from '../common/suiteUtils';
import { createTestGroups, filterForShard, type TestGroup } from './testGroups';
import { dependenciesForTestFile } from '../transform/compilationCache';
import { sourceMapSupport } from '../utilsBundle';
import type { RawSourceMap } from 'source-map';

export async function collectProjectsAndTestFiles(testRun: TestRun, additionalFileMatcher: Matcher | undefined) {
  const config = testRun.config;
  const fsCache = new Map();
  const sourceMapCache = new Map();
  const cliFileMatcher = config.cliArgs.length ? createFileMatcherFromArguments(config.cliArgs) : null;

  // First collect all files for the projects in the command line, don't apply any file filters.
  const allFilesForProject = new Map<FullProjectInternal, string[]>();
  for (const project of filterProjects(config.projects, config.cliProjectFilter)) {
    const files = await collectFilesForProject(project, fsCache);
    allFilesForProject.set(project, files);
  }

  // Filter files based on the file filters, eliminate the empty projects.
  const filesToRunByProject = new Map<FullProjectInternal, string[]>();
  for (const [project, files] of allFilesForProject) {
    const matchedFiles = files.filter(file => {
      const hasMatchingSources = sourceMapSources(file, sourceMapCache).some(source => {
        if (additionalFileMatcher && !additionalFileMatcher(source))
          return false;
        if (cliFileMatcher && !cliFileMatcher(source))
          return false;
        return true;
      });
      return hasMatchingSources;
    });
    const filteredFiles = matchedFiles.filter(Boolean) as string[];
    if (filteredFiles.length)
      filesToRunByProject.set(project, filteredFiles);
  }

  // (Re-)add all files for dependent projects, disregard filters.
  const projectClosure = buildProjectsClosure([...filesToRunByProject.keys()]);
  for (const [project, type] of projectClosure) {
    if (type === 'dependency') {
      filesToRunByProject.delete(project);
      const files = allFilesForProject.get(project) || await collectFilesForProject(project, fsCache);
      filesToRunByProject.set(project, files);
    }
  }

  // Apply overrides that are only applicable to top-level projects.
  for (const [project, type] of projectClosure) {
    if (type === 'top-level')
      project.project.repeatEach = project.fullConfig.configCLIOverrides.repeatEach ?? project.project.repeatEach;
  }

  testRun.projects = [...filesToRunByProject.keys()];
  testRun.projectFiles = filesToRunByProject;
  testRun.projectType = projectClosure;
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
  for (const file of allTestFiles) {
    const fileSuite = await loaderHost.loadTestFile(file, errors);
    fileSuiteByFile.set(file, fileSuite);
    errors.push(...createDuplicateTitlesErrors(config, fileSuite));
  }
  await loaderHost.stop();

  // Check that no test file imports another test file.
  // Loader must be stopped first, since it popuplates the dependency tree.
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

export async function createRootSuite(testRun: TestRun, errors: TestError[], shouldFilterOnly: boolean): Promise<Suite> {
  const config = testRun.config;
  // Create root suite, where each child will be a project suite with cloned file suites inside it.
  const rootSuite = new Suite('', 'root');

  // First add top-level projects, so that we can filterOnly and shard just top-level.
  {
    // Interpret cli parameters.
    const cliFileFilters = createFileFiltersFromArguments(config.cliArgs);
    const grepMatcher = config.cliGrep ? createTitleMatcher(forceRegExp(config.cliGrep)) : () => true;
    const grepInvertMatcher = config.cliGrepInvert ? createTitleMatcher(forceRegExp(config.cliGrepInvert)) : () => false;
    const cliTitleMatcher = (title: string) => !grepInvertMatcher(title) && grepMatcher(title);

    // Clone file suites for top-level projects.
    for (const [project, fileSuites] of testRun.projectSuites) {
      if (testRun.projectType.get(project) === 'top-level')
        rootSuite._addSuite(await createProjectSuite(fileSuites, project, { cliFileFilters, cliTitleMatcher, testIdMatcher: config.testIdMatcher }));
    }
  }

  // Complain about only.
  if (config.config.forbidOnly) {
    const onlyTestsAndSuites = rootSuite._getOnlyItems();
    if (onlyTestsAndSuites.length > 0)
      errors.push(...createForbidOnlyErrors(onlyTestsAndSuites));
  }

  // Filter only for top-level projects.
  if (shouldFilterOnly)
    filterOnly(rootSuite);

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

  // Now prepend dependency projects.
  {
    // Filtering only and sharding might have reduced the number of top-level projects.
    // Build the project closure to only include dependencies that are still needed.
    const projectClosure = new Map(buildProjectsClosure(rootSuite.suites.map(suite => suite._fullProject!)));

    // Clone file suites for dependency projects.
    for (const [project, fileSuites] of testRun.projectSuites) {
      if (testRun.projectType.get(project) === 'dependency' && projectClosure.has(project))
        rootSuite._prependSuite(await createProjectSuite(fileSuites, project, { cliFileFilters: [], cliTitleMatcher: undefined }));
    }
  }

  return rootSuite;
}

async function createProjectSuite(fileSuites: Suite[], project: FullProjectInternal, options: { cliFileFilters: TestFileFilter[], cliTitleMatcher?: Matcher, testIdMatcher?: Matcher }): Promise<Suite> {
  const projectSuite = new Suite(project.project.name, 'project');
  projectSuite._fullProject = project;
  if (project.fullyParallel)
    projectSuite._parallelMode = 'parallel';
  for (const fileSuite of fileSuites) {
    for (let repeatEachIndex = 0; repeatEachIndex < project.project.repeatEach; repeatEachIndex++) {
      const builtSuite = buildFileSuiteForProject(project, fileSuite, repeatEachIndex);
      projectSuite._addSuite(builtSuite);
    }
  }

  filterByFocusedLine(projectSuite, options.cliFileFilters);
  filterByTestIds(projectSuite, options.testIdMatcher);

  const grepMatcher = createTitleMatcher(project.project.grep);
  const grepInvertMatcher = project.project.grepInvert ? createTitleMatcher(project.project.grepInvert) : null;

  const titleMatcher = (test: TestCase) => {
    const grepTitle = test.titlePath().join(' ');
    if (grepInvertMatcher?.(grepTitle))
      return false;
    return grepMatcher(grepTitle) && (!options.cliTitleMatcher || options.cliTitleMatcher(grepTitle));
  };

  filterTestsRemoveEmptySuites(projectSuite, titleMatcher);
  return projectSuite;
}

function createForbidOnlyErrors(onlyTestsAndSuites: (TestCase | Suite)[]): TestError[] {
  const errors: TestError[] = [];
  for (const testOrSuite of onlyTestsAndSuites) {
    // Skip root and file.
    const title = testOrSuite.titlePath().slice(2).join(' ');
    const error: TestError = {
      message: `Error: focused item found in the --forbid-only mode: "${title}"`,
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

export function loadReporter(config: FullConfigInternal, file: string): Promise<new (arg?: any) => Reporter> {
  return requireOrImportDefaultFunction(path.resolve(config.config.rootDir, file), true);
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

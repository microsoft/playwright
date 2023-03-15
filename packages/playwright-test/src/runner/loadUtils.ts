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

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import type { Reporter, TestError } from '../../types/testReporter';
import { InProcessLoaderHost, OutOfProcessLoaderHost } from './loaderHost';
import { Suite } from '../common/test';
import type { TestCase } from '../common/test';
import type { FullConfigInternal, FullProjectInternal } from '../common/types';
import { createFileMatcherFromArguments, createFileFiltersFromArguments, createTitleMatcher, errorWithFile, forceRegExp } from '../util';
import type { Matcher, TestFileFilter } from '../util';
import { buildProjectsClosure, collectFilesForProject, filterProjects } from './projectUtils';
import { requireOrImport } from '../common/transform';
import { buildFileSuiteForProject, filterByFocusedLine, filterByTestIds, filterOnly, filterTestsRemoveEmptySuites } from '../common/suiteUtils';
import { createTestGroups, filterForShard, type TestGroup } from './testGroups';
import { dependenciesForTestFile } from '../common/compilationCache';

export type ProjectWithTestGroups = {
  project: FullProjectInternal;
  projectSuite: Suite;
  testGroups: TestGroup[];
};

export async function collectProjectsAndTestFiles(config: FullConfigInternal, projectsToIgnore: Set<FullProjectInternal>, additionalFileMatcher: Matcher | undefined) {
  const fsCache = new Map();
  const sourceMapCache = new Map();
  const cliFileMatcher = config._internal.cliArgs.length ? createFileMatcherFromArguments(config._internal.cliArgs) : null;

  // First collect all files for the projects in the command line, don't apply any file filters.
  const allFilesForProject = new Map<FullProjectInternal, string[]>();
  for (const project of filterProjects(config.projects, config._internal.cliProjectFilter)) {
    if (projectsToIgnore.has(project))
      continue;
    const files = await collectFilesForProject(project, fsCache);
    allFilesForProject.set(project, files);
  }

  // Filter files based on the file filters, eliminate the empty projects.
  const filesToRunByProject = new Map<FullProjectInternal, string[]>();
  for (const [project, files] of allFilesForProject) {
    const matchedFiles = await Promise.all(files.map(async file => {
      if (additionalFileMatcher && !additionalFileMatcher(file))
        return;
      if (cliFileMatcher) {
        if (!cliFileMatcher(file) && !await isPotentiallyJavaScriptFileWithSourceMap(file, sourceMapCache))
          return;
      }
      return file;
    }));
    const filteredFiles = matchedFiles.filter(Boolean) as string[];
    if (filteredFiles.length)
      filesToRunByProject.set(project, filteredFiles);
  }

  // (Re-)add all files for dependent projects, disregard filters.
  const projectClosure = buildProjectsClosure([...filesToRunByProject.keys()]).filter(p => !projectsToIgnore.has(p));
  for (const project of projectClosure) {
    if (project._internal.type === 'dependency') {
      filesToRunByProject.delete(project);
      const files = allFilesForProject.get(project) || await collectFilesForProject(project, fsCache);
      filesToRunByProject.set(project, files);
    }
  }

  return filesToRunByProject;
}

export async function loadFileSuites(mode: 'out-of-process' | 'in-process', config: FullConfigInternal, filesToRunByProject: Map<FullProjectInternal, string[]>, errors: TestError[]): Promise<Map<FullProjectInternal, Suite[]>> {
  // Determine all files to load.
  const allTestFiles = new Set<string>();
  for (const files of filesToRunByProject.values())
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
        const importer = path.relative(config.rootDir, file);
        const importee = path.relative(config.rootDir, dependency);
        errors.push({
          message: `Error: test file "${importer}" should not import test file "${importee}"`,
          location: { file, line: 1, column: 1 },
        });
      }
    }
  }

  // Collect file suites for each project.
  const fileSuitesByProject = new Map<FullProjectInternal, Suite[]>();
  for (const [project, files] of filesToRunByProject) {
    const suites = files.map(file => fileSuiteByFile.get(file)).filter(Boolean) as Suite[];
    fileSuitesByProject.set(project, suites);
  }
  return fileSuitesByProject;
}

export async function createRootSuiteAndTestGroups(config: FullConfigInternal, fileSuitesByProject: Map<FullProjectInternal, Suite[]>, errors: TestError[], shouldFilterOnly: boolean): Promise<{ rootSuite: Suite, projectsWithTestGroups: ProjectWithTestGroups[] }> {
  // Create root suite, where each child will be a project suite with cloned file suites inside it.
  const rootSuite = new Suite('', 'root');

  // First add top-level projects, so that we can filterOnly and shard just top-level.
  {
    // Interpret cli parameters.
    const cliFileFilters = createFileFiltersFromArguments(config._internal.cliArgs);
    const grepMatcher = config._internal.cliGrep ? createTitleMatcher(forceRegExp(config._internal.cliGrep)) : () => true;
    const grepInvertMatcher = config._internal.cliGrepInvert ? createTitleMatcher(forceRegExp(config._internal.cliGrepInvert)) : () => false;
    const cliTitleMatcher = (title: string) => !grepInvertMatcher(title) && grepMatcher(title);

    // Clone file suites for top-level projects.
    for (const [project, fileSuites] of fileSuitesByProject) {
      if (project._internal.type === 'top-level')
        rootSuite._addSuite(await createProjectSuite(fileSuites, project, { cliFileFilters, cliTitleMatcher, testIdMatcher: config._internal.testIdMatcher }));
    }
  }

  // Complain about only.
  if (config.forbidOnly) {
    const onlyTestsAndSuites = rootSuite._getOnlyItems();
    if (onlyTestsAndSuites.length > 0)
      errors.push(...createForbidOnlyErrors(onlyTestsAndSuites));
  }

  // Filter only for top-level projects.
  if (shouldFilterOnly)
    filterOnly(rootSuite);

  // Create test groups for top-level projects.
  let projectsWithTestGroups: ProjectWithTestGroups[] = [];
  for (const projectSuite of rootSuite.suites) {
    const project = projectSuite.project() as FullProjectInternal;
    const testGroups = createTestGroups(projectSuite, config.workers);
    projectsWithTestGroups.push({ project, projectSuite, testGroups });
  }

  // Shard only the top-level projects.
  if (config.shard) {
    const allTestGroups: TestGroup[] = [];
    for (const { testGroups } of projectsWithTestGroups)
      allTestGroups.push(...testGroups);
    const shardedTestGroups = filterForShard(config.shard, allTestGroups);

    const shardedTests = new Set<TestCase>();
    for (const group of shardedTestGroups) {
      for (const test of group.tests)
        shardedTests.add(test);
    }

    // Update project suites and test groups.
    for (const p of projectsWithTestGroups) {
      p.testGroups = p.testGroups.filter(group => shardedTestGroups.has(group));
      filterTestsRemoveEmptySuites(p.projectSuite, test => shardedTests.has(test));
    }

    // Remove now-empty top-level projects.
    projectsWithTestGroups = projectsWithTestGroups.filter(p => p.testGroups.length > 0);
  }

  // Now prepend dependency projects.
  {
    // Filtering only and sharding might have reduced the number of top-level projects.
    // Build the project closure to only include dependencies that are still needed.
    const projectClosure = new Set(buildProjectsClosure(projectsWithTestGroups.map(p => p.project)));

    // Clone file suites for dependency projects.
    for (const [project, fileSuites] of fileSuitesByProject) {
      if (project._internal.type === 'dependency' && projectClosure.has(project)) {
        const projectSuite = await createProjectSuite(fileSuites, project, { cliFileFilters: [], cliTitleMatcher: undefined });
        rootSuite._prependSuite(projectSuite);
        const testGroups = createTestGroups(projectSuite, config.workers);
        projectsWithTestGroups.push({ project, projectSuite, testGroups });
      }
    }
  }

  return { rootSuite, projectsWithTestGroups };
}

async function createProjectSuite(fileSuites: Suite[], project: FullProjectInternal, options: { cliFileFilters: TestFileFilter[], cliTitleMatcher?: Matcher, testIdMatcher?: Matcher }): Promise<Suite> {
  const projectSuite = new Suite(project.name, 'project');
  projectSuite._projectConfig = project;
  if (project._internal.fullyParallel)
    projectSuite._parallelMode = 'parallel';
  for (const fileSuite of fileSuites) {
    for (let repeatEachIndex = 0; repeatEachIndex < project.repeatEach; repeatEachIndex++) {
      const builtSuite = buildFileSuiteForProject(project, fileSuite, repeatEachIndex);
      projectSuite._addSuite(builtSuite);
    }
  }

  filterByFocusedLine(projectSuite, options.cliFileFilters);
  filterByTestIds(projectSuite, options.testIdMatcher);

  const grepMatcher = createTitleMatcher(project.grep);
  const grepInvertMatcher = project.grepInvert ? createTitleMatcher(project.grepInvert) : null;

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
        message: `Error: duplicate test title "${fullTitle}", first declared in ${buildItemLocation(config.rootDir, existingTest)}`,
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

export function loadGlobalHook(config: FullConfigInternal, file: string): Promise<(config: FullConfigInternal) => any> {
  return requireOrImportDefaultFunction(path.resolve(config.rootDir, file), false);
}

export function loadReporter(config: FullConfigInternal, file: string): Promise<new (arg?: any) => Reporter> {
  return requireOrImportDefaultFunction(path.resolve(config.rootDir, file), true);
}

async function isPotentiallyJavaScriptFileWithSourceMap(file: string, cache: Map<string, boolean>): Promise<boolean> {
  if (!file.endsWith('.js'))
    return false;
  if (cache.has(file))
    return cache.get(file)!;

  try {
    const stream = fs.createReadStream(file);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let lastLine: string | undefined;
    rl.on('line', line => {
      lastLine = line;
    });
    await new Promise((fulfill, reject) => {
      rl.on('close', fulfill);
      rl.on('error', reject);
      stream.on('error', reject);
    });
    const hasSourceMap = !!lastLine && lastLine.startsWith('//# sourceMappingURL=');
    cache.set(file, hasSourceMap);
    return hasSourceMap;
  } catch (e) {
    cache.set(file, true);
    return true;
  }
}

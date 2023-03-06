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
import { filterForShard } from './testGroups';
import { dependenciesForTestFile } from '../common/compilationCache';

export async function loadAllTests(mode: 'out-of-process' | 'in-process', config: FullConfigInternal, projectsToIgnore: Set<FullProjectInternal>, additionalFileMatcher: Matcher | undefined, errors: TestError[], shouldFilterOnly: boolean): Promise<Suite> {
  const projects = filterProjects(config.projects, config._internal.cliProjectFilter);

  // Interpret cli parameters.
  const cliFileFilters = createFileFiltersFromArguments(config._internal.cliArgs);
  const grepMatcher = config._internal.cliGrep ? createTitleMatcher(forceRegExp(config._internal.cliGrep)) : () => true;
  const grepInvertMatcher = config._internal.cliGrepInvert ? createTitleMatcher(forceRegExp(config._internal.cliGrepInvert)) : () => false;
  const cliTitleMatcher = (title: string) => !grepInvertMatcher(title) && grepMatcher(title);
  const cliFileMatcher = config._internal.cliArgs.length ? createFileMatcherFromArguments(config._internal.cliArgs) : null;

  let filesToRunByProject = new Map<FullProjectInternal, string[]>();
  let topLevelProjects: FullProjectInternal[];
  let dependencyProjects: FullProjectInternal[];
  // Collect files, categorize top level and dependency projects.
  {
    const fsCache = new Map();
    const sourceMapCache = new Map();

    // First collect all files for the projects in the command line, don't apply any file filters.
    const allFilesForProject = new Map<FullProjectInternal, string[]>();
    for (const project of projects) {
      if (projectsToIgnore.has(project))
        continue;
      const files = await collectFilesForProject(project, fsCache);
      allFilesForProject.set(project, files);
    }

    // Filter files based on the file filters, eliminate the empty projects.
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

    const projectClosure = buildProjectsClosure([...filesToRunByProject.keys()]);
    // Remove files for dependency projects, they'll be added back later.
    for (const project of projectClosure.filter(p => p._internal.type === 'dependency'))
      filesToRunByProject.delete(project);

    // Shard only the top-level projects.
    if (config.shard)
      filesToRunByProject = filterForShard(config.shard, filesToRunByProject);

    // Re-build the closure, project set might have changed.
    const filteredProjectClosure = buildProjectsClosure([...filesToRunByProject.keys()]);
    topLevelProjects = filteredProjectClosure.filter(p => p._internal.type === 'top-level');
    dependencyProjects = filteredProjectClosure.filter(p => p._internal.type === 'dependency');

    topLevelProjects = topLevelProjects.filter(p => !projectsToIgnore.has(p));
    dependencyProjects = dependencyProjects.filter(p => !projectsToIgnore.has(p));

    // (Re-)add all files for dependent projects, disregard filters.
    for (const project of dependencyProjects) {
      const files = allFilesForProject.get(project) || await collectFilesForProject(project, fsCache);
      filesToRunByProject.set(project, files);
    }
  }

  // Load all test files and create a preprocessed root. Child suites are files there.
  const fileSuites: Suite[] = [];
  {
    const loaderHost = mode === 'out-of-process' ? new OutOfProcessLoaderHost(config) : new InProcessLoaderHost(config);
    const allTestFiles = new Set<string>();
    for (const files of filesToRunByProject.values())
      files.forEach(file => allTestFiles.add(file));
    for (const file of allTestFiles) {
      const fileSuite = await loaderHost.loadTestFile(file, errors);
      fileSuites.push(fileSuite);
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
  }

  // Complain about duplicate titles.
  errors.push(...createDuplicateTitlesErrors(config, fileSuites));

  // Create root suites with clones for the projects.
  const rootSuite = new Suite('', 'root');

  // First iterate leaf projects to focus only, then add all other projects.
  for (const project of topLevelProjects) {
    const projectSuite = await createProjectSuite(fileSuites, project, { cliFileFilters, cliTitleMatcher, testIdMatcher: config._internal.testIdMatcher }, filesToRunByProject.get(project)!);
    if (projectSuite)
      rootSuite._addSuite(projectSuite);
  }

  // Complain about only.
  if (config.forbidOnly) {
    const onlyTestsAndSuites = rootSuite._getOnlyItems();
    if (onlyTestsAndSuites.length > 0)
      errors.push(...createForbidOnlyErrors(onlyTestsAndSuites));
  }

  // Filter only for leaf projects.
  if (shouldFilterOnly)
    filterOnly(rootSuite);

  // Prepend the projects that are dependencies.
  for (const project of dependencyProjects) {
    const projectSuite = await createProjectSuite(fileSuites, project, { cliFileFilters: [], cliTitleMatcher: undefined }, filesToRunByProject.get(project)!);
    if (projectSuite)
      rootSuite._prependSuite(projectSuite);
  }

  return rootSuite;
}

async function createProjectSuite(fileSuits: Suite[], project: FullProjectInternal, options: { cliFileFilters: TestFileFilter[], cliTitleMatcher?: Matcher, testIdMatcher?: Matcher }, files: string[]): Promise<Suite | null> {
  const fileSuitesMap = new Map<string, Suite>();
  for (const fileSuite of fileSuits)
    fileSuitesMap.set(fileSuite._requireFile, fileSuite);

  const projectSuite = new Suite(project.name, 'project');
  projectSuite._projectConfig = project;
  if (project._internal.fullyParallel)
    projectSuite._parallelMode = 'parallel';
  for (const file of files) {
    const fileSuite = fileSuitesMap.get(file);
    if (!fileSuite)
      continue;
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

function createDuplicateTitlesErrors(config: FullConfigInternal, fileSuites: Suite[]): TestError[] {
  const errors: TestError[] = [];
  for (const fileSuite of fileSuites) {
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

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
import type { Reporter, TestError } from '../../types/testReporter';
import type { LoadError } from '../common/fixtures';
import { LoaderHost } from './loaderHost';
import type { Multiplexer } from '../reporters/multiplexer';
import { Suite } from '../common/test';
import type { TestCase } from '../common/test';
import { loadTestFilesInProcess } from '../common/testLoader';
import type { FullConfigInternal, FullProjectInternal } from '../common/types';
import { createFileMatcherFromFilters, createTitleMatcher, errorWithFile } from '../util';
import type { Matcher, TestFileFilter } from '../util';
import { collectFilesForProject, filterProjects, projectsThatAreDependencies } from './projectUtils';
import { requireOrImport } from '../common/transform';
import { serializeConfig } from '../common/ipc';
import { buildFileSuiteForProject, filterByFocusedLine, filterOnly, filterTestsRemoveEmptySuites } from '../common/suiteUtils';
import { filterForShard } from './testGroups';

type LoadOptions = {
  listOnly: boolean;
  testFileFilters: TestFileFilter[];
  testTitleMatcher?: Matcher;
  projectFilter?: string[];
  passWithNoTests?: boolean;
};

export async function loadAllTests(config: FullConfigInternal, reporter: Multiplexer, options: LoadOptions, errors: TestError[]): Promise<Suite> {
  const projects = filterProjects(config.projects, options.projectFilter);

  let filesToRunByProject = new Map<FullProjectInternal, string[]>();
  let topLevelProjects: FullProjectInternal[];
  let dependencyProjects: FullProjectInternal[];
  {
    // First collect all files for the projects in the command line, don't apply any file filters.
    const allFilesForProject = new Map<FullProjectInternal, string[]>();
    for (const project of projects) {
      const files = await collectFilesForProject(project);
      allFilesForProject.set(project, files);
    }

    // Filter files based on the file filters, eliminate the empty projects.
    const commandLineFileMatcher = options.testFileFilters.length ? createFileMatcherFromFilters(options.testFileFilters) : null;
    for (const [project, files] of allFilesForProject) {
      const filteredFiles = commandLineFileMatcher ? files.filter(commandLineFileMatcher) : files;
      if (filteredFiles.length)
        filesToRunByProject.set(project, filteredFiles);
    }
    // Remove dependency projects, they'll be added back later.
    for (const project of projectsThatAreDependencies([...filesToRunByProject.keys()]))
      filesToRunByProject.delete(project);

    // Shard only the top-level projects.
    if (config.shard)
      filesToRunByProject = filterForShard(config.shard, filesToRunByProject);

    // Re-build the closure, project set might have changed.
    topLevelProjects = [...filesToRunByProject.keys()];
    dependencyProjects = projectsThatAreDependencies(topLevelProjects);

    // (Re-)add all files for dependent projects, disregard filters.
    for (const project of dependencyProjects) {
      const files = allFilesForProject.get(project) || await collectFilesForProject(project);
      filesToRunByProject.set(project, files);
    }
  }

  // Load all test files and create a preprocessed root. Child suites are files there.
  const allTestFiles = new Set<string>();
  for (const files of filesToRunByProject.values())
    files.forEach(file => allTestFiles.add(file));
  const preprocessRoot = await loadTests(config, reporter, allTestFiles, errors);

  // Complain about duplicate titles.
  errors.push(...createDuplicateTitlesErrors(config, preprocessRoot));

  // Create root suites with clones for the projects.
  const rootSuite = new Suite('', 'root');

  // First iterate leaf projects to focus only, then add all other projects.
  for (const project of topLevelProjects) {
    const projectSuite = await createProjectSuite(preprocessRoot, project, options, filesToRunByProject.get(project)!);
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
  filterOnly(rootSuite);

  // Prepend the projects that are dependencies.
  for (const project of dependencyProjects) {
    const projectSuite = await createProjectSuite(preprocessRoot, project, { ...options, testFileFilters: [], testTitleMatcher: undefined }, filesToRunByProject.get(project)!);
    if (projectSuite)
      rootSuite._prependSuite(projectSuite);
  }

  return rootSuite;
}

async function createProjectSuite(preprocessRoot: Suite, project: FullProjectInternal, options: LoadOptions, files: string[]): Promise<Suite | null> {
  const fileSuites = new Map<string, Suite>();
  for (const fileSuite of preprocessRoot.suites)
    fileSuites.set(fileSuite._requireFile, fileSuite);

  const projectSuite = new Suite(project.name, 'project');
  projectSuite._projectConfig = project;
  if (project._fullyParallel)
    projectSuite._parallelMode = 'parallel';
  for (const file of files) {
    const fileSuite = fileSuites.get(file);
    if (!fileSuite)
      continue;
    for (let repeatEachIndex = 0; repeatEachIndex < project.repeatEach; repeatEachIndex++) {
      const builtSuite = buildFileSuiteForProject(project, fileSuite, repeatEachIndex);
      projectSuite._addSuite(builtSuite);
    }
  }
  // Filter tests to respect line/column filter.
  filterByFocusedLine(projectSuite, options.testFileFilters);

  const grepMatcher = createTitleMatcher(project.grep);
  const grepInvertMatcher = project.grepInvert ? createTitleMatcher(project.grepInvert) : null;

  const titleMatcher = (test: TestCase) => {
    const grepTitle = test.titlePath().join(' ');
    if (grepInvertMatcher?.(grepTitle))
      return false;
    return grepMatcher(grepTitle) && (!options.testTitleMatcher || options.testTitleMatcher(grepTitle));
  };

  if (filterTestsRemoveEmptySuites(projectSuite, titleMatcher))
    return projectSuite;
  return null;
}

async function loadTests(config: FullConfigInternal, reporter: Multiplexer, testFiles: Set<string>, errors: TestError[]): Promise<Suite> {
  if (process.env.PW_TEST_OOP_LOADER) {
    const loaderHost = new LoaderHost();
    await loaderHost.start(serializeConfig(config));
    try {
      return await loaderHost.loadTestFiles([...testFiles], reporter);
    } finally {
      await loaderHost.stop();
    }
  }
  const loadErrors: LoadError[] = [];
  try {
    return await loadTestFilesInProcess(config.rootDir, [...testFiles], loadErrors);
  } finally {
    errors.push(...loadErrors);
  }
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

function createDuplicateTitlesErrors(config: FullConfigInternal, rootSuite: Suite): TestError[] {
  const errors: TestError[] = [];
  for (const fileSuite of rootSuite.suites) {
    const testsByFullTitle = new Map<string, TestCase>();
    for (const test of fileSuite.allTests()) {
      const fullTitle = test.titlePath().slice(2).join(' › ');
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

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
import { promisify } from 'util';

import { ManualPromise } from '@isomorphic/manualPromise';
import { monotonicTime } from '@isomorphic/time';
import { removeFolders } from '@utils/fileUtils';

import { Dispatcher } from './dispatcher';
import { collectProjectsAndTestFiles, createRootSuite, loadFileSuites, loadGlobalHook, loadTestList } from './loadUtils';
import { buildDependentProjects, buildProjectsClosure, buildTeardownToSetupsMap, filterProjects } from './projectUtils';
import { applySuggestedRebaselines, clearSuggestedRebaselines } from './rebase';
import { TaskRunner } from './taskRunner';
import { detectChangedTestFiles } from './vcs';
import { cc, config as commonConfig, FullConfigInternal, suiteUtils, test as testNs } from '../common';
import { createTestGroups, shuffleTestGroups } from '../runner/testGroups';
import { createTitleMatcher, forceRegExp, removeDirAndLogToConsole } from '../util';
import { webServerPluginsForProject } from '../plugins/webServerPlugin';

import type { ProjectToRun } from './dispatcher';
import type { Task } from './taskRunner';
import type { FullResult, TestError } from '../../types/testReporter';
import type { Matcher, TestCaseFilter } from '../util';
import type { InternalReporter } from '../reporters/internalReporter';

const readDirAsync = promisify(fs.readdir);

export type TestRunOptions = {
  locations?: string[];
  grep?: string;
  grepInvert?: string;
  onlyChanged?: string;
  projectFilter?: string[];
  includeNonDefaultProjects?: boolean;
  listMode?: boolean;
  passWithNoTests?: boolean;
  lastFailed?: boolean;
  lastFailedFile?: string;
  testList?: string;
  testListInvert?: string;
  lastFailedTestIds?: string[];
  pauseOnError?: boolean;
  pauseAtEnd?: boolean;
  onTestPaused?: (params: TestPausedParams) => void;
  preserveOutputDir?: boolean;
  shardWeights?: number[];
};

export type TestPausedParams = {
  errors: TestError[];
  sendMessage: (params: { request: any }) => Promise<{ response: any, error?: TestError }>;
};

export class TestRun {
  readonly config: FullConfigInternal;
  readonly options: TestRunOptions;
  readonly reporter: InternalReporter;
  rootSuite: testNs.Suite | undefined = undefined;
  dispatcher: Dispatcher | undefined;
  readonly filteredProjects: commonConfig.FullProjectInternal[];
  projectFiles: Map<commonConfig.FullProjectInternal, string[]> = new Map();
  projectSuites: Map<commonConfig.FullProjectInternal, testNs.Suite[]> = new Map();
  topLevelProjects: commonConfig.FullProjectInternal[] = [];
  hasWorkerErrors = false;
  failedTestCount = 0;
  testCountBeforeSharding = 0;
  readonly loadFileFilters: Matcher[] = [];
  readonly preOnlyTestFilters: TestCaseFilter[] = [];
  readonly postShardTestFilters: TestCaseFilter[] = [];

  constructor(config: FullConfigInternal, reporter: InternalReporter, options?: TestRunOptions) {
    this.config = config;
    this.options = options ?? {};
    this.reporter = reporter;
    this.filteredProjects = filterProjects(config.projects, this.options.projectFilter, this.options.includeNonDefaultProjects);
    config.config.filteredProjects = this.filteredProjects.map(p => p.project);
  }

  onTestPaused(params: TestPausedParams) {
    this.options.onTestPaused?.(params);
  }

  hasReachedMaxFailures() {
    const max = this.config.config.maxFailures;
    return max > 0 && this.failedTestCount >= max;
  }

  result(): 'failed' | 'passed' {
    const hasFailedTests = this.rootSuite?.allTests().some(test => !test.ok());
    const hasFlakyTests = this.rootSuite?.allTests().some(test => test.outcome() === 'flaky');
    return this.hasWorkerErrors || this.reporter.hasReporterErrors() || this.hasReachedMaxFailures() || hasFailedTests || (this.config.config.failOnFlakyTests && hasFlakyTests) ? 'failed' : 'passed';
  }
}

export async function runTasks(testRun: TestRun, tasks: Task<TestRun>[], globalTimeout?: number, cancelPromise?: ManualPromise<void>) {
  const deadline = globalTimeout ? monotonicTime() + globalTimeout : 0;
  const taskRunner = new TaskRunner<TestRun>(testRun.reporter, globalTimeout || 0);
  for (const task of tasks)
    taskRunner.addTask(task);
  testRun.reporter.onConfigure(testRun.config.config);
  const status = await taskRunner.run(testRun, deadline, cancelPromise);
  return await finishTaskRun(testRun, status);
}

export async function runTasksDeferCleanup(testRun: TestRun, tasks: Task<TestRun>[]) {
  const taskRunner = new TaskRunner<TestRun>(testRun.reporter, 0);
  for (const task of tasks)
    taskRunner.addTask(task);
  testRun.reporter.onConfigure(testRun.config.config);
  const { status, cleanup } = await taskRunner.runDeferCleanup(testRun, 0);
  return { status: await finishTaskRun(testRun, status), cleanup };
}

async function finishTaskRun(testRun: TestRun, status: FullResult['status']) {
  if (status === 'passed')
    status = testRun.result();
  const modifiedResult = await testRun.reporter.onEnd({ status });
  if (modifiedResult && modifiedResult.status)
    status = modifiedResult.status;
  await testRun.reporter.onExit();
  // A reporter may have thrown during onEnd/onExit (or earlier), which is not
  // reflected in testRun.result() computed above. Fail the run in that case.
  if (status === 'passed' && testRun.reporter.hasReporterErrors())
    status = 'failed';
  return status;
}

export function createGlobalSetupTasks(config: FullConfigInternal) {
  return [
    createRemoveOutputDirsTask(),
    ...createPluginSetupTasks(config),
    ...config.globalTeardowns.map(file => createGlobalTeardownTask(file, config)).reverse(),
    ...config.globalSetups.map(file => createGlobalSetupTask(file, config)),
    ...createProjectWebServerSetupTasks(config),
  ];
}

export function createRunTestsTasks(config: FullConfigInternal) {
  return [
    createDispatcherTask(),
    createReportBeginTask(),
    createRunTestsTask(),
  ];
}

function createProjectWebServerSetupTasks(config: FullConfigInternal): Task<TestRun>[] {
  return config.projects.flatMap(project => webServerPluginsForProject(project.project).map(plugin => {
    let started = false;
    return {
      title: 'project web server setup',
      setup: async ({ filteredProjects, reporter }) => {
        const projects = buildProjectsClosure(filteredProjects);
        if (!projects.has(project))
          return;
        started = true;
        await plugin.setup?.(config.config, config.configDir, reporter);
      },
      teardown: async () => {
        if (started)
          await plugin.teardown?.();
      },
    };
  }));
}

export function createClearCacheTask(config: FullConfigInternal): Task<TestRun> {
  return {
    title: 'clear cache',
    setup: async () => {
      await removeDirAndLogToConsole(cc.cacheDir);
    },
  };
}

export function createReportBeginTask(): Task<TestRun> {
  return {
    title: 'report begin',
    setup: async testRun => {
      testRun.reporter.onBegin?.(testRun.rootSuite!);
    },
    teardown: async ({}) => {},
  };
}

export function createPluginSetupTasks(config: FullConfigInternal): Task<TestRun>[] {
  return config.plugins.map(plugin => ({
    title: 'plugin setup',
    setup: async ({ reporter }) => {
      if (typeof plugin.factory === 'function')
        plugin.instance = await plugin.factory();
      else
        plugin.instance = plugin.factory;
      await plugin.instance?.setup?.(config.config, config.configDir, reporter);
    },
    teardown: async () => {
      await plugin.instance?.teardown?.();
    },
  }));
}

function createGlobalSetupTask(file: string, config: FullConfigInternal): Task<TestRun> {
  let title = 'global setup';
  if (config.globalSetups.length > 1)
    title += ` (${file})`;

  let globalSetupResult: any;
  return {
    title,
    setup: async ({ config }) => {
      const setupHook = await loadGlobalHook(config, file);
      globalSetupResult = await setupHook(config.config);
    },
    teardown: async () => {
      if (typeof globalSetupResult === 'function')
        await globalSetupResult();
    },
  };
}

function createGlobalTeardownTask(file: string, config: FullConfigInternal): Task<TestRun> {
  let title = 'global teardown';
  if (config.globalTeardowns.length > 1)
    title += ` (${file})`;

  return {
    title,
    teardown: async ({ config }) => {
      const teardownHook = await loadGlobalHook(config, file);
      await teardownHook(config.config);
    },
  };
}

function createRemoveOutputDirsTask(): Task<TestRun> {
  return {
    title: 'clear output',
    setup: async testRun => {
      if (testRun.options.preserveOutputDir)
        return;
      const outputDirs = new Set<string>();
      testRun.filteredProjects.forEach(p => outputDirs.add(p.project.outputDir));

      await Promise.all(Array.from(outputDirs).map(outputDir => removeFolders([outputDir]).then(async ([error]) => {
        if (!error)
          return;
        if ((error as any).code === 'EBUSY') {
          // We failed to remove folder, might be due to the whole folder being mounted inside a container:
          //   https://github.com/microsoft/playwright/issues/12106
          // Do a best-effort to remove all files inside of it instead.
          const entries = await readDirAsync(outputDir).catch(e => []);
          await Promise.all(entries.map(entry => removeFolders([path.join(outputDir, entry)])));
        } else {
          throw error;
        }
      })));
    },
  };
}

export function createListFilesTask(): Task<TestRun> {
  return {
    title: 'load tests',
    setup: async (testRun, errors) => {
      await createRootSuite(testRun, errors, false);
      await collectProjectsAndTestFiles(testRun, false);
      for (const [project, files] of testRun.projectFiles) {
        const projectSuite = new testNs.Suite(project.project.name, 'project');
        projectSuite._fullProject = project;
        testRun.rootSuite!._addSuite(projectSuite);
        const suites = files.map(file => {
          const title = path.relative(testRun.config.config.rootDir, file);
          const suite =  new testNs.Suite(title, 'file');
          suite.location = { file, line: 0, column: 0 };
          projectSuite._addSuite(suite);
          return suite;
        });
        testRun.projectSuites.set(project, suites);
      }
    },
  };
}

export function createLoadTask(mode: 'out-of-process' | 'in-process', options: { filterOnly: boolean, failOnLoadErrors: boolean, doNotRunDepsOutsideProjectFilter?: boolean }): Task<TestRun> {
  return {
    title: 'load tests',
    setup: async (testRun, errors, softErrors) => {
      if (testRun.options.locations?.length) {
        const { testFilter, fileFilter } = suiteUtils.createFiltersFromArguments(testRun.options.locations);
        testRun.loadFileFilters.push(fileFilter);
        testRun.preOnlyTestFilters.push(testFilter);
      }

      if (testRun.options.testList) {
        const { testFilter, fileFilter } = await loadTestList(testRun.config, testRun.options.testList);
        testRun.preOnlyTestFilters.push(testFilter);
        testRun.loadFileFilters.push(fileFilter);
      }

      if (testRun.options.testListInvert) {
        // Note: invert list does not mean we can filter files. For example, the following invert list
        // can still run tests from foo.spec.ts:
        //
        // foo.spec.ts > some test
        const { testFilter } = await loadTestList(testRun.config, testRun.options.testListInvert);
        testRun.preOnlyTestFilters.push(test => !testFilter(test));
      }

      if (testRun.options.grep || testRun.options.grepInvert) {
        const grepMatcher = testRun.options.grep ? createTitleMatcher(forceRegExp(testRun.options.grep)) : () => true;
        const grepInvertMatcher = testRun.options.grepInvert ? createTitleMatcher(forceRegExp(testRun.options.grepInvert)) : () => false;
        testRun.preOnlyTestFilters.push(test => {
          const grepTitle = test._grepTitleWithTags();
          return !grepInvertMatcher(grepTitle) && grepMatcher(grepTitle);
        });
      }

      if (testRun.options.lastFailedTestIds) {
        const failedTestIds = new Set(testRun.options.lastFailedTestIds);
        testRun.postShardTestFilters.push(test => failedTestIds.has(test.id));
      }

      await collectProjectsAndTestFiles(testRun, !!options.doNotRunDepsOutsideProjectFilter);
      await loadFileSuites(testRun, mode, options.failOnLoadErrors ? errors : softErrors);

      if (testRun.options.onlyChanged) {
        const changedFiles = await detectChangedTestFiles(testRun.options.onlyChanged, testRun.config.configDir);
        testRun.preOnlyTestFilters.push(test => changedFiles.has(test.location.file));
      }

      await createRootSuite(testRun, options.failOnLoadErrors ? errors : softErrors, !!options.filterOnly);
      // Fail when no tests.
      const testCount = testRun.config.config.shard ? testRun.testCountBeforeSharding : testRun.rootSuite?.allTests().length;
      if (options.failOnLoadErrors && !testCount
          && !testRun.options.passWithNoTests
          && !testRun.options.onlyChanged
          && !testRun.options.testList && !testRun.options.testListInvert) {
        if (testRun.options.locations?.length) {
          throw new Error([
            `No tests found.`,
            `Make sure that arguments are regular expressions matching test files.`,
            `You may need to escape symbols like "$" or "*" and quote the arguments.`,
          ].join('\n'));
        }
        throw new Error(`No tests found`);
      }
    },
  };
}

export function createApplyRebaselinesTask(): Task<TestRun> {
  return {
    title: 'apply rebaselines',
    setup: async () => {
      clearSuggestedRebaselines();
    },
    teardown: async testRun => {
      await applySuggestedRebaselines(testRun.config, testRun.reporter, testRun.filteredProjects);
    },
  };
}

function createDispatcherTask(): Task<TestRun> {
  return {
    title: 'create dispatcher',
    setup: async testRun => {
      const projectToSuite = new Map(testRun.rootSuite!.suites.map(suite => [suite._fullProject!, suite]));
      const allProjects = [...projectToSuite.keys()];
      const teardownToSetups = buildTeardownToSetupsMap(allProjects);

      // Each project starts as soon as all the projects it runs after have finished.
      const projectsToRun: ProjectToRun[] = [];
      for (const [project, projectSuite] of projectToSuite) {
        const setups = teardownToSetups.get(project) || [];
        // Teardown runs after its setups and all the projects that depend on these setups.
        const setupsDependents = buildDependentProjects(setups, allProjects);
        setupsDependents.delete(project);
        const testGroups = createTestGroups(projectSuite, testRun.config.config.workers);
        // Shuffle each project separately, so that the order does not depend on which projects start together.
        if (testRun.config.configCLIOverrides.shuffle)
          shuffleTestGroups(testGroups, testRun.config.configCLIOverrides.shuffle);
        projectsToRun.push({
          project,
          projectSuite,
          testGroups,
          runAfter: [...new Set([...project.deps, ...setupsDependents])],
          inheritEnvFrom: [...project.deps, ...setups],
          ignoreMaxFailures: !!setups.length,
        });
      }
      testRun.dispatcher = new Dispatcher(testRun, projectsToRun);

      testRun.config.config.metadata.actualWorkers = maxConcurrentTestGroups(projectsToRun, testRun.config.config.workers);
      if (testRun.config.configCLIOverrides.shuffle)
        testRun.config.config.metadata.shuffleSeed = testRun.config.configCLIOverrides.shuffle;
    },
  };
}

// Estimates the largest number of test groups that run at the same time, up to the number of workers.
// Starts the projects one by one, and assumes that each project keeps running until
// some project that runs after it starts.
function maxConcurrentTestGroups(projectsToRun: ProjectToRun[], workers: number): number {
  const testGroups = new Map(projectsToRun.map(p => [p.project, Math.min(p.project.workers ?? workers, p.testGroups.length)]));
  const countTestGroups = (projects: Iterable<commonConfig.FullProjectInternal>) => [...projects].reduce((sum, project) => sum + (testGroups.get(project) ?? 0), 0);
  const pending = new Map(projectsToRun.map(p => [p.project, p]));
  const running = new Set<commonConfig.FullProjectInternal>();
  let max = 0;
  while (pending.size) {
    // Out of the projects that can start now, pick the one that adds the most test groups.
    let next: ProjectToRun | undefined;
    let nextChange = 0;
    for (const p of pending.values()) {
      if (p.runAfter.some(project => pending.has(project)))
        continue;
      const change = countTestGroups([p.project]) - countTestGroups(p.runAfter.filter(project => running.has(project)));
      if (!next || change > nextChange) {
        next = p;
        nextChange = change;
      }
    }
    if (!next)
      break;
    pending.delete(next.project);
    for (const project of next.runAfter)
      running.delete(project);
    running.add(next.project);
    max = Math.max(max, countTestGroups(running));
  }
  return Math.min(workers, max);
}

function createRunTestsTask(): Task<TestRun> {
  return {
    title: 'test suite',
    setup: async ({ dispatcher }) => {
      await dispatcher!.run();
      await dispatcher!.stop();
    },
    teardown: async ({ dispatcher }) => {
      await dispatcher?.stop();
    },
  };
}

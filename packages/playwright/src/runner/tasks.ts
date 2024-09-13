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
import { debug } from 'playwright-core/lib/utilsBundle';
import { type ManualPromise, monotonicTime, removeFolders } from 'playwright-core/lib/utils';
import { Dispatcher, type EnvByProjectId } from './dispatcher';
import type { TestRunnerPluginRegistration } from '../plugins';
import { createTestGroups, type TestGroup } from '../runner/testGroups';
import type { Task } from './taskRunner';
import { TaskRunner } from './taskRunner';
import type { FullConfigInternal, FullProjectInternal } from '../common/config';
import { collectProjectsAndTestFiles, createRootSuite, loadFileSuites, loadGlobalHook } from './loadUtils';
import { removeDirAndLogToConsole, type Matcher } from '../util';
import { Suite } from '../common/test';
import { buildDependentProjects, buildTeardownToSetupsMap, filterProjects } from './projectUtils';
import { FailureTracker } from './failureTracker';
import { detectChangedTestFiles } from './vcs';
import type { InternalReporter } from '../reporters/internalReporter';
import { cacheDir } from '../transform/compilationCache';
import type { FullResult } from '../../types/testReporter';

const readDirAsync = promisify(fs.readdir);

type ProjectWithTestGroups = {
  project: FullProjectInternal;
  projectSuite: Suite;
  testGroups: TestGroup[];
};

type Phase = {
  dispatcher: Dispatcher,
  projects: ProjectWithTestGroups[]
};

export class TestRun {
  readonly config: FullConfigInternal;
  readonly reporter: InternalReporter;
  readonly failureTracker: FailureTracker;
  rootSuite: Suite | undefined = undefined;
  readonly phases: Phase[] = [];
  projectFiles: Map<FullProjectInternal, string[]> = new Map();
  projectSuites: Map<FullProjectInternal, Suite[]> = new Map();

  constructor(config: FullConfigInternal, reporter: InternalReporter) {
    this.config = config;
    this.reporter = reporter;
    this.failureTracker = new FailureTracker(config);
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
    status = testRun.failureTracker.result();
  const modifiedResult = await testRun.reporter.onEnd({ status });
  if (modifiedResult && modifiedResult.status)
    status = modifiedResult.status;
  await testRun.reporter.onExit();
  return status;
}

export function createGlobalSetupTasks(config: FullConfigInternal) {
  const tasks: Task<TestRun>[] = [];
  if (!config.configCLIOverrides.preserveOutputDir && !process.env.PW_TEST_NO_REMOVE_OUTPUT_DIRS)
    tasks.push(createRemoveOutputDirsTask());
  tasks.push(...createPluginSetupTasks(config));
  if (config.config.globalSetup || config.config.globalTeardown)
    tasks.push(createGlobalSetupTask());
  return tasks;
}

export function createRunTestsTasks(config: FullConfigInternal) {
  return [
    createPhasesTask(),
    createReportBeginTask(),
    ...config.plugins.map(plugin => createPluginBeginTask(plugin)),
    createRunTestsTask(),
  ];
}

export function createClearCacheTask(config: FullConfigInternal): Task<TestRun> {
  return {
    title: 'clear cache',
    setup: async () => {
      await removeDirAndLogToConsole(cacheDir);
      for (const plugin of config.plugins)
        await plugin.instance?.clearCache?.();
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

function createPluginBeginTask(plugin: TestRunnerPluginRegistration): Task<TestRun> {
  return {
    title: 'plugin begin',
    setup: async testRun => {
      await plugin.instance?.begin?.(testRun.rootSuite!);
    },
    teardown: async () => {
      await plugin.instance?.end?.();
    },
  };
}

function createGlobalSetupTask(): Task<TestRun> {
  let globalSetupResult: any;
  let globalSetupFinished = false;
  let teardownHook: any;
  return {
    title: 'global setup',
    setup: async ({ config }) => {
      const setupHook = config.config.globalSetup ? await loadGlobalHook(config, config.config.globalSetup) : undefined;
      teardownHook = config.config.globalTeardown ? await loadGlobalHook(config, config.config.globalTeardown) : undefined;
      globalSetupResult = setupHook ? await setupHook(config.config) : undefined;
      globalSetupFinished = true;
    },
    teardown: async ({ config }) => {
      if (typeof globalSetupResult === 'function')
        await globalSetupResult();
      if (globalSetupFinished)
        await teardownHook?.(config.config);
    },
  };
}

function createRemoveOutputDirsTask(): Task<TestRun> {
  return {
    title: 'clear output',
    setup: async ({ config }) => {
      const outputDirs = new Set<string>();
      const projects = filterProjects(config.projects, config.cliProjectFilter);
      projects.forEach(p => outputDirs.add(p.project.outputDir));

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
      testRun.rootSuite = await createRootSuite(testRun, errors, false);
      testRun.failureTracker.onRootSuite(testRun.rootSuite);
      await collectProjectsAndTestFiles(testRun, false);
      for (const [project, files] of testRun.projectFiles) {
        const projectSuite = new Suite(project.project.name, 'project');
        projectSuite._fullProject = project;
        testRun.rootSuite._addSuite(projectSuite);
        const suites = files.map(file => {
          const title = path.relative(testRun.config.config.rootDir, file);
          const suite =  new Suite(title, 'file');
          suite.location = { file, line: 0, column: 0 };
          projectSuite._addSuite(suite);
          return suite;
        });
        testRun.projectSuites.set(project, suites);
      }
    },
  };
}

export function createLoadTask(mode: 'out-of-process' | 'in-process', options: { filterOnly: boolean, failOnLoadErrors: boolean, doNotRunDepsOutsideProjectFilter?: boolean, populateDependencies?: boolean }): Task<TestRun> {
  return {
    title: 'load tests',
    setup: async (testRun, errors, softErrors) => {
      await collectProjectsAndTestFiles(testRun, !!options.doNotRunDepsOutsideProjectFilter);
      await loadFileSuites(testRun, mode, options.failOnLoadErrors ? errors : softErrors);

      if (testRun.config.cliOnlyChanged || options.populateDependencies) {
        for (const plugin of testRun.config.plugins)
          await plugin.instance?.populateDependencies?.();
      }

      let cliOnlyChangedMatcher: Matcher | undefined = undefined;
      if (testRun.config.cliOnlyChanged) {
        const changedFiles = await detectChangedTestFiles(testRun.config.cliOnlyChanged, testRun.config.configDir);
        cliOnlyChangedMatcher = file => changedFiles.has(file);
      }

      testRun.rootSuite = await createRootSuite(testRun, options.failOnLoadErrors ? errors : softErrors, !!options.filterOnly, cliOnlyChangedMatcher);
      testRun.failureTracker.onRootSuite(testRun.rootSuite);
      // Fail when no tests.
      if (options.failOnLoadErrors && !testRun.rootSuite.allTests().length && !testRun.config.cliPassWithNoTests && !testRun.config.config.shard && !testRun.config.cliOnlyChanged) {
        if (testRun.config.cliArgs.length) {
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

function createPhasesTask(): Task<TestRun> {
  return {
    title: 'create phases',
    setup: async testRun => {
      let maxConcurrentTestGroups = 0;

      const processed = new Set<FullProjectInternal>();
      const projectToSuite = new Map(testRun.rootSuite!.suites.map(suite => [suite._fullProject!, suite]));
      const allProjects = [...projectToSuite.keys()];
      const teardownToSetups = buildTeardownToSetupsMap(allProjects);
      const teardownToSetupsDependents = new Map<FullProjectInternal, FullProjectInternal[]>();
      for (const [teardown, setups] of teardownToSetups) {
        const closure = buildDependentProjects(setups, allProjects);
        closure.delete(teardown);
        teardownToSetupsDependents.set(teardown, [...closure]);
      }

      for (let i = 0; i < projectToSuite.size; i++) {
        // Find all projects that have all their dependencies processed by previous phases.
        const phaseProjects: FullProjectInternal[] = [];
        for (const project of projectToSuite.keys()) {
          if (processed.has(project))
            continue;
          const projectsThatShouldFinishFirst = [...project.deps, ...(teardownToSetupsDependents.get(project) || [])];
          if (projectsThatShouldFinishFirst.find(p => !processed.has(p)))
            continue;
          phaseProjects.push(project);
        }

        // Create a new phase.
        for (const project of phaseProjects)
          processed.add(project);
        if (phaseProjects.length) {
          let testGroupsInPhase = 0;
          const phase: Phase = { dispatcher: new Dispatcher(testRun.config, testRun.reporter, testRun.failureTracker), projects: [] };
          testRun.phases.push(phase);
          for (const project of phaseProjects) {
            const projectSuite = projectToSuite.get(project)!;
            const testGroups = createTestGroups(projectSuite, testRun.config.config.workers);
            phase.projects.push({ project, projectSuite, testGroups });
            testGroupsInPhase += testGroups.length;
          }
          debug('pw:test:task')(`created phase #${testRun.phases.length} with ${phase.projects.map(p => p.project.project.name).sort()} projects, ${testGroupsInPhase} testGroups`);
          maxConcurrentTestGroups = Math.max(maxConcurrentTestGroups, testGroupsInPhase);
        }
      }

      testRun.config.config.metadata.actualWorkers = Math.min(testRun.config.config.workers, maxConcurrentTestGroups);
    },
  };
}

function createRunTestsTask(): Task<TestRun> {
  return {
    title: 'test suite',
    setup: async ({ phases, failureTracker }) => {
      const successfulProjects = new Set<FullProjectInternal>();
      const extraEnvByProjectId: EnvByProjectId = new Map();
      const teardownToSetups = buildTeardownToSetupsMap(phases.map(phase => phase.projects.map(p => p.project)).flat());

      for (const { dispatcher, projects } of phases) {
        // Each phase contains dispatcher and a set of test groups.
        // We don't want to run the test groups belonging to the projects
        // that depend on the projects that failed previously.
        const phaseTestGroups: TestGroup[] = [];
        for (const { project, testGroups } of projects) {
          // Inherit extra environment variables from dependencies.
          let extraEnv: Record<string, string | undefined> = {};
          for (const dep of project.deps)
            extraEnv = { ...extraEnv, ...extraEnvByProjectId.get(dep.id) };
          for (const setup of teardownToSetups.get(project) || [])
            extraEnv = { ...extraEnv, ...extraEnvByProjectId.get(setup.id) };
          extraEnvByProjectId.set(project.id, extraEnv);

          const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
          if (!hasFailedDeps)
            phaseTestGroups.push(...testGroups);
        }

        if (phaseTestGroups.length) {
          await dispatcher!.run(phaseTestGroups, extraEnvByProjectId);
          await dispatcher.stop();
          for (const [projectId, envProduced] of dispatcher.producedEnvByProjectId()) {
            const extraEnv = extraEnvByProjectId.get(projectId) || {};
            extraEnvByProjectId.set(projectId, { ...extraEnv, ...envProduced });
          }
        }

        // If the worker broke, fail everything, we have no way of knowing which
        // projects failed.
        if (!failureTracker.hasWorkerErrors()) {
          for (const { project, projectSuite } of projects) {
            const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
            if (!hasFailedDeps && !projectSuite.allTests().some(test => !test.ok()))
              successfulProjects.add(project);
          }
        }
      }
    },
    teardown: async ({ phases }) => {
      for (const { dispatcher } of phases.reverse())
        await dispatcher.stop();
    },
  };
}

export function createStartDevServerTask(): Task<TestRun> {
  return {
    title: 'start dev server',
    setup: async ({ config }, errors, softErrors) => {
      if (config.plugins.some(plugin => !!plugin.devServerCleanup)) {
        errors.push({ message: `DevServer is already running` });
        return;
      }
      for (const plugin of config.plugins)
        plugin.devServerCleanup = await plugin.instance?.startDevServer?.();
      if (!config.plugins.some(plugin => !!plugin.devServerCleanup))
        errors.push({ message: `DevServer is not available in the package you are using. Did you mean to use component testing?` });
    },

    teardown: async ({ config }) => {
      for (const plugin of config.plugins) {
        await plugin.devServerCleanup?.();
        plugin.devServerCleanup = undefined;
      }
    },
  };
}

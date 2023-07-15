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
import { debug, rimraf } from 'playwright-core/lib/utilsBundle';
import { Dispatcher, type EnvByProjectId } from './dispatcher';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { ReporterV2 } from '../reporters/reporterV2';
import { createTestGroups, type TestGroup } from '../runner/testGroups';
import type { Task } from './taskRunner';
import { TaskRunner } from './taskRunner';
import type { FullConfigInternal, FullProjectInternal } from '../common/config';
import { collectProjectsAndTestFiles, createRootSuite, loadFileSuites, loadGlobalHook } from './loadUtils';
import type { Matcher } from '../util';
import type { Suite } from '../common/test';
import { buildDependentProjects, buildTeardownToSetupsMap } from './projectUtils';
import { monotonicTime } from 'playwright-core/lib/utils';

const removeFolderAsync = promisify(rimraf);
const readDirAsync = promisify(fs.readdir);

type ProjectWithTestGroups = {
  project: FullProjectInternal;
  projectSuite: Suite;
  testGroups: TestGroup[];
};

export type Phase = {
  dispatcher: Dispatcher,
  projects: ProjectWithTestGroups[]
};

export class TestRun {
  readonly reporter: ReporterV2;
  readonly config: FullConfigInternal;
  rootSuite: Suite | undefined = undefined;
  readonly phases: Phase[] = [];
  projects: FullProjectInternal[] = [];
  projectFiles: Map<FullProjectInternal, string[]> = new Map();
  projectSuites: Map<FullProjectInternal, Suite[]> = new Map();

  constructor(config: FullConfigInternal, reporter: ReporterV2) {
    this.config = config;
    this.reporter = reporter;
  }
}

export function createTaskRunner(config: FullConfigInternal, reporter: ReporterV2): TaskRunner<TestRun> {
  const taskRunner = new TaskRunner<TestRun>(reporter, config.config.globalTimeout);
  addGlobalSetupTasks(taskRunner, config);
  taskRunner.addTask('load tests', createLoadTask('in-process', { filterOnly: true, failOnLoadErrors: true }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForWatchSetup(config: FullConfigInternal, reporter: ReporterV2): TaskRunner<TestRun> {
  const taskRunner = new TaskRunner<TestRun>(reporter, 0);
  addGlobalSetupTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForWatch(config: FullConfigInternal, reporter: ReporterV2, additionalFileMatcher?: Matcher): TaskRunner<TestRun> {
  const taskRunner = new TaskRunner<TestRun>(reporter, 0);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', { filterOnly: true, failOnLoadErrors: false, doNotRunTestsOutsideProjectFilter: true, additionalFileMatcher }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

function addGlobalSetupTasks(taskRunner: TaskRunner<TestRun>, config: FullConfigInternal) {
  for (const plugin of config.plugins)
    taskRunner.addTask('plugin setup', createPluginSetupTask(plugin));
  if (config.config.globalSetup || config.config.globalTeardown)
    taskRunner.addTask('global setup', createGlobalSetupTask());
  taskRunner.addTask('clear output', createRemoveOutputDirsTask());
}

function addRunTasks(taskRunner: TaskRunner<TestRun>, config: FullConfigInternal) {
  taskRunner.addTask('create phases', createPhasesTask());
  taskRunner.addTask('report begin', createReportBeginTask());
  for (const plugin of config.plugins)
    taskRunner.addTask('plugin begin', createPluginBeginTask(plugin));
  taskRunner.addTask('start workers', createWorkersTask());
  taskRunner.addTask('test suite', createRunTestsTask());
  return taskRunner;
}

export function createTaskRunnerForList(config: FullConfigInternal, reporter: ReporterV2, mode: 'in-process' | 'out-of-process', options: { failOnLoadErrors: boolean }): TaskRunner<TestRun> {
  const taskRunner = new TaskRunner<TestRun>(reporter, config.config.globalTimeout);
  taskRunner.addTask('load tests', createLoadTask(mode, { ...options, filterOnly: false }));
  taskRunner.addTask('report begin', createReportBeginTask());
  return taskRunner;
}

function createReportBeginTask(): Task<TestRun> {
  return async ({ config, reporter, rootSuite }) => {
    const montonicStartTime = monotonicTime();
    reporter.onBegin(rootSuite!);
    return async () => {
      config.config.metadata.totalTime = monotonicTime() - montonicStartTime;
    };
  };
}

function createPluginSetupTask(plugin: TestRunnerPluginRegistration): Task<TestRun> {
  return async ({ config, reporter }) => {
    if (typeof plugin.factory === 'function')
      plugin.instance = await plugin.factory();
    else
      plugin.instance = plugin.factory;
    await plugin.instance?.setup?.(config.config, config.configDir, reporter);
    return () => plugin.instance?.teardown?.();
  };
}

function createPluginBeginTask(plugin: TestRunnerPluginRegistration): Task<TestRun> {
  return async ({ rootSuite }) => {
    await plugin.instance?.begin?.(rootSuite!);
    return () => plugin.instance?.end?.();
  };
}

function createGlobalSetupTask(): Task<TestRun> {
  return async ({ config }) => {
    const setupHook = config.config.globalSetup ? await loadGlobalHook(config, config.config.globalSetup) : undefined;
    const teardownHook = config.config.globalTeardown ? await loadGlobalHook(config, config.config.globalTeardown) : undefined;
    const globalSetupResult = setupHook ? await setupHook(config.config) : undefined;
    return async () => {
      if (typeof globalSetupResult === 'function')
        await globalSetupResult();
      await teardownHook?.(config.config);
    };
  };
}

function createRemoveOutputDirsTask(): Task<TestRun> {
  return async ({ config }) => {
    if (process.env.PW_TEST_NO_REMOVE_OUTPUT_DIRS)
      return;
    const outputDirs = new Set<string>();
    for (const p of config.projects) {
      if (!config.cliProjectFilter || config.cliProjectFilter.includes(p.project.name))
        outputDirs.add(p.project.outputDir);
    }

    await Promise.all(Array.from(outputDirs).map(outputDir => removeFolderAsync(outputDir).catch(async (error: any) => {
      if ((error as any).code === 'EBUSY') {
        // We failed to remove folder, might be due to the whole folder being mounted inside a container:
        //   https://github.com/microsoft/playwright/issues/12106
        // Do a best-effort to remove all files inside of it instead.
        const entries = await readDirAsync(outputDir).catch(e => []);
        await Promise.all(entries.map(entry => removeFolderAsync(path.join(outputDir, entry))));
      } else {
        throw error;
      }
    })));
  };
}

function createLoadTask(mode: 'out-of-process' | 'in-process', options: { filterOnly: boolean, failOnLoadErrors: boolean, doNotRunTestsOutsideProjectFilter?: boolean, additionalFileMatcher?: Matcher }): Task<TestRun> {
  return async (testRun, errors, softErrors) => {
    await collectProjectsAndTestFiles(testRun, !!options.doNotRunTestsOutsideProjectFilter, options.additionalFileMatcher);
    await loadFileSuites(testRun, mode, options.failOnLoadErrors ? errors : softErrors);
    testRun.rootSuite = await createRootSuite(testRun, options.failOnLoadErrors ? errors : softErrors, !!options.filterOnly);
    // Fail when no tests.
    if (options.failOnLoadErrors && !testRun.rootSuite.allTests().length && !testRun.config.cliPassWithNoTests && !testRun.config.config.shard)
      throw new Error(`No tests found`);
  };
}

function createPhasesTask(): Task<TestRun> {
  return async testRun => {
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
        const phase: Phase = { dispatcher: new Dispatcher(testRun.config, testRun.reporter), projects: [] };
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
  };
}

function createWorkersTask(): Task<TestRun> {
  return async ({ phases }) => {
    return async () => {
      for (const { dispatcher } of phases.reverse())
        await dispatcher.stop();
    };
  };
}

function createRunTestsTask(): Task<TestRun> {
  return async testRun => {
    const { phases } = testRun;
    const successfulProjects = new Set<FullProjectInternal>();
    const extraEnvByProjectId: EnvByProjectId = new Map();
    const teardownToSetups = buildTeardownToSetupsMap(phases.map(phase => phase.projects.map(p => p.project)).flat());

    for (const { dispatcher, projects } of phases) {
      // Each phase contains dispatcher and a set of test groups.
      // We don't want to run the test groups beloning to the projects
      // that depend on the projects that failed previously.
      const phaseTestGroups: TestGroup[] = [];
      for (const { project, testGroups } of projects) {
        // Inherit extra enviroment variables from dependencies.
        let extraEnv: Record<string, string | undefined> = {};
        for (const dep of project.deps)
          extraEnv = { ...extraEnv, ...extraEnvByProjectId.get(dep.id) };
        for (const setup of teardownToSetups.get(project) || [])
          extraEnv = { ...extraEnv, ...extraEnvByProjectId.get(setup.id) };
        extraEnvByProjectId.set(project.id, extraEnv);

        const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
        if (!hasFailedDeps) {
          phaseTestGroups.push(...testGroups);
        } else {
          for (const testGroup of testGroups) {
            for (const test of testGroup.tests)
              test._appendTestResult().status = 'skipped';
          }
        }
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
      if (!dispatcher.hasWorkerErrors()) {
        for (const { project, projectSuite } of projects) {
          const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
          if (!hasFailedDeps && !projectSuite.allTests().some(test => !test.ok()))
            successfulProjects.add(project);
        }
      }
    }
  };
}

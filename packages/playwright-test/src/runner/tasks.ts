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
import type { Multiplexer } from '../reporters/multiplexer';
import { createTestGroups, type TestGroup } from '../runner/testGroups';
import type { Task } from './taskRunner';
import { TaskRunner } from './taskRunner';
import type { Suite } from '../common/test';
import type { FullConfigInternal, FullProjectInternal } from '../common/types';
import { collectProjectsAndTestFiles, createRootSuite, loadFileSuites, loadGlobalHook } from './loadUtils';
import type { Matcher } from '../util';

const removeFolderAsync = promisify(rimraf);
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

export type TaskRunnerState = {
  reporter: Multiplexer;
  config: FullConfigInternal;
  rootSuite?: Suite;
  phases: Phase[];
};

export function createTaskRunner(config: FullConfigInternal, reporter: Multiplexer): TaskRunner<TaskRunnerState> {
  const taskRunner = new TaskRunner<TaskRunnerState>(reporter, config.globalTimeout);
  addGlobalSetupTasks(taskRunner, config);
  taskRunner.addTask('load tests', createLoadTask('in-process', true));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForWatchSetup(config: FullConfigInternal, reporter: Multiplexer): TaskRunner<TaskRunnerState> {
  const taskRunner = new TaskRunner<TaskRunnerState>(reporter, 0);
  addGlobalSetupTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForWatch(config: FullConfigInternal, reporter: Multiplexer, projectsToIgnore?: Set<FullProjectInternal>, additionalFileMatcher?: Matcher): TaskRunner<TaskRunnerState> {
  const taskRunner = new TaskRunner<TaskRunnerState>(reporter, 0);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', true, projectsToIgnore, additionalFileMatcher));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

function addGlobalSetupTasks(taskRunner: TaskRunner<TaskRunnerState>, config: FullConfigInternal) {
  for (const plugin of config._internal.plugins)
    taskRunner.addTask('plugin setup', createPluginSetupTask(plugin));
  if (config.globalSetup || config.globalTeardown)
    taskRunner.addTask('global setup', createGlobalSetupTask());
  taskRunner.addTask('clear output', createRemoveOutputDirsTask());
}

function addRunTasks(taskRunner: TaskRunner<TaskRunnerState>, config: FullConfigInternal) {
  taskRunner.addTask('create phases', createPhasesTask());
  taskRunner.addTask('report begin', async ({ reporter, rootSuite }) => {
    reporter.onBegin?.(config, rootSuite!);
    return () => reporter.onEnd();
  });
  for (const plugin of config._internal.plugins)
    taskRunner.addTask('plugin begin', createPluginBeginTask(plugin));
  taskRunner.addTask('start workers', createWorkersTask());
  taskRunner.addTask('test suite', createRunTestsTask());
  return taskRunner;
}

export function createTaskRunnerForList(config: FullConfigInternal, reporter: Multiplexer, mode: 'in-process' | 'out-of-process'): TaskRunner<TaskRunnerState> {
  const taskRunner = new TaskRunner<TaskRunnerState>(reporter, config.globalTimeout);
  taskRunner.addTask('load tests', createLoadTask(mode, false));
  taskRunner.addTask('report begin', async ({ reporter, rootSuite }) => {
    reporter.onBegin?.(config, rootSuite!);
    return () => reporter.onEnd();
  });
  return taskRunner;
}

function createPluginSetupTask(plugin: TestRunnerPluginRegistration): Task<TaskRunnerState> {
  return async ({ config, reporter }) => {
    if (typeof plugin.factory === 'function')
      plugin.instance = await plugin.factory();
    else
      plugin.instance = plugin.factory;
    await plugin.instance?.setup?.(config, config._internal.configDir, reporter);
    return () => plugin.instance?.teardown?.();
  };
}

function createPluginBeginTask(plugin: TestRunnerPluginRegistration): Task<TaskRunnerState> {
  return async ({ rootSuite }) => {
    await plugin.instance?.begin?.(rootSuite!);
    return () => plugin.instance?.end?.();
  };
}

function createGlobalSetupTask(): Task<TaskRunnerState> {
  return async ({ config }) => {
    const setupHook = config.globalSetup ? await loadGlobalHook(config, config.globalSetup) : undefined;
    const teardownHook = config.globalTeardown ? await loadGlobalHook(config, config.globalTeardown) : undefined;
    const globalSetupResult = setupHook ? await setupHook(config) : undefined;
    return async () => {
      if (typeof globalSetupResult === 'function')
        await globalSetupResult();
      await teardownHook?.(config);
    };
  };
}

function createRemoveOutputDirsTask(): Task<TaskRunnerState> {
  return async ({ config }) => {
    const outputDirs = new Set<string>();
    for (const p of config.projects) {
      if (!config._internal.cliProjectFilter || config._internal.cliProjectFilter.includes(p.name))
        outputDirs.add(p.outputDir);
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

function createLoadTask(mode: 'out-of-process' | 'in-process', shouldFilterOnly: boolean, projectsToIgnore = new Set<FullProjectInternal>(), additionalFileMatcher?: Matcher): Task<TaskRunnerState> {
  return async (context, errors) => {
    const { config } = context;
    const filesToRunByProject = await collectProjectsAndTestFiles(config, projectsToIgnore, additionalFileMatcher);
    const fileSuitesByProject = await loadFileSuites(mode, config, filesToRunByProject, errors);
    context.rootSuite = await createRootSuite(config, fileSuitesByProject, errors, shouldFilterOnly);
    // Fail when no tests.
    if (!context.rootSuite.allTests().length && !config._internal.passWithNoTests && !config.shard)
      throw new Error(`No tests found`);
  };
}

function createPhasesTask(): Task<TaskRunnerState> {
  return async context => {
    context.config._internal.maxConcurrentTestGroups = 0;

    const processed = new Set<FullProjectInternal>();
    const projectToSuite = new Map(context.rootSuite!.suites.map(suite => [suite.project() as FullProjectInternal, suite]));
    for (let i = 0; i < projectToSuite.size; i++) {
      // Find all projects that have all their dependencies processed by previous phases.
      const phaseProjects: FullProjectInternal[] = [];
      for (const project of projectToSuite.keys()) {
        if (processed.has(project))
          continue;
        if (project._internal.deps.find(p => !processed.has(p)))
          continue;
        phaseProjects.push(project);
      }

      // Create a new phase.
      for (const project of phaseProjects)
        processed.add(project);
      if (phaseProjects.length) {
        let testGroupsInPhase = 0;
        const phase: Phase = { dispatcher: new Dispatcher(context.config, context.reporter), projects: [] };
        context.phases.push(phase);
        for (const project of phaseProjects) {
          const projectSuite = projectToSuite.get(project)!;
          const testGroups = createTestGroups(projectSuite, context.config.workers);
          phase.projects.push({ project, projectSuite, testGroups });
          testGroupsInPhase += testGroups.length;
        }
        debug('pw:test:task')(`created phase #${context.phases.length} with ${phase.projects.map(p => p.project.name).sort()} projects, ${testGroupsInPhase} testGroups`);
        context.config._internal.maxConcurrentTestGroups = Math.max(context.config._internal.maxConcurrentTestGroups, testGroupsInPhase);
      }
    }
  };
}

function createWorkersTask(): Task<TaskRunnerState> {
  return async ({ phases }) => {
    return async () => {
      for (const { dispatcher } of phases.reverse())
        await dispatcher.stop();
    };
  };
}

function createRunTestsTask(): Task<TaskRunnerState> {
  return async context => {
    const { phases } = context;
    const successfulProjects = new Set<FullProjectInternal>();
    const extraEnvByProjectId: EnvByProjectId = new Map();

    for (const { dispatcher, projects } of phases) {
      // Each phase contains dispatcher and a set of test groups.
      // We don't want to run the test groups beloning to the projects
      // that depend on the projects that failed previously.
      const phaseTestGroups: TestGroup[] = [];
      for (const { project, testGroups } of projects) {
        // Inherit extra enviroment variables from dependencies.
        let extraEnv: Record<string, string | undefined> = {};
        for (const dep of project._internal.deps)
          extraEnv = { ...extraEnv, ...extraEnvByProjectId.get(dep._internal.id) };
        extraEnvByProjectId.set(project._internal.id, extraEnv);

        const hasFailedDeps = project._internal.deps.some(p => !successfulProjects.has(p));
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
          const hasFailedDeps = project._internal.deps.some(p => !successfulProjects.has(p));
          if (!hasFailedDeps && !projectSuite.allTests().some(test => !test.ok()))
            successfulProjects.add(project);
        }
      }
    }
  };
}

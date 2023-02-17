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
import { Dispatcher } from './dispatcher';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { Multiplexer } from '../reporters/multiplexer';
import type { TestGroup } from '../runner/testGroups';
import { createTestGroups } from '../runner/testGroups';
import type { Task } from './taskRunner';
import { TaskRunner } from './taskRunner';
import type { Suite } from '../common/test';
import type { FullConfigInternal, FullProjectInternal } from '../common/types';
import { loadAllTests, loadGlobalHook } from './loadUtils';
import { createFileMatcherFromArguments } from '../util';
import type { Matcher } from '../util';

const removeFolderAsync = promisify(rimraf);
const readDirAsync = promisify(fs.readdir);

type ProjectWithTestGroups = {
  project: FullProjectInternal;
  projectSuite: Suite;
  testGroups: TestGroup[];
};

export type TaskRunnerState = {
  reporter: Multiplexer;
  config: FullConfigInternal;
  rootSuite?: Suite;
  phases: {
    dispatcher: Dispatcher,
    projects: ProjectWithTestGroups[]
  }[];
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
  taskRunner.addTask('create tasks', createTestGroupsTask());
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

export function createTaskRunnerForList(config: FullConfigInternal, reporter: Multiplexer): TaskRunner<TaskRunnerState> {
  const taskRunner = new TaskRunner<TaskRunnerState>(reporter, config.globalTimeout);
  taskRunner.addTask('load tests', createLoadTask('in-process', false));
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
    const cliMatcher = config._internal.cliArgs.length ? createFileMatcherFromArguments(config._internal.cliArgs) : () => true;
    const fileMatcher = (value: string) => cliMatcher(value) && (additionalFileMatcher ? additionalFileMatcher(value) : true);
    context.rootSuite = await loadAllTests(mode, config, projectsToIgnore, fileMatcher, errors, shouldFilterOnly);
    // Fail when no tests.
    if (!context.rootSuite.allTests().length && !config._internal.passWithNoTests && !config.shard)
      throw new Error(`No tests found`);
  };
}

function createTestGroupsTask(): Task<TaskRunnerState> {
  return async context => {
    const { config, rootSuite, reporter } = context;
    context.config._internal.maxConcurrentTestGroups = 0;
    for (const phase of buildPhases(rootSuite!.suites)) {
      // Go over the phases, for each phase create list of task groups.
      const projects: ProjectWithTestGroups[] = [];
      for (const projectSuite of phase) {
        const testGroups = createTestGroups(projectSuite, config.workers);
        projects.push({
          project: projectSuite._projectConfig!,
          projectSuite,
          testGroups,
        });
      }

      const testGroupsInPhase = projects.reduce((acc, project) => acc + project.testGroups.length, 0);
      debug('pw:test:task')(`running phase with ${projects.map(p => p.project.name).sort()} projects, ${testGroupsInPhase} testGroups`);
      context.phases.push({ dispatcher: new Dispatcher(config, reporter), projects });
      context.config._internal.maxConcurrentTestGroups = Math.max(context.config._internal.maxConcurrentTestGroups, testGroupsInPhase);
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

    for (const { dispatcher, projects } of phases) {
      // Each phase contains dispatcher and a set of test groups.
      // We don't want to run the test groups beloning to the projects
      // that depend on the projects that failed previously.
      const phaseTestGroups: TestGroup[] = [];
      for (const { project, testGroups } of projects) {
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
        await dispatcher!.run(phaseTestGroups);
        await dispatcher.stop();
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

function buildPhases(projectSuites: Suite[]): Suite[][] {
  const phases: Suite[][] = [];
  const processed = new Set<FullProjectInternal>();
  for (let i = 0; i < projectSuites.length; i++) {
    const phase: Suite[] = [];
    for (const projectSuite of projectSuites) {
      if (processed.has(projectSuite._projectConfig!))
        continue;
      if (projectSuite._projectConfig!._internal.deps.find(p => !processed.has(p)))
        continue;
      phase.push(projectSuite);
    }
    for (const projectSuite of phase)
      processed.add(projectSuite._projectConfig!);
    if (phase.length)
      phases.push(phase);
  }
  return phases;
}

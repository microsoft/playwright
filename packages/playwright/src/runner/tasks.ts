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
import { removeFolders } from 'playwright-core/lib/utils';
import { Dispatcher, type EnvByProjectId } from './dispatcher';
import type { TestRunnerPluginRegistration } from '../plugins';
import type { ReporterV2 } from '../reporters/reporterV2';
import { createTestGroups, type TestGroup } from '../runner/testGroups';
import type { Task } from './taskRunner';
import { TaskRunner } from './taskRunner';
import type { FullConfigInternal, FullProjectInternal } from '../common/config';
import { collectProjectsAndTestFiles, createRootSuite, loadFileSuites, loadGlobalHook } from './loadUtils';
import type { Matcher } from '../util';
import { Suite } from '../common/test';
import { buildDependentProjects, buildTeardownToSetupsMap, filterProjects } from './projectUtils';
import { FailureTracker } from './failureTracker';
import { detectChangedTestFiles } from './vcs';

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
  readonly config: FullConfigInternal;
  readonly failureTracker: FailureTracker;
  rootSuite: Suite | undefined = undefined;
  readonly phases: Phase[] = [];
  projectFiles: Map<FullProjectInternal, string[]> = new Map();
  projectSuites: Map<FullProjectInternal, Suite[]> = new Map();

  constructor(config: FullConfigInternal) {
    this.config = config;
    this.failureTracker = new FailureTracker(config);
  }
}

export function createTaskRunner(config: FullConfigInternal, reporters: ReporterV2[]): TaskRunner<TestRun> {
  const taskRunner = TaskRunner.create<TestRun>(reporters, config.config.globalTimeout);
  addGlobalSetupTasks(taskRunner, config);
  taskRunner.addTask('load tests', createLoadTask('in-process', { filterOnly: true, failOnLoadErrors: true }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForWatchSetup(config: FullConfigInternal, reporters: ReporterV2[]): TaskRunner<TestRun> {
  const taskRunner = TaskRunner.create<TestRun>(reporters);
  addGlobalSetupTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForWatch(config: FullConfigInternal, reporters: ReporterV2[], additionalFileMatcher?: Matcher): TaskRunner<TestRun> {
  const taskRunner = TaskRunner.create<TestRun>(reporters);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', { filterOnly: true,  failOnLoadErrors: false, doNotRunDepsOutsideProjectFilter: true, additionalFileMatcher }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

export function createTaskRunnerForTestServer(config: FullConfigInternal, reporters: ReporterV2[]): TaskRunner<TestRun> {
  const taskRunner = TaskRunner.create<TestRun>(reporters);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', { filterOnly: true, failOnLoadErrors: false, doNotRunDepsOutsideProjectFilter: true }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}

function addGlobalSetupTasks(taskRunner: TaskRunner<TestRun>, config: FullConfigInternal) {
  if (!config.configCLIOverrides.preserveOutputDir && !process.env.PW_TEST_NO_REMOVE_OUTPUT_DIRS)
    taskRunner.addTask('clear output', createRemoveOutputDirsTask());
  for (const plugin of config.plugins)
    taskRunner.addTask('plugin setup', createPluginSetupTask(plugin));
  if (config.config.globalSetup || config.config.globalTeardown)
    taskRunner.addTask('global setup', createGlobalSetupTask());
}

function addRunTasks(taskRunner: TaskRunner<TestRun>, config: FullConfigInternal) {
  taskRunner.addTask('create phases', createPhasesTask());
  taskRunner.addTask('report begin', createReportBeginTask());
  for (const plugin of config.plugins)
    taskRunner.addTask('plugin begin', createPluginBeginTask(plugin));
  taskRunner.addTask('test suite', createRunTestsTask());
  return taskRunner;
}

export function createTaskRunnerForList(config: FullConfigInternal, reporters: ReporterV2[], mode: 'in-process' | 'out-of-process', options: { failOnLoadErrors: boolean }): TaskRunner<TestRun> {
  const taskRunner = TaskRunner.create<TestRun>(reporters, config.config.globalTimeout);
  taskRunner.addTask('load tests', createLoadTask(mode, { ...options, filterOnly: false }));
  taskRunner.addTask('report begin', createReportBeginTask());
  return taskRunner;
}

export function createTaskRunnerForListFiles(config: FullConfigInternal, reporters: ReporterV2[]): TaskRunner<TestRun> {
  const taskRunner = TaskRunner.create<TestRun>(reporters, config.config.globalTimeout);
  taskRunner.addTask('load tests', createListFilesTask());
  taskRunner.addTask('report begin', createReportBeginTask());
  return taskRunner;
}

function createReportBeginTask(): Task<TestRun> {
  return {
    setup: async (reporter, { rootSuite }) => {
      reporter.onBegin(rootSuite!);
    },
    teardown: async ({}) => {},
  };
}

function createPluginSetupTask(plugin: TestRunnerPluginRegistration): Task<TestRun> {
  return {
    setup: async (reporter, { config }) => {
      if (typeof plugin.factory === 'function')
        plugin.instance = await plugin.factory();
      else
        plugin.instance = plugin.factory;
      await plugin.instance?.setup?.(config.config, config.configDir, reporter);
    },
    teardown: async () => {
      await plugin.instance?.teardown?.();
    },
  };
}

function createPluginBeginTask(plugin: TestRunnerPluginRegistration): Task<TestRun> {
  return {
    setup: async (reporter, { rootSuite }) => {
      await plugin.instance?.begin?.(rootSuite!);
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
    setup: async (reporter, { config }) => {
      const setupHook = config.config.globalSetup ? await loadGlobalHook(config, config.config.globalSetup) : undefined;
      teardownHook = config.config.globalTeardown ? await loadGlobalHook(config, config.config.globalTeardown) : undefined;
      globalSetupResult = setupHook ? await setupHook(config.config) : undefined;
      globalSetupFinished = true;
    },
    teardown: async (reporter, { config }) => {
      if (typeof globalSetupResult === 'function')
        await globalSetupResult();
      if (globalSetupFinished)
        await teardownHook?.(config.config);
    },
  };
}

function createRemoveOutputDirsTask(): Task<TestRun> {
  return {
    setup: async (reporter, { config }) => {
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

function createListFilesTask(): Task<TestRun> {
  return {
    setup: async (reporter, testRun, errors) => {
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

function createLoadTask(mode: 'out-of-process' | 'in-process', options: { filterOnly: boolean, failOnLoadErrors: boolean, doNotRunDepsOutsideProjectFilter?: boolean, additionalFileMatcher?: Matcher }): Task<TestRun> {
  return {
    setup: async (reporter, testRun, errors, softErrors) => {
      await collectProjectsAndTestFiles(testRun, !!options.doNotRunDepsOutsideProjectFilter, options.additionalFileMatcher);
      await loadFileSuites(testRun, mode, options.failOnLoadErrors ? errors : softErrors);

      let cliOnlyChangedMatcher: Matcher | undefined = undefined;
      if (testRun.config.cliOnlyChanged) {
        for (const plugin of testRun.config.plugins)
          await plugin.instance?.populateDependencies?.();
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
    setup: async (reporter, testRun) => {
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
          const phase: Phase = { dispatcher: new Dispatcher(testRun.config, reporter, testRun.failureTracker), projects: [] };
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
    setup: async (reporter, { phases, failureTracker }) => {
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
    teardown: async (reporter, { phases }) => {
      for (const { dispatcher } of phases.reverse())
        await dispatcher.stop();
    },
  };
}

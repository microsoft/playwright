"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TestRun = void 0;
exports.createTaskRunner = createTaskRunner;
exports.createTaskRunnerForList = createTaskRunnerForList;
exports.createTaskRunnerForListFiles = createTaskRunnerForListFiles;
exports.createTaskRunnerForTestServer = createTaskRunnerForTestServer;
exports.createTaskRunnerForWatch = createTaskRunnerForWatch;
exports.createTaskRunnerForWatchSetup = createTaskRunnerForWatchSetup;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _util = require("util");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _utils = require("playwright-core/lib/utils");
var _dispatcher = require("./dispatcher");
var _testGroups = require("../runner/testGroups");
var _taskRunner = require("./taskRunner");
var _loadUtils = require("./loadUtils");
var _test = require("../common/test");
var _projectUtils = require("./projectUtils");
var _failureTracker = require("./failureTracker");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
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

const readDirAsync = (0, _util.promisify)(_fs.default.readdir);
class TestRun {
  constructor(config, reporter) {
    this.reporter = void 0;
    this.config = void 0;
    this.failureTracker = void 0;
    this.rootSuite = undefined;
    this.phases = [];
    this.projectFiles = new Map();
    this.projectSuites = new Map();
    this.config = config;
    this.reporter = reporter;
    this.failureTracker = new _failureTracker.FailureTracker(config);
  }
}
exports.TestRun = TestRun;
function createTaskRunner(config, reporter) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, config.config.globalTimeout);
  addGlobalSetupTasks(taskRunner, config);
  taskRunner.addTask('load tests', createLoadTask('in-process', {
    filterOnly: true,
    failOnLoadErrors: true
  }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}
function createTaskRunnerForWatchSetup(config, reporter) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, 0);
  addGlobalSetupTasks(taskRunner, config);
  return taskRunner;
}
function createTaskRunnerForWatch(config, reporter, additionalFileMatcher) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, 0);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', {
    filterOnly: true,
    failOnLoadErrors: false,
    doNotRunDepsOutsideProjectFilter: true,
    additionalFileMatcher
  }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}
function createTaskRunnerForTestServer(config, reporter) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, 0);
  taskRunner.addTask('load tests', createLoadTask('out-of-process', {
    filterOnly: true,
    failOnLoadErrors: false,
    doNotRunDepsOutsideProjectFilter: true
  }));
  addRunTasks(taskRunner, config);
  return taskRunner;
}
function addGlobalSetupTasks(taskRunner, config) {
  if (!config.configCLIOverrides.preserveOutputDir && !process.env.PW_TEST_NO_REMOVE_OUTPUT_DIRS) taskRunner.addTask('clear output', createRemoveOutputDirsTask());
  for (const plugin of config.plugins) taskRunner.addTask('plugin setup', createPluginSetupTask(plugin));
  if (config.config.globalSetup || config.config.globalTeardown) taskRunner.addTask('global setup', createGlobalSetupTask());
}
function addRunTasks(taskRunner, config) {
  taskRunner.addTask('create phases', createPhasesTask());
  taskRunner.addTask('report begin', createReportBeginTask());
  for (const plugin of config.plugins) taskRunner.addTask('plugin begin', createPluginBeginTask(plugin));
  taskRunner.addTask('test suite', createRunTestsTask());
  return taskRunner;
}
function createTaskRunnerForList(config, reporter, mode, options) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, config.config.globalTimeout);
  taskRunner.addTask('load tests', createLoadTask(mode, {
    ...options,
    filterOnly: false
  }));
  taskRunner.addTask('report begin', createReportBeginTask());
  return taskRunner;
}
function createTaskRunnerForListFiles(config, reporter) {
  const taskRunner = new _taskRunner.TaskRunner(reporter, config.config.globalTimeout);
  taskRunner.addTask('load tests', createListFilesTask());
  taskRunner.addTask('report begin', createReportBeginTask());
  return taskRunner;
}
function createReportBeginTask() {
  return {
    setup: async ({
      reporter,
      rootSuite
    }) => {
      reporter.onBegin(rootSuite);
    },
    teardown: async ({}) => {}
  };
}
function createPluginSetupTask(plugin) {
  return {
    setup: async ({
      config,
      reporter
    }) => {
      var _plugin$instance, _plugin$instance$setu;
      if (typeof plugin.factory === 'function') plugin.instance = await plugin.factory();else plugin.instance = plugin.factory;
      await ((_plugin$instance = plugin.instance) === null || _plugin$instance === void 0 || (_plugin$instance$setu = _plugin$instance.setup) === null || _plugin$instance$setu === void 0 ? void 0 : _plugin$instance$setu.call(_plugin$instance, config.config, config.configDir, reporter));
    },
    teardown: async () => {
      var _plugin$instance2, _plugin$instance2$tea;
      await ((_plugin$instance2 = plugin.instance) === null || _plugin$instance2 === void 0 || (_plugin$instance2$tea = _plugin$instance2.teardown) === null || _plugin$instance2$tea === void 0 ? void 0 : _plugin$instance2$tea.call(_plugin$instance2));
    }
  };
}
function createPluginBeginTask(plugin) {
  return {
    setup: async ({
      rootSuite
    }) => {
      var _plugin$instance3, _plugin$instance3$beg;
      await ((_plugin$instance3 = plugin.instance) === null || _plugin$instance3 === void 0 || (_plugin$instance3$beg = _plugin$instance3.begin) === null || _plugin$instance3$beg === void 0 ? void 0 : _plugin$instance3$beg.call(_plugin$instance3, rootSuite));
    },
    teardown: async () => {
      var _plugin$instance4, _plugin$instance4$end;
      await ((_plugin$instance4 = plugin.instance) === null || _plugin$instance4 === void 0 || (_plugin$instance4$end = _plugin$instance4.end) === null || _plugin$instance4$end === void 0 ? void 0 : _plugin$instance4$end.call(_plugin$instance4));
    }
  };
}
function createGlobalSetupTask() {
  let globalSetupResult;
  let globalSetupFinished = false;
  let teardownHook;
  return {
    setup: async ({
      config
    }) => {
      const setupHook = config.config.globalSetup ? await (0, _loadUtils.loadGlobalHook)(config, config.config.globalSetup) : undefined;
      teardownHook = config.config.globalTeardown ? await (0, _loadUtils.loadGlobalHook)(config, config.config.globalTeardown) : undefined;
      globalSetupResult = setupHook ? await setupHook(config.config) : undefined;
      globalSetupFinished = true;
    },
    teardown: async ({
      config
    }) => {
      var _teardownHook;
      if (typeof globalSetupResult === 'function') await globalSetupResult();
      if (globalSetupFinished) await ((_teardownHook = teardownHook) === null || _teardownHook === void 0 ? void 0 : _teardownHook(config.config));
    }
  };
}
function createRemoveOutputDirsTask() {
  return {
    setup: async ({
      config
    }) => {
      const outputDirs = new Set();
      const projects = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
      projects.forEach(p => outputDirs.add(p.project.outputDir));
      await Promise.all(Array.from(outputDirs).map(outputDir => (0, _utils.removeFolders)([outputDir]).then(async ([error]) => {
        if (!error) return;
        if (error.code === 'EBUSY') {
          // We failed to remove folder, might be due to the whole folder being mounted inside a container:
          //   https://github.com/microsoft/playwright/issues/12106
          // Do a best-effort to remove all files inside of it instead.
          const entries = await readDirAsync(outputDir).catch(e => []);
          await Promise.all(entries.map(entry => (0, _utils.removeFolders)([_path.default.join(outputDir, entry)])));
        } else {
          throw error;
        }
      })));
    }
  };
}
function createListFilesTask() {
  return {
    setup: async (testRun, errors) => {
      testRun.rootSuite = await (0, _loadUtils.createRootSuite)(testRun, errors, false);
      testRun.failureTracker.onRootSuite(testRun.rootSuite);
      await (0, _loadUtils.collectProjectsAndTestFiles)(testRun, false);
      for (const [project, files] of testRun.projectFiles) {
        const projectSuite = new _test.Suite(project.project.name, 'project');
        projectSuite._fullProject = project;
        testRun.rootSuite._addSuite(projectSuite);
        const suites = files.map(file => {
          const title = _path.default.relative(testRun.config.config.rootDir, file);
          const suite = new _test.Suite(title, 'file');
          suite.location = {
            file,
            line: 0,
            column: 0
          };
          projectSuite._addSuite(suite);
          return suite;
        });
        testRun.projectSuites.set(project, suites);
      }
    }
  };
}
function createLoadTask(mode, options) {
  return {
    setup: async (testRun, errors, softErrors) => {
      await (0, _loadUtils.collectProjectsAndTestFiles)(testRun, !!options.doNotRunDepsOutsideProjectFilter, options.additionalFileMatcher);
      await (0, _loadUtils.loadFileSuites)(testRun, mode, options.failOnLoadErrors ? errors : softErrors);
      testRun.rootSuite = await (0, _loadUtils.createRootSuite)(testRun, options.failOnLoadErrors ? errors : softErrors, !!options.filterOnly);
      testRun.failureTracker.onRootSuite(testRun.rootSuite);
      // Fail when no tests.
      if (options.failOnLoadErrors && !testRun.rootSuite.allTests().length && !testRun.config.cliPassWithNoTests && !testRun.config.config.shard) {
        if (testRun.config.cliArgs.length) {
          throw new Error([`No tests found.`, `Make sure that arguments are regular expressions matching test files.`, `You may need to escape symbols like "$" or "*" and quote the arguments.`].join('\n'));
        }
        throw new Error(`No tests found`);
      }
    }
  };
}
function createPhasesTask() {
  return {
    setup: async testRun => {
      let maxConcurrentTestGroups = 0;
      const processed = new Set();
      const projectToSuite = new Map(testRun.rootSuite.suites.map(suite => [suite._fullProject, suite]));
      const allProjects = [...projectToSuite.keys()];
      const teardownToSetups = (0, _projectUtils.buildTeardownToSetupsMap)(allProjects);
      const teardownToSetupsDependents = new Map();
      for (const [teardown, setups] of teardownToSetups) {
        const closure = (0, _projectUtils.buildDependentProjects)(setups, allProjects);
        closure.delete(teardown);
        teardownToSetupsDependents.set(teardown, [...closure]);
      }
      for (let i = 0; i < projectToSuite.size; i++) {
        // Find all projects that have all their dependencies processed by previous phases.
        const phaseProjects = [];
        for (const project of projectToSuite.keys()) {
          if (processed.has(project)) continue;
          const projectsThatShouldFinishFirst = [...project.deps, ...(teardownToSetupsDependents.get(project) || [])];
          if (projectsThatShouldFinishFirst.find(p => !processed.has(p))) continue;
          phaseProjects.push(project);
        }

        // Create a new phase.
        for (const project of phaseProjects) processed.add(project);
        if (phaseProjects.length) {
          let testGroupsInPhase = 0;
          const phase = {
            dispatcher: new _dispatcher.Dispatcher(testRun.config, testRun.reporter, testRun.failureTracker),
            projects: []
          };
          testRun.phases.push(phase);
          for (const project of phaseProjects) {
            const projectSuite = projectToSuite.get(project);
            const testGroups = (0, _testGroups.createTestGroups)(projectSuite, testRun.config.config.workers);
            phase.projects.push({
              project,
              projectSuite,
              testGroups
            });
            testGroupsInPhase += testGroups.length;
          }
          (0, _utilsBundle.debug)('pw:test:task')(`created phase #${testRun.phases.length} with ${phase.projects.map(p => p.project.project.name).sort()} projects, ${testGroupsInPhase} testGroups`);
          maxConcurrentTestGroups = Math.max(maxConcurrentTestGroups, testGroupsInPhase);
        }
      }
      testRun.config.config.metadata.actualWorkers = Math.min(testRun.config.config.workers, maxConcurrentTestGroups);
    }
  };
}
function createRunTestsTask() {
  return {
    setup: async ({
      phases,
      failureTracker
    }) => {
      const successfulProjects = new Set();
      const extraEnvByProjectId = new Map();
      const teardownToSetups = (0, _projectUtils.buildTeardownToSetupsMap)(phases.map(phase => phase.projects.map(p => p.project)).flat());
      for (const {
        dispatcher,
        projects
      } of phases) {
        // Each phase contains dispatcher and a set of test groups.
        // We don't want to run the test groups belonging to the projects
        // that depend on the projects that failed previously.
        const phaseTestGroups = [];
        for (const {
          project,
          testGroups
        } of projects) {
          // Inherit extra environment variables from dependencies.
          let extraEnv = {};
          for (const dep of project.deps) extraEnv = {
            ...extraEnv,
            ...extraEnvByProjectId.get(dep.id)
          };
          for (const setup of teardownToSetups.get(project) || []) extraEnv = {
            ...extraEnv,
            ...extraEnvByProjectId.get(setup.id)
          };
          extraEnvByProjectId.set(project.id, extraEnv);
          const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
          if (!hasFailedDeps) phaseTestGroups.push(...testGroups);
        }
        if (phaseTestGroups.length) {
          await dispatcher.run(phaseTestGroups, extraEnvByProjectId);
          await dispatcher.stop();
          for (const [projectId, envProduced] of dispatcher.producedEnvByProjectId()) {
            const extraEnv = extraEnvByProjectId.get(projectId) || {};
            extraEnvByProjectId.set(projectId, {
              ...extraEnv,
              ...envProduced
            });
          }
        }

        // If the worker broke, fail everything, we have no way of knowing which
        // projects failed.
        if (!failureTracker.hasWorkerErrors()) {
          for (const {
            project,
            projectSuite
          } of projects) {
            const hasFailedDeps = project.deps.some(p => !successfulProjects.has(p));
            if (!hasFailedDeps && !projectSuite.allTests().some(test => !test.ok())) successfulProjects.add(project);
          }
        }
      }
    },
    teardown: async ({
      phases
    }) => {
      for (const {
        dispatcher
      } of phases.reverse()) await dispatcher.stop();
    }
  };
}
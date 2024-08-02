"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Runner = void 0;
exports.readLastRunInfo = readLastRunInfo;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _webServerPlugin = require("../plugins/webServerPlugin");
var _projectUtils = require("./projectUtils");
var _reporters = require("./reporters");
var _tasks = require("./tasks");
var _watchMode = require("./watchMode");
var _internalReporter = require("../reporters/internalReporter");
var _multiplexer = require("../reporters/multiplexer");
var _reporterV = require("../reporters/reporterV2");
var _compilationCache = require("../transform/compilationCache");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

class Runner {
  constructor(config) {
    this._config = void 0;
    this._config = config;
  }
  async listTestFiles(projectNames) {
    const projects = (0, _projectUtils.filterProjects)(this._config.projects, projectNames);
    const report = {
      projects: []
    };
    for (const project of projects) {
      report.projects.push({
        name: project.project.name,
        testDir: project.project.testDir,
        use: {
          testIdAttribute: project.project.use.testIdAttribute
        },
        files: await (0, _projectUtils.collectFilesForProject)(project)
      });
    }
    return report;
  }
  async runAllTests() {
    const config = this._config;
    const listOnly = config.cliListOnly;
    const deadline = config.config.globalTimeout ? (0, _utils.monotonicTime)() + config.config.globalTimeout : 0;

    // Legacy webServer support.
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config.plugins.push({
      factory: p
    }));
    const reporter = new _internalReporter.InternalReporter(new _multiplexer.Multiplexer(await (0, _reporters.createReporters)(config, listOnly ? 'list' : 'test', false)));
    const taskRunner = listOnly ? (0, _tasks.createTaskRunnerForList)(config, reporter, 'in-process', {
      failOnLoadErrors: true
    }) : (0, _tasks.createTaskRunner)(config, reporter);
    const testRun = new _tasks.TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const taskStatus = await taskRunner.run(testRun, deadline);
    let status = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed') status = taskStatus;
    const modifiedResult = await reporter.onEnd({
      status
    });
    if (modifiedResult && modifiedResult.status) status = modifiedResult.status;
    if (!listOnly) await writeLastRunInfo(testRun, status);
    await reporter.onExit();

    // Calling process.exit() might truncate large stdout/stderr output.
    // See https://github.com/nodejs/node/issues/6456.
    // See https://github.com/nodejs/node/issues/12921
    await new Promise(resolve => process.stdout.write('', () => resolve()));
    await new Promise(resolve => process.stderr.write('', () => resolve()));
    return status;
  }
  async loadAllTests(mode = 'in-process') {
    const config = this._config;
    const errors = [];
    const reporter = new _internalReporter.InternalReporter(new _multiplexer.Multiplexer([(0, _reporterV.wrapReporterAsV2)({
      onError(error) {
        errors.push(error);
      }
    })]));
    const taskRunner = (0, _tasks.createTaskRunnerForList)(config, reporter, mode, {
      failOnLoadErrors: true
    });
    const testRun = new _tasks.TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const taskStatus = await taskRunner.run(testRun, 0);
    let status = testRun.failureTracker.result();
    if (status === 'passed' && taskStatus !== 'passed') status = taskStatus;
    const modifiedResult = await reporter.onEnd({
      status
    });
    if (modifiedResult && modifiedResult.status) status = modifiedResult.status;
    await reporter.onExit();
    return {
      status,
      suite: testRun.rootSuite,
      errors
    };
  }
  async watchAllTests() {
    const config = this._config;
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config.plugins.push({
      factory: p
    }));
    return await (0, _watchMode.runWatchModeLoop)(config);
  }
  async findRelatedTestFiles(mode, files) {
    var _playwrightTest;
    const result = await this.loadAllTests(mode);
    if (result.status !== 'passed' || !result.suite) return {
      errors: result.errors,
      testFiles: []
    };
    const resolvedFiles = files.map(file => _path.default.resolve(process.cwd(), file));
    const override = (_playwrightTest = this._config.config['@playwright/test']) === null || _playwrightTest === void 0 || (_playwrightTest = _playwrightTest['cli']) === null || _playwrightTest === void 0 ? void 0 : _playwrightTest['find-related-test-files'];
    if (override) return await override(resolvedFiles, this._config, result.suite);
    return {
      testFiles: (0, _compilationCache.affectedTestFiles)(resolvedFiles)
    };
  }
}
exports.Runner = Runner;
async function writeLastRunInfo(testRun, status) {
  var _testRun$rootSuite;
  const [project] = (0, _projectUtils.filterProjects)(testRun.config.projects, testRun.config.cliProjectFilter);
  if (!project) return;
  const outputDir = project.project.outputDir;
  await _fs.default.promises.mkdir(outputDir, {
    recursive: true
  });
  const lastRunReportFile = _path.default.join(outputDir, '.last-run.json');
  const failedTests = (_testRun$rootSuite = testRun.rootSuite) === null || _testRun$rootSuite === void 0 ? void 0 : _testRun$rootSuite.allTests().filter(t => !t.ok()).map(t => t.id);
  const lastRunReport = JSON.stringify({
    status,
    failedTests
  }, undefined, 2);
  await _fs.default.promises.writeFile(lastRunReportFile, lastRunReport);
}
async function readLastRunInfo(config) {
  const [project] = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
  if (!project) return {
    status: 'passed',
    failedTests: []
  };
  const outputDir = project.project.outputDir;
  try {
    const lastRunReportFile = _path.default.join(outputDir, '.last-run.json');
    return JSON.parse(await _fs.default.promises.readFile(lastRunReportFile, 'utf8'));
  } catch {}
  return {
    status: 'passed',
    failedTests: []
  };
}
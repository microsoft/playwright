"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.runWatchModeLoop = runWatchModeLoop;
var _readline = _interopRequireDefault(require("readline"));
var _utils = require("playwright-core/lib/utils");
var _internalReporter = require("../reporters/internalReporter");
var _util = require("../util");
var _tasks = require("./tasks");
var _projectUtils = require("./projectUtils");
var _compilationCache = require("../transform/compilationCache");
var _utilsBundle = require("../utilsBundle");
var _utilsBundle2 = require("playwright-core/lib/utilsBundle");
var _base = require("../reporters/base");
var _playwrightServer = require("playwright-core/lib/remote/playwrightServer");
var _list = _interopRequireDefault(require("../reporters/list"));
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

class FSWatcher {
  constructor() {
    this._dirtyTestFiles = new Map();
    this._notifyDirtyFiles = void 0;
    this._watcher = void 0;
    this._timer = void 0;
  }
  async update(config) {
    const commandLineFileMatcher = config.cliArgs.length ? (0, _util.createFileMatcherFromArguments)(config.cliArgs) : () => true;
    const projects = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
    const projectClosure = (0, _projectUtils.buildProjectsClosure)(projects);
    const projectFilters = new Map();
    for (const [project, type] of projectClosure) {
      const testMatch = (0, _util.createFileMatcher)(project.project.testMatch);
      const testIgnore = (0, _util.createFileMatcher)(project.project.testIgnore);
      projectFilters.set(project, file => {
        if (!file.startsWith(project.project.testDir) || !testMatch(file) || testIgnore(file)) return false;
        return type === 'dependency' || commandLineFileMatcher(file);
      });
    }
    if (this._timer) clearTimeout(this._timer);
    if (this._watcher) await this._watcher.close();
    this._watcher = _utilsBundle.chokidar.watch([...projectClosure.keys()].map(p => p.project.testDir), {
      ignoreInitial: true
    }).on('all', async (event, file) => {
      if (event !== 'add' && event !== 'change') return;
      const testFiles = new Set();
      (0, _compilationCache.collectAffectedTestFiles)(file, testFiles);
      const testFileArray = [...testFiles];
      let hasMatches = false;
      for (const [project, filter] of projectFilters) {
        const filteredFiles = testFileArray.filter(filter);
        if (!filteredFiles.length) continue;
        let set = this._dirtyTestFiles.get(project);
        if (!set) {
          set = new Set();
          this._dirtyTestFiles.set(project, set);
        }
        filteredFiles.map(f => set.add(f));
        hasMatches = true;
      }
      if (!hasMatches) return;
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => {
        var _this$_notifyDirtyFil;
        (_this$_notifyDirtyFil = this._notifyDirtyFiles) === null || _this$_notifyDirtyFil === void 0 || _this$_notifyDirtyFil.call(this);
      }, 250);
    });
  }
  async onDirtyTestFiles() {
    if (this._dirtyTestFiles.size) return;
    await new Promise(f => this._notifyDirtyFiles = f);
  }
  takeDirtyTestFiles() {
    const result = this._dirtyTestFiles;
    this._dirtyTestFiles = new Map();
    return result;
  }
}
async function runWatchModeLoop(config) {
  // Reset the settings that don't apply to watch.
  config.cliPassWithNoTests = true;
  for (const p of config.projects) p.project.retries = 0;

  // Perform global setup.
  const reporter = new _internalReporter.InternalReporter(new _list.default());
  const testRun = new _tasks.TestRun(config, reporter);
  const taskRunner = (0, _tasks.createTaskRunnerForWatchSetup)(config, reporter);
  reporter.onConfigure(config.config);
  const {
    status,
    cleanup: globalCleanup
  } = await taskRunner.runDeferCleanup(testRun, 0);
  if (status !== 'passed') await globalCleanup();
  await reporter.onEnd({
    status
  });
  await reporter.onExit();
  if (status !== 'passed') return status;

  // Prepare projects that will be watched, set up watcher.
  const failedTestIdCollector = new Set();
  const originalWorkers = config.config.workers;
  const fsWatcher = new FSWatcher();
  await fsWatcher.update(config);
  let lastRun = {
    type: 'regular'
  };
  let result = 'passed';

  // Enter the watch loop.
  await runTests(config, failedTestIdCollector);
  while (true) {
    printPrompt();
    const readCommandPromise = readCommand();
    await Promise.race([fsWatcher.onDirtyTestFiles(), readCommandPromise]);
    if (!readCommandPromise.isDone()) readCommandPromise.resolve('changed');
    const command = await readCommandPromise;
    if (command === 'changed') {
      const dirtyTestFiles = fsWatcher.takeDirtyTestFiles();
      // Resolve files that depend on the changed files.
      await runChangedTests(config, failedTestIdCollector, dirtyTestFiles);
      lastRun = {
        type: 'changed',
        dirtyTestFiles
      };
      continue;
    }
    if (command === 'run') {
      // All means reset filters.
      await runTests(config, failedTestIdCollector);
      lastRun = {
        type: 'regular'
      };
      continue;
    }
    if (command === 'project') {
      const {
        projectNames
      } = await _utilsBundle.enquirer.prompt({
        type: 'multiselect',
        name: 'projectNames',
        message: 'Select projects',
        choices: config.projects.map(p => ({
          name: p.project.name
        }))
      }).catch(() => ({
        projectNames: null
      }));
      if (!projectNames) continue;
      config.cliProjectFilter = projectNames.length ? projectNames : undefined;
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = {
        type: 'regular'
      };
      continue;
    }
    if (command === 'file') {
      const {
        filePattern
      } = await _utilsBundle.enquirer.prompt({
        type: 'text',
        name: 'filePattern',
        message: 'Input filename pattern (regex)'
      }).catch(() => ({
        filePattern: null
      }));
      if (filePattern === null) continue;
      if (filePattern.trim()) config.cliArgs = filePattern.split(' ');else config.cliArgs = [];
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = {
        type: 'regular'
      };
      continue;
    }
    if (command === 'grep') {
      const {
        testPattern
      } = await _utilsBundle.enquirer.prompt({
        type: 'text',
        name: 'testPattern',
        message: 'Input test name pattern (regex)'
      }).catch(() => ({
        testPattern: null
      }));
      if (testPattern === null) continue;
      if (testPattern.trim()) config.cliGrep = testPattern;else config.cliGrep = undefined;
      await fsWatcher.update(config);
      await runTests(config, failedTestIdCollector);
      lastRun = {
        type: 'regular'
      };
      continue;
    }
    if (command === 'failed') {
      config.testIdMatcher = id => failedTestIdCollector.has(id);
      const failedTestIds = new Set(failedTestIdCollector);
      await runTests(config, failedTestIdCollector, {
        title: 'running failed tests'
      });
      config.testIdMatcher = undefined;
      lastRun = {
        type: 'failed',
        failedTestIds
      };
      continue;
    }
    if (command === 'repeat') {
      if (lastRun.type === 'regular') {
        await runTests(config, failedTestIdCollector, {
          title: 're-running tests'
        });
        continue;
      } else if (lastRun.type === 'changed') {
        await runChangedTests(config, failedTestIdCollector, lastRun.dirtyTestFiles, 're-running tests');
      } else if (lastRun.type === 'failed') {
        config.testIdMatcher = id => lastRun.failedTestIds.has(id);
        await runTests(config, failedTestIdCollector, {
          title: 're-running tests'
        });
        config.testIdMatcher = undefined;
      }
      continue;
    }
    if (command === 'toggle-show-browser') {
      await toggleShowBrowser(config, originalWorkers);
      continue;
    }
    if (command === 'exit') break;
    if (command === 'interrupted') {
      result = 'interrupted';
      break;
    }
  }
  const cleanupStatus = await globalCleanup();
  return result === 'passed' ? cleanupStatus : result;
}
async function runChangedTests(config, failedTestIdCollector, filesByProject, title) {
  const testFiles = new Set();
  for (const files of filesByProject.values()) files.forEach(f => testFiles.add(f));

  // Collect all the affected projects, follow project dependencies.
  // Prepare to exclude all the projects that do not depend on this file, as if they did not exist.
  const projects = (0, _projectUtils.filterProjects)(config.projects, config.cliProjectFilter);
  const projectClosure = (0, _projectUtils.buildProjectsClosure)(projects);
  const affectedProjects = affectedProjectsClosure([...projectClosure.keys()], [...filesByProject.keys()]);
  const affectsAnyDependency = [...affectedProjects].some(p => projectClosure.get(p) === 'dependency');

  // If there are affected dependency projects, do the full run, respect the original CLI.
  // if there are no affected dependency projects, intersect CLI with dirty files
  const additionalFileMatcher = affectsAnyDependency ? () => true : file => testFiles.has(file);
  await runTests(config, failedTestIdCollector, {
    additionalFileMatcher,
    title: title || 'files changed'
  });
}
async function runTests(config, failedTestIdCollector, options) {
  printConfiguration(config, options === null || options === void 0 ? void 0 : options.title);
  const reporter = new _internalReporter.InternalReporter(new _list.default());
  const taskRunner = (0, _tasks.createTaskRunnerForWatch)(config, reporter, options === null || options === void 0 ? void 0 : options.additionalFileMatcher);
  const testRun = new _tasks.TestRun(config, reporter);
  reporter.onConfigure(config.config);
  const taskStatus = await taskRunner.run(testRun, 0);
  let status = 'passed';
  let hasFailedTests = false;
  for (const test of ((_testRun$rootSuite = testRun.rootSuite) === null || _testRun$rootSuite === void 0 ? void 0 : _testRun$rootSuite.allTests()) || []) {
    var _testRun$rootSuite;
    if (test.outcome() === 'unexpected') {
      failedTestIdCollector.add(test.id);
      hasFailedTests = true;
    } else {
      failedTestIdCollector.delete(test.id);
    }
  }
  if (testRun.failureTracker.hasWorkerErrors() || hasFailedTests) status = 'failed';
  if (status === 'passed' && taskStatus !== 'passed') status = taskStatus;
  await reporter.onEnd({
    status
  });
  await reporter.onExit();
}
function affectedProjectsClosure(projectClosure, affected) {
  const result = new Set(affected);
  for (let i = 0; i < projectClosure.length; ++i) {
    for (const p of projectClosure) {
      for (const dep of p.deps) {
        if (result.has(dep)) result.add(p);
      }
      if (p.teardown && result.has(p.teardown)) result.add(p);
    }
  }
  return result;
}
function readCommand() {
  const result = new _utils.ManualPromise();
  const rl = _readline.default.createInterface({
    input: process.stdin,
    escapeCodeTimeout: 50
  });
  _readline.default.emitKeypressEvents(process.stdin, rl);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  const handler = (text, key) => {
    if (text === '\x03' || text === '\x1B' || key && key.name === 'escape' || key && key.ctrl && key.name === 'c') {
      result.resolve('interrupted');
      return;
    }
    if (process.platform !== 'win32' && key && key.ctrl && key.name === 'z') {
      process.kill(process.ppid, 'SIGTSTP');
      process.kill(process.pid, 'SIGTSTP');
    }
    const name = key === null || key === void 0 ? void 0 : key.name;
    if (name === 'q') {
      result.resolve('exit');
      return;
    }
    if (name === 'h') {
      process.stdout.write(`${(0, _base.separator)()}
Run tests
  ${_utilsBundle2.colors.bold('enter')}    ${_utilsBundle2.colors.dim('run tests')}
  ${_utilsBundle2.colors.bold('f')}        ${_utilsBundle2.colors.dim('run failed tests')}
  ${_utilsBundle2.colors.bold('r')}        ${_utilsBundle2.colors.dim('repeat last run')}
  ${_utilsBundle2.colors.bold('q')}        ${_utilsBundle2.colors.dim('quit')}

Change settings
  ${_utilsBundle2.colors.bold('c')}        ${_utilsBundle2.colors.dim('set project')}
  ${_utilsBundle2.colors.bold('p')}        ${_utilsBundle2.colors.dim('set file filter')}
  ${_utilsBundle2.colors.bold('t')}        ${_utilsBundle2.colors.dim('set title filter')}
  ${_utilsBundle2.colors.bold('s')}        ${_utilsBundle2.colors.dim('toggle show & reuse the browser')}
`);
      return;
    }
    switch (name) {
      case 'return':
        result.resolve('run');
        break;
      case 'r':
        result.resolve('repeat');
        break;
      case 'c':
        result.resolve('project');
        break;
      case 'p':
        result.resolve('file');
        break;
      case 't':
        result.resolve('grep');
        break;
      case 'f':
        result.resolve('failed');
        break;
      case 's':
        result.resolve('toggle-show-browser');
        break;
    }
  };
  process.stdin.on('keypress', handler);
  void result.finally(() => {
    process.stdin.off('keypress', handler);
    rl.close();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  });
  return result;
}
let showBrowserServer;
let seq = 0;
function printConfiguration(config, title) {
  var _ref;
  const packageManagerCommand = (0, _utils.getPackageManagerExecCommand)();
  const tokens = [];
  tokens.push(`${packageManagerCommand} playwright test`);
  tokens.push(...((_ref = config.cliProjectFilter || []) === null || _ref === void 0 ? void 0 : _ref.map(p => _utilsBundle2.colors.blue(`--project ${p}`))));
  if (config.cliGrep) tokens.push(_utilsBundle2.colors.red(`--grep ${config.cliGrep}`));
  if (config.cliArgs) tokens.push(...config.cliArgs.map(a => _utilsBundle2.colors.bold(a)));
  if (title) tokens.push(_utilsBundle2.colors.dim(`(${title})`));
  if (seq) tokens.push(_utilsBundle2.colors.dim(`#${seq}`));
  ++seq;
  const lines = [];
  const sep = (0, _base.separator)();
  lines.push('\x1Bc' + sep);
  lines.push(`${tokens.join(' ')}`);
  lines.push(`${_utilsBundle2.colors.dim('Show & reuse browser:')} ${_utilsBundle2.colors.bold(showBrowserServer ? 'on' : 'off')}`);
  process.stdout.write(lines.join('\n'));
}
function printPrompt() {
  const sep = (0, _base.separator)();
  process.stdout.write(`
${sep}
${_utilsBundle2.colors.dim('Waiting for file changes. Press')} ${_utilsBundle2.colors.bold('enter')} ${_utilsBundle2.colors.dim('to run tests')}, ${_utilsBundle2.colors.bold('q')} ${_utilsBundle2.colors.dim('to quit or')} ${_utilsBundle2.colors.bold('h')} ${_utilsBundle2.colors.dim('for more options.')}
`);
}
async function toggleShowBrowser(config, originalWorkers) {
  if (!showBrowserServer) {
    config.config.workers = 1;
    showBrowserServer = new _playwrightServer.PlaywrightServer({
      mode: 'extension',
      path: '/' + (0, _utils.createGuid)(),
      maxConnections: 1
    });
    const wsEndpoint = await showBrowserServer.listen();
    config.configCLIOverrides.use = {
      ...config.configCLIOverrides.use,
      _optionContextReuseMode: 'when-possible',
      _optionConnectOptions: {
        wsEndpoint
      }
    };
    process.stdout.write(`${_utilsBundle2.colors.dim('Show & reuse browser:')} ${_utilsBundle2.colors.bold('on')}\n`);
  } else {
    var _showBrowserServer;
    config.config.workers = originalWorkers;
    if (config.configCLIOverrides.use) {
      delete config.configCLIOverrides.use._optionContextReuseMode;
      delete config.configCLIOverrides.use._optionConnectOptions;
    }
    await ((_showBrowserServer = showBrowserServer) === null || _showBrowserServer === void 0 ? void 0 : _showBrowserServer.close());
    showBrowserServer = undefined;
    process.stdout.write(`${_utilsBundle2.colors.dim('Show & reuse browser:')} ${_utilsBundle2.colors.bold('off')}\n`);
  }
}
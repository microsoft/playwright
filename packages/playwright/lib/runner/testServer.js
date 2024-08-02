"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearCacheAndLogToConsole = clearCacheAndLogToConsole;
exports.removeFolderAndLogToConsole = removeFolderAndLogToConsole;
exports.resolveCtDirs = resolveCtDirs;
exports.runTestServer = runTestServer;
exports.runUIMode = runUIMode;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _server = require("playwright-core/lib/server");
var _utils = require("playwright-core/lib/utils");
var _compilationCache = require("../transform/compilationCache");
var _internalReporter = require("../reporters/internalReporter");
var _reporters = require("./reporters");
var _tasks = require("./tasks");
var _utilsBundle = require("playwright-core/lib/utilsBundle");
var _list = _interopRequireDefault(require("../reporters/list"));
var _multiplexer = require("../reporters/multiplexer");
var _sigIntWatcher = require("./sigIntWatcher");
var _fsWatcher = require("../fsWatcher");
var _runner = require("./runner");
var _configLoader = require("../common/configLoader");
var _webServerPlugin = require("../plugins/webServerPlugin");
var _util = require("../util");
var _teleReceiver = require("../isomorphic/teleReceiver");
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

const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
class TestServer {
  constructor(configLocation) {
    this._configLocation = void 0;
    this._dispatcher = void 0;
    this._configLocation = configLocation;
  }
  async start(options) {
    this._dispatcher = new TestServerDispatcher(this._configLocation);
    return await (0, _server.startTraceViewerServer)({
      ...options,
      transport: this._dispatcher.transport
    });
  }
  async stop() {
    var _this$_dispatcher, _this$_dispatcher2;
    await ((_this$_dispatcher = this._dispatcher) === null || _this$_dispatcher === void 0 ? void 0 : _this$_dispatcher._setInterceptStdio(false));
    await ((_this$_dispatcher2 = this._dispatcher) === null || _this$_dispatcher2 === void 0 ? void 0 : _this$_dispatcher2.runGlobalTeardown());
  }
}
class TestServerDispatcher {
  constructor(configLocation) {
    this._configLocation = void 0;
    this._globalWatcher = void 0;
    this._testWatcher = void 0;
    this._testRun = void 0;
    this.transport = void 0;
    this._queue = Promise.resolve();
    this._globalSetup = void 0;
    this._dispatchEvent = void 0;
    this._plugins = void 0;
    this._serializer = require.resolve('./uiModeReporter');
    this._watchTestDirs = false;
    this._closeOnDisconnect = false;
    this._devServerHandle = void 0;
    this._configLocation = configLocation;
    this.transport = {
      dispatch: (method, params) => this[method](params),
      onclose: () => {
        if (this._closeOnDisconnect) (0, _utils.gracefullyProcessExitDoNotHang)(0);
      }
    };
    this._globalWatcher = new _fsWatcher.Watcher('deep', () => this._dispatchEvent('listChanged', {}));
    this._testWatcher = new _fsWatcher.Watcher('flat', events => {
      const collector = new Set();
      events.forEach(f => (0, _compilationCache.collectAffectedTestFiles)(f.file, collector));
      this._dispatchEvent('testFilesChanged', {
        testFiles: [...collector]
      });
    });
    this._dispatchEvent = (method, params) => {
      var _this$transport$sendE, _this$transport;
      return (_this$transport$sendE = (_this$transport = this.transport).sendEvent) === null || _this$transport$sendE === void 0 ? void 0 : _this$transport$sendE.call(_this$transport, method, params);
    };
  }
  async _wireReporter(messageSink) {
    return await (0, _reporters.createReporterForTestServer)(this._serializer, messageSink);
  }
  async _collectingReporter() {
    const report = [];
    const wireReporter = await (0, _reporters.createReporterForTestServer)(this._serializer, e => report.push(e));
    const reporter = new _internalReporter.InternalReporter(wireReporter);
    return {
      reporter,
      report
    };
  }
  async initialize(params) {
    if (params.serializer) this._serializer = params.serializer;
    if (params.closeOnDisconnect) this._closeOnDisconnect = true;
    if (params.interceptStdio) await this._setInterceptStdio(true);
    if (params.watchTestDirs) this._watchTestDirs = true;
  }
  async ping() {}
  async open(params) {
    if ((0, _utils.isUnderTest)()) return;
    // eslint-disable-next-line no-console
    (0, _utilsBundle.open)('vscode://file/' + params.location.file + ':' + params.location.line).catch(e => console.error(e));
  }
  async resizeTerminal(params) {
    process.stdout.columns = params.cols;
    process.stdout.rows = params.rows;
    process.stderr.columns = params.cols;
    process.stderr.columns = params.rows;
  }
  async checkBrowsers() {
    return {
      hasBrowsers: hasSomeBrowsers()
    };
  }
  async installBrowsers() {
    await installBrowsers();
  }
  async runGlobalSetup(params) {
    await this.runGlobalTeardown();
    const {
      reporter,
      report
    } = await this._collectingReporter();
    const {
      config,
      error
    } = await this._loadConfig();
    if (!config) {
      // Produce dummy config when it has an error.
      reporter.onConfigure(_teleReceiver.baseFullConfig);
      reporter.onError(error);
      await reporter.onExit();
      return {
        status: 'failed',
        report
      };
    }
    (0, _webServerPlugin.webServerPluginsForConfig)(config).forEach(p => config.plugins.push({
      factory: p
    }));
    const listReporter = new _internalReporter.InternalReporter(new _list.default());
    const taskRunner = (0, _tasks.createTaskRunnerForWatchSetup)(config, new _multiplexer.Multiplexer([reporter, listReporter]));
    reporter.onConfigure(config.config);
    const testRun = new _tasks.TestRun(config, reporter);
    const {
      status,
      cleanup: globalCleanup
    } = await taskRunner.runDeferCleanup(testRun, 0);
    await reporter.onEnd({
      status
    });
    await reporter.onExit();
    if (status !== 'passed') {
      await globalCleanup();
      return {
        report,
        status
      };
    }
    this._globalSetup = {
      cleanup: globalCleanup,
      report
    };
    return {
      report,
      status
    };
  }
  async runGlobalTeardown() {
    const globalSetup = this._globalSetup;
    const status = await (globalSetup === null || globalSetup === void 0 ? void 0 : globalSetup.cleanup());
    this._globalSetup = undefined;
    return {
      status,
      report: (globalSetup === null || globalSetup === void 0 ? void 0 : globalSetup.report) || []
    };
  }
  async startDevServer(params) {
    var _playwrightTest;
    if (this._devServerHandle) return {
      status: 'failed',
      report: []
    };
    const {
      reporter,
      report
    } = await this._collectingReporter();
    const {
      config,
      error
    } = await this._loadConfig();
    if (!config) {
      reporter.onError(error);
      return {
        status: 'failed',
        report
      };
    }
    const devServerCommand = (_playwrightTest = config.config['@playwright/test']) === null || _playwrightTest === void 0 || (_playwrightTest = _playwrightTest['cli']) === null || _playwrightTest === void 0 ? void 0 : _playwrightTest['dev-server'];
    if (!devServerCommand) {
      reporter.onError({
        message: 'No dev-server command found in the configuration'
      });
      return {
        status: 'failed',
        report
      };
    }
    try {
      this._devServerHandle = await devServerCommand(config);
      return {
        status: 'passed',
        report
      };
    } catch (e) {
      reporter.onError((0, _util.serializeError)(e));
      return {
        status: 'failed',
        report
      };
    }
  }
  async stopDevServer(params) {
    if (!this._devServerHandle) return {
      status: 'failed',
      report: []
    };
    try {
      await this._devServerHandle();
      this._devServerHandle = undefined;
      return {
        status: 'passed',
        report: []
      };
    } catch (e) {
      const {
        reporter,
        report
      } = await this._collectingReporter();
      reporter.onError((0, _util.serializeError)(e));
      return {
        status: 'failed',
        report
      };
    }
  }
  async clearCache(params) {
    const {
      config
    } = await this._loadConfig();
    if (config) await clearCacheAndLogToConsole(config);
  }
  async listFiles(params) {
    var _params$projects;
    const {
      reporter,
      report
    } = await this._collectingReporter();
    const {
      config,
      error
    } = await this._loadConfig();
    if (!config) {
      reporter.onError(error);
      return {
        status: 'failed',
        report
      };
    }
    config.cliProjectFilter = (_params$projects = params.projects) !== null && _params$projects !== void 0 && _params$projects.length ? params.projects : undefined;
    const taskRunner = (0, _tasks.createTaskRunnerForListFiles)(config, reporter);
    reporter.onConfigure(config.config);
    const testRun = new _tasks.TestRun(config, reporter);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({
      status
    });
    await reporter.onExit();
    return {
      report,
      status
    };
  }
  async listTests(params) {
    let result;
    this._queue = this._queue.then(async () => {
      result = await this._innerListTests(params);
    }).catch(printInternalError);
    await this._queue;
    return result;
  }
  async _innerListTests(params) {
    var _params$projects2;
    const overrides = {
      repeatEach: 1,
      retries: 0
    };
    const {
      reporter,
      report
    } = await this._collectingReporter();
    const {
      config,
      error
    } = await this._loadConfig(overrides);
    if (!config) {
      reporter.onError(error);
      return {
        report: [],
        status: 'failed'
      };
    }
    config.cliArgs = params.locations || [];
    config.cliProjectFilter = (_params$projects2 = params.projects) !== null && _params$projects2 !== void 0 && _params$projects2.length ? params.projects : undefined;
    config.cliListOnly = true;
    const taskRunner = (0, _tasks.createTaskRunnerForList)(config, reporter, 'out-of-process', {
      failOnLoadErrors: false
    });
    const testRun = new _tasks.TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const status = await taskRunner.run(testRun, 0);
    await reporter.onEnd({
      status
    });
    await reporter.onExit();
    const projectDirs = new Set();
    const projectOutputs = new Set();
    for (const p of config.projects) {
      projectDirs.add(p.project.testDir);
      projectOutputs.add(p.project.outputDir);
    }
    const result = await resolveCtDirs(config);
    if (result) {
      projectDirs.add(result.templateDir);
      projectOutputs.add(result.outDir);
    }
    if (this._watchTestDirs) this._globalWatcher.update([...projectDirs], [...projectOutputs], false);
    return {
      report,
      status
    };
  }
  async runTests(params) {
    let result = {
      status: 'passed'
    };
    this._queue = this._queue.then(async () => {
      result = await this._innerRunTests(params).catch(e => {
        printInternalError(e);
        return {
          status: 'failed'
        };
      });
    });
    await this._queue;
    return result;
  }
  async _innerRunTests(params) {
    var _params$projects3;
    await this.stopTests();
    const overrides = {
      repeatEach: 1,
      retries: 0,
      preserveOutputDir: true,
      timeout: params.timeout,
      reporter: params.reporters ? params.reporters.map(r => [r]) : undefined,
      use: {
        trace: params.trace === 'on' ? {
          mode: 'on',
          sources: false,
          _live: true
        } : params.trace === 'off' ? 'off' : undefined,
        video: params.video === 'on' ? 'on' : params.video === 'off' ? 'off' : undefined,
        headless: params.headed ? false : undefined,
        _optionContextReuseMode: params.reuseContext ? 'when-possible' : undefined,
        _optionConnectOptions: params.connectWsEndpoint ? {
          wsEndpoint: params.connectWsEndpoint
        } : undefined
      },
      outputDir: params.outputDir,
      workers: params.workers
    };
    if (params.trace === 'on') process.env.PW_LIVE_TRACE_STACKS = '1';else process.env.PW_LIVE_TRACE_STACKS = undefined;
    const {
      config,
      error
    } = await this._loadConfig(overrides);
    if (!config) {
      const wireReporter = await this._wireReporter(e => this._dispatchEvent('report', e));
      wireReporter.onError(error);
      return {
        status: 'failed'
      };
    }
    const testIdSet = params.testIds ? new Set(params.testIds) : null;
    config.cliListOnly = false;
    config.cliPassWithNoTests = true;
    config.cliArgs = params.locations || [];
    config.cliGrep = params.grep;
    config.cliGrepInvert = params.grepInvert;
    config.cliProjectFilter = (_params$projects3 = params.projects) !== null && _params$projects3 !== void 0 && _params$projects3.length ? params.projects : undefined;
    config.testIdMatcher = testIdSet ? id => testIdSet.has(id) : undefined;
    const reporters = await (0, _reporters.createReporters)(config, 'test', true);
    const wireReporter = await this._wireReporter(e => this._dispatchEvent('report', e));
    reporters.push(wireReporter);
    const reporter = new _internalReporter.InternalReporter(new _multiplexer.Multiplexer(reporters));
    const taskRunner = (0, _tasks.createTaskRunnerForTestServer)(config, reporter);
    const testRun = new _tasks.TestRun(config, reporter);
    reporter.onConfigure(config.config);
    const stop = new _utils.ManualPromise();
    const run = taskRunner.run(testRun, 0, stop).then(async status => {
      await reporter.onEnd({
        status
      });
      await reporter.onExit();
      this._testRun = undefined;
      return status;
    });
    this._testRun = {
      run,
      stop
    };
    return {
      status: await run
    };
  }
  async watch(params) {
    const files = new Set();
    for (const fileName of params.fileNames) {
      files.add(fileName);
      (0, _compilationCache.dependenciesForTestFile)(fileName).forEach(file => files.add(file));
    }
    this._testWatcher.update([...files], [], true);
  }
  async findRelatedTestFiles(params) {
    const {
      config,
      error
    } = await this._loadConfig();
    if (error) return {
      testFiles: [],
      errors: [error]
    };
    const runner = new _runner.Runner(config);
    return runner.findRelatedTestFiles('out-of-process', params.files);
  }
  async stopTests() {
    var _this$_testRun, _this$_testRun2;
    (_this$_testRun = this._testRun) === null || _this$_testRun === void 0 || (_this$_testRun = _this$_testRun.stop) === null || _this$_testRun === void 0 || _this$_testRun.resolve();
    await ((_this$_testRun2 = this._testRun) === null || _this$_testRun2 === void 0 ? void 0 : _this$_testRun2.run);
  }
  async _setInterceptStdio(intercept) {
    if (process.env.PWTEST_DEBUG) return;
    if (intercept) {
      process.stdout.write = chunk => {
        this._dispatchEvent('stdio', chunkToPayload('stdout', chunk));
        return true;
      };
      process.stderr.write = chunk => {
        this._dispatchEvent('stdio', chunkToPayload('stderr', chunk));
        return true;
      };
    } else {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    }
  }
  async closeGracefully() {
    (0, _utils.gracefullyProcessExitDoNotHang)(0);
  }
  async _loadConfig(overrides) {
    try {
      const config = await (0, _configLoader.loadConfig)(this._configLocation, overrides);
      // Preserve plugin instances between setup and build.
      if (!this._plugins) this._plugins = config.plugins || [];else config.plugins.splice(0, config.plugins.length, ...this._plugins);
      return {
        config
      };
    } catch (e) {
      return {
        config: null,
        error: (0, _util.serializeError)(e)
      };
    }
  }
}
async function runUIMode(configFile, options) {
  const configLocation = (0, _configLoader.resolveConfigLocation)(configFile);
  return await innerRunTestServer(configLocation, options, async (server, cancelPromise) => {
    await (0, _server.installRootRedirect)(server, [], {
      ...options,
      webApp: 'uiMode.html'
    });
    if (options.host !== undefined || options.port !== undefined) {
      await (0, _server.openTraceInBrowser)(server.urlPrefix('human-readable'));
    } else {
      const page = await (0, _server.openTraceViewerApp)(server.urlPrefix('precise'), 'chromium', {
        headless: (0, _utils.isUnderTest)() && process.env.PWTEST_HEADED_FOR_TEST !== '1',
        persistentContextOptions: {
          handleSIGINT: false
        }
      });
      page.on('close', () => cancelPromise.resolve());
    }
  });
}
async function runTestServer(configFile, options) {
  const configLocation = (0, _configLoader.resolveConfigLocation)(configFile);
  return await innerRunTestServer(configLocation, options, async server => {
    // eslint-disable-next-line no-console
    console.log('Listening on ' + server.urlPrefix('precise').replace('http:', 'ws:') + '/' + server.wsGuid());
  });
}
async function innerRunTestServer(configLocation, options, openUI) {
  if ((0, _configLoader.restartWithExperimentalTsEsm)(undefined, true)) return 'restarted';
  const testServer = new TestServer(configLocation);
  const cancelPromise = new _utils.ManualPromise();
  const sigintWatcher = new _sigIntWatcher.SigIntWatcher();
  process.stdin.on('close', () => (0, _utils.gracefullyProcessExitDoNotHang)(0));
  void sigintWatcher.promise().then(() => cancelPromise.resolve());
  try {
    const server = await testServer.start(options);
    await openUI(server, cancelPromise, configLocation);
    await cancelPromise;
  } finally {
    await testServer.stop();
    sigintWatcher.disarm();
  }
  return sigintWatcher.hadSignal() ? 'interrupted' : 'passed';
}
function chunkToPayload(type, chunk) {
  if (chunk instanceof Buffer) return {
    type,
    buffer: chunk.toString('base64')
  };
  return {
    type,
    text: chunk
  };
}
function hasSomeBrowsers() {
  for (const browserName of ['chromium', 'webkit', 'firefox']) {
    try {
      _server.registry.findExecutable(browserName).executablePathOrDie('javascript');
      return true;
    } catch {}
  }
  return false;
}
async function installBrowsers() {
  const executables = _server.registry.defaultExecutables();
  await _server.registry.install(executables, false);
}
function printInternalError(e) {
  // eslint-disable-next-line no-console
  console.error('Internal error:', e);
}

// TODO: remove CT dependency.
async function resolveCtDirs(config) {
  const use = config.config.projects[0].use;
  const relativeTemplateDir = use.ctTemplateDir || 'playwright';
  const templateDir = await _fs.default.promises.realpath(_path.default.normalize(_path.default.join(config.configDir, relativeTemplateDir))).catch(() => undefined);
  if (!templateDir) return null;
  const outDir = use.ctCacheDir ? _path.default.resolve(config.configDir, use.ctCacheDir) : _path.default.resolve(templateDir, '.cache');
  return {
    outDir,
    templateDir
  };
}
async function clearCacheAndLogToConsole(config) {
  var _playwrightTest2;
  const override = (_playwrightTest2 = config.config['@playwright/test']) === null || _playwrightTest2 === void 0 || (_playwrightTest2 = _playwrightTest2['cli']) === null || _playwrightTest2 === void 0 ? void 0 : _playwrightTest2['clear-cache'];
  if (override) {
    await override(config);
    return;
  }
  await removeFolderAndLogToConsole(_compilationCache.cacheDir);
}
async function removeFolderAndLogToConsole(folder) {
  try {
    if (!_fs.default.existsSync(folder)) return;
    // eslint-disable-next-line no-console
    console.log(`Removing ${await _fs.default.promises.realpath(folder)}`);
    await _fs.default.promises.rm(folder, {
      recursive: true,
      force: true
    });
  } catch {}
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ElectronApplication = exports.Electron = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _crBrowser = require("../chromium/crBrowser");
var _crConnection = require("../chromium/crConnection");
var _crExecutionContext = require("../chromium/crExecutionContext");
var js = _interopRequireWildcard(require("../javascript"));
var _timeoutSettings = require("../../common/timeoutSettings");
var _utils = require("../../utils");
var _transport = require("../transport");
var _processLauncher = require("../../utils/processLauncher");
var _browserContext = require("../browserContext");
var _progress = require("../progress");
var _helper = require("../helper");
var _eventsHelper = require("../../utils/eventsHelper");
var readline = _interopRequireWildcard(require("readline"));
var _debugLogger = require("../../utils/debugLogger");
var _instrumentation = require("../instrumentation");
var _crProtocolHelper = require("../chromium/crProtocolHelper");
var _console = require("../console");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
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

const ARTIFACTS_FOLDER = _path.default.join(_os.default.tmpdir(), 'playwright-artifacts-');
class ElectronApplication extends _instrumentation.SdkObject {
  constructor(parent, browser, nodeConnection, process) {
    super(parent, 'electron-app');
    this._browserContext = void 0;
    this._nodeConnection = void 0;
    this._nodeSession = void 0;
    this._nodeExecutionContext = void 0;
    this._nodeElectronHandlePromise = new _utils.ManualPromise();
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings();
    this._process = void 0;
    this._process = process;
    this._browserContext = browser._defaultContext;
    this._nodeConnection = nodeConnection;
    this._nodeSession = nodeConnection.rootSession;
    this._nodeSession.on('Runtime.executionContextCreated', async event => {
      if (!event.context.auxData || !event.context.auxData.isDefault) return;
      const crExecutionContext = new _crExecutionContext.CRExecutionContext(this._nodeSession, event.context);
      this._nodeExecutionContext = new js.ExecutionContext(this, crExecutionContext, 'electron');
      const {
        result: remoteObject
      } = await crExecutionContext._client.send('Runtime.evaluate', {
        expression: `require('electron')`,
        contextId: event.context.id,
        // Needed after Electron 28 to get access to require: https://github.com/microsoft/playwright/issues/28048
        includeCommandLineAPI: true
      });
      this._nodeElectronHandlePromise.resolve(new js.JSHandle(this._nodeExecutionContext, 'object', 'ElectronModule', remoteObject.objectId));
    });
    this._nodeSession.on('Runtime.consoleAPICalled', event => this._onConsoleAPI(event));
    const appClosePromise = new Promise(f => this.once(ElectronApplication.Events.Close, f));
    this._browserContext.setCustomCloseHandler(async () => {
      await this._browserContext.stopVideoRecording();
      const electronHandle = await this._nodeElectronHandlePromise;
      await electronHandle.evaluate(({
        app
      }) => app.quit()).catch(() => {});
      this._nodeConnection.close();
      await appClosePromise;
    });
  }
  async _onConsoleAPI(event) {
    if (event.executionContextId === 0) {
      // DevTools protocol stores the last 1000 console messages. These
      // messages are always reported even for removed execution contexts. In
      // this case, they are marked with executionContextId = 0 and are
      // reported upon enabling Runtime agent.
      //
      // Ignore these messages since:
      // - there's no execution context we can use to operate with message
      //   arguments
      // - these messages are reported before Playwright clients can subscribe
      //   to the 'console'
      //   page event.
      //
      // @see https://github.com/GoogleChrome/puppeteer/issues/3865
      return;
    }
    if (!this._nodeExecutionContext) return;
    const args = event.args.map(arg => this._nodeExecutionContext.createHandle(arg));
    const message = new _console.ConsoleMessage(null, event.type, undefined, args, (0, _crProtocolHelper.toConsoleMessageLocation)(event.stackTrace));
    this.emit(ElectronApplication.Events.Console, message);
  }
  async initialize() {
    await this._nodeSession.send('Runtime.enable', {});
    // Delay loading the app until browser is started and the browser targets are configured to auto-attach.
    await this._nodeSession.send('Runtime.evaluate', {
      expression: '__playwright_run()'
    });
  }
  process() {
    return this._process;
  }
  context() {
    return this._browserContext;
  }
  async close() {
    // This will call BrowserContext.setCustomCloseHandler.
    await this._browserContext.close({
      reason: 'Application exited'
    });
  }
  async browserWindow(page) {
    // Assume CRPage as Electron is always Chromium.
    const targetId = page._delegate._targetId;
    const electronHandle = await this._nodeElectronHandlePromise;
    return await electronHandle.evaluateHandle(({
      BrowserWindow,
      webContents
    }, targetId) => {
      const wc = webContents.fromDevToolsTargetId(targetId);
      return BrowserWindow.fromWebContents(wc);
    }, targetId);
  }
}
exports.ElectronApplication = ElectronApplication;
ElectronApplication.Events = {
  Close: 'close',
  Console: 'console'
};
class Electron extends _instrumentation.SdkObject {
  constructor(playwright) {
    super(playwright, 'electron');
  }
  async launch(options) {
    const {
      args = []
    } = options;
    const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), this);
    controller.setLogName('browser');
    return controller.run(async progress => {
      let app = undefined;
      // --remote-debugging-port=0 must be the last playwright's argument, loader.ts relies on it.
      let electronArguments = ['--inspect=0', '--remote-debugging-port=0', ...args];
      if (_os.default.platform() === 'linux') {
        const runningAsRoot = process.geteuid && process.geteuid() === 0;
        if (runningAsRoot && electronArguments.indexOf('--no-sandbox') === -1) electronArguments.unshift('--no-sandbox');
      }
      const artifactsDir = await _fs.default.promises.mkdtemp(ARTIFACTS_FOLDER);
      const browserLogsCollector = new _debugLogger.RecentLogsCollector();
      const env = options.env ? (0, _processLauncher.envArrayToObject)(options.env) : process.env;
      let command;
      if (options.executablePath) {
        command = options.executablePath;
      } else {
        try {
          // By default we fallback to the Electron App executable path.
          // 'electron/index.js' resolves to the actual Electron App.
          command = require('electron/index.js');
        } catch (error) {
          if ((error === null || error === void 0 ? void 0 : error.code) === 'MODULE_NOT_FOUND') {
            throw new Error('\n' + (0, _utils.wrapInASCIIBox)(['Electron executablePath not found!', 'Please install it using `npm install -D electron` or set the executablePath to your Electron executable.'].join('\n'), 1));
          }
          throw error;
        }
        // Only use our own loader for non-packaged apps.
        // Packaged apps might have their own command line handling.
        electronArguments.unshift('-r', require.resolve('./loader'));
      }
      let shell = false;
      if (process.platform === 'win32') {
        // On Windows in order to run .cmd files, shell: true is required.
        // https://github.com/nodejs/node/issues/52554
        shell = true;
        // On Windows, we need to quote the executable path due to shell: true.
        command = `"${command}"`;
        // On Windows, we need to quote the arguments due to shell: true.
        electronArguments = electronArguments.map(arg => `"${arg}"`);
      }

      // When debugging Playwright test that runs Electron, NODE_OPTIONS
      // will make the debugger attach to Electron's Node. But Playwright
      // also needs to attach to drive the automation. Disable external debugging.
      delete env.NODE_OPTIONS;
      const {
        launchedProcess,
        gracefullyClose,
        kill
      } = await (0, _processLauncher.launchProcess)({
        command,
        args: electronArguments,
        env,
        log: message => {
          progress.log(message);
          browserLogsCollector.log(message);
        },
        shell,
        stdio: 'pipe',
        cwd: options.cwd,
        tempDirectories: [artifactsDir],
        attemptToGracefullyClose: () => app.close(),
        handleSIGINT: true,
        handleSIGTERM: true,
        handleSIGHUP: true,
        onExit: () => {
          var _app;
          return (_app = app) === null || _app === void 0 ? void 0 : _app.emit(ElectronApplication.Events.Close);
        }
      });

      // All waitForLines must be started immediately.
      // Otherwise the lines might come before we are ready.
      const waitForXserverError = new Promise(async (resolve, reject) => {
        waitForLine(progress, launchedProcess, /Unable to open X display/).then(() => reject(new Error(['Unable to open X display!', `================================`, 'Most likely this is because there is no X server available.', "Use 'xvfb-run' on Linux to launch your tests with an emulated display server.", "For example: 'xvfb-run npm run test:e2e'", `================================`, progress.metadata.log].join('\n')))).catch(() => {});
      });
      const nodeMatchPromise = waitForLine(progress, launchedProcess, /^Debugger listening on (ws:\/\/.*)$/);
      const chromeMatchPromise = waitForLine(progress, launchedProcess, /^DevTools listening on (ws:\/\/.*)$/);
      const debuggerDisconnectPromise = waitForLine(progress, launchedProcess, /Waiting for the debugger to disconnect\.\.\./);
      const nodeMatch = await nodeMatchPromise;
      const nodeTransport = await _transport.WebSocketTransport.connect(progress, nodeMatch[1]);
      const nodeConnection = new _crConnection.CRConnection(nodeTransport, _helper.helper.debugProtocolLogger(), browserLogsCollector);

      // Immediately release exiting process under debug.
      debuggerDisconnectPromise.then(() => {
        nodeTransport.close();
      }).catch(() => {});
      const chromeMatch = await Promise.race([chromeMatchPromise, waitForXserverError]);
      const chromeTransport = await _transport.WebSocketTransport.connect(progress, chromeMatch[1]);
      const browserProcess = {
        onclose: undefined,
        process: launchedProcess,
        close: gracefullyClose,
        kill
      };
      const contextOptions = {
        ...options,
        noDefaultViewport: true
      };
      const browserOptions = {
        name: 'electron',
        isChromium: true,
        headful: true,
        persistent: contextOptions,
        browserProcess,
        protocolLogger: _helper.helper.debugProtocolLogger(),
        browserLogsCollector,
        artifactsDir,
        downloadsPath: artifactsDir,
        tracesDir: options.tracesDir || artifactsDir,
        originalLaunchOptions: {}
      };
      (0, _browserContext.validateBrowserContextOptions)(contextOptions, browserOptions);
      const browser = await _crBrowser.CRBrowser.connect(this.attribution.playwright, chromeTransport, browserOptions);
      app = new ElectronApplication(this, browser, nodeConnection, launchedProcess);
      await app.initialize();
      return app;
    }, _timeoutSettings.TimeoutSettings.launchTimeout(options));
  }
}
exports.Electron = Electron;
function waitForLine(progress, process, regex) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({
      input: process.stderr
    });
    const failError = new Error('Process failed to launch!');
    const listeners = [_eventsHelper.eventsHelper.addEventListener(rl, 'line', onLine), _eventsHelper.eventsHelper.addEventListener(rl, 'close', reject.bind(null, failError)), _eventsHelper.eventsHelper.addEventListener(process, 'exit', reject.bind(null, failError)),
    // It is Ok to remove error handler because we did not create process and there is another listener.
    _eventsHelper.eventsHelper.addEventListener(process, 'error', reject.bind(null, failError))];
    progress.cleanupWhenAborted(cleanup);
    function onLine(line) {
      const match = line.match(regex);
      if (!match) return;
      cleanup();
      resolve(match);
    }
    function cleanup() {
      _eventsHelper.eventsHelper.removeEventListeners(listeners);
    }
  });
}
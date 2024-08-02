"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.kNoXServerRunningError = exports.BrowserType = void 0;
var _fs = _interopRequireDefault(require("fs"));
var os = _interopRequireWildcard(require("os"));
var _path = _interopRequireDefault(require("path"));
var _browserContext = require("./browserContext");
var _registry = require("./registry");
var _transport = require("./transport");
var _processLauncher = require("../utils/processLauncher");
var _pipeTransport = require("./pipeTransport");
var _progress = require("./progress");
var _timeoutSettings = require("../common/timeoutSettings");
var _utils = require("../utils");
var _fileUtils = require("../utils/fileUtils");
var _helper = require("./helper");
var _debugLogger = require("../utils/debugLogger");
var _instrumentation = require("./instrumentation");
var _manualPromise = require("../utils/manualPromise");
var _protocolError = require("./protocolError");
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
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const kNoXServerRunningError = exports.kNoXServerRunningError = 'Looks like you launched a headed browser without having a XServer running.\n' + 'Set either \'headless: true\' or use \'xvfb-run <your-playwright-app>\' before running Playwright.\n\n<3 Playwright Team';
class BrowserType extends _instrumentation.SdkObject {
  constructor(parent, browserName) {
    super(parent, 'browser-type');
    this._name = void 0;
    this.attribution.browserType = this;
    this._name = browserName;
  }
  executablePath() {
    return _registry.registry.findExecutable(this._name).executablePath(this.attribution.playwright.options.sdkLanguage) || '';
  }
  name() {
    return this._name;
  }
  async launch(metadata, options, protocolLogger) {
    options = this._validateLaunchOptions(options);
    const controller = new _progress.ProgressController(metadata, this);
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      const seleniumHubUrl = options.__testHookSeleniumRemoteURL || process.env.SELENIUM_REMOTE_URL;
      if (seleniumHubUrl) return this._launchWithSeleniumHub(progress, seleniumHubUrl, options);
      return this._innerLaunchWithRetries(progress, options, undefined, _helper.helper.debugProtocolLogger(protocolLogger)).catch(e => {
        throw this._rewriteStartupLog(e);
      });
    }, _timeoutSettings.TimeoutSettings.launchTimeout(options));
    return browser;
  }
  async launchPersistentContext(metadata, userDataDir, options) {
    options = this._validateLaunchOptions(options);
    const controller = new _progress.ProgressController(metadata, this);
    const persistent = options;
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      return this._innerLaunchWithRetries(progress, options, persistent, _helper.helper.debugProtocolLogger(), userDataDir).catch(e => {
        throw this._rewriteStartupLog(e);
      });
    }, _timeoutSettings.TimeoutSettings.launchTimeout(options));
    return browser._defaultContext;
  }
  async _innerLaunchWithRetries(progress, options, persistent, protocolLogger, userDataDir) {
    try {
      return await this._innerLaunch(progress, options, persistent, protocolLogger, userDataDir);
    } catch (error) {
      // @see https://github.com/microsoft/playwright/issues/5214
      const errorMessage = typeof error === 'object' && typeof error.message === 'string' ? error.message : '';
      if (errorMessage.includes('Inconsistency detected by ld.so')) {
        progress.log(`<restarting browser due to hitting race condition in glibc>`);
        return this._innerLaunch(progress, options, persistent, protocolLogger, userDataDir);
      }
      throw error;
    }
  }
  async _innerLaunch(progress, options, persistent, protocolLogger, maybeUserDataDir) {
    options.proxy = options.proxy ? (0, _browserContext.normalizeProxySettings)(options.proxy) : undefined;
    const browserLogsCollector = new _debugLogger.RecentLogsCollector();
    const {
      browserProcess,
      userDataDir,
      artifactsDir,
      transport
    } = await this._launchProcess(progress, options, !!persistent, browserLogsCollector, maybeUserDataDir);
    if (options.__testHookBeforeCreateBrowser) await options.__testHookBeforeCreateBrowser();
    const browserOptions = {
      name: this._name,
      isChromium: this._name === 'chromium',
      channel: options.channel,
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      artifactsDir,
      downloadsPath: options.downloadsPath || artifactsDir,
      tracesDir: options.tracesDir || artifactsDir,
      browserProcess,
      customExecutablePath: options.executablePath,
      proxy: options.proxy,
      protocolLogger,
      browserLogsCollector,
      wsEndpoint: options.useWebSocket ? transport.wsEndpoint : undefined,
      originalLaunchOptions: options
    };
    if (persistent) (0, _browserContext.validateBrowserContextOptions)(persistent, browserOptions);
    copyTestHooks(options, browserOptions);
    const browser = await this._connectToTransport(transport, browserOptions);
    browser._userDataDirForTest = userDataDir;
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    if (persistent && !options.ignoreAllDefaultArgs) await browser._defaultContext._loadDefaultContext(progress);
    return browser;
  }
  async _launchProcess(progress, options, isPersistent, browserLogsCollector, userDataDir) {
    var _options$args;
    const {
      ignoreDefaultArgs,
      ignoreAllDefaultArgs,
      args = [],
      executablePath = null,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true
    } = options;
    const env = options.env ? (0, _processLauncher.envArrayToObject)(options.env) : process.env;
    await this._createArtifactDirs(options);
    const tempDirectories = [];
    const artifactsDir = await _fs.default.promises.mkdtemp(_path.default.join(os.tmpdir(), 'playwright-artifacts-'));
    tempDirectories.push(artifactsDir);
    if (userDataDir) {
      // Firefox bails if the profile directory does not exist, Chrome creates it. We ensure consistent behavior here.
      if (!(await (0, _fileUtils.existsAsync)(userDataDir))) await _fs.default.promises.mkdir(userDataDir, {
        recursive: true,
        mode: 0o700
      });
    } else {
      userDataDir = await _fs.default.promises.mkdtemp(_path.default.join(os.tmpdir(), `playwright_${this._name}dev_profile-`));
      tempDirectories.push(userDataDir);
    }
    const browserArguments = [];
    if (ignoreAllDefaultArgs) browserArguments.push(...args);else if (ignoreDefaultArgs) browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));else browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir));
    let executable;
    if (executablePath) {
      if (!(await (0, _fileUtils.existsAsync)(executablePath))) throw new Error(`Failed to launch ${this._name} because executable doesn't exist at ${executablePath}`);
      executable = executablePath;
    } else {
      const registryExecutable = _registry.registry.findExecutable(options.channel || this._name);
      if (!registryExecutable || registryExecutable.browserName !== this._name) throw new Error(`Unsupported ${this._name} channel "${options.channel}"`);
      executable = registryExecutable.executablePathOrDie(this.attribution.playwright.options.sdkLanguage);
      await _registry.registry.validateHostRequirementsForExecutablesIfNeeded([registryExecutable], this.attribution.playwright.options.sdkLanguage);
    }
    const waitForWSEndpoint = options.useWebSocket || (_options$args = options.args) !== null && _options$args !== void 0 && _options$args.some(a => a.startsWith('--remote-debugging-port')) ? new _manualPromise.ManualPromise() : undefined;
    const waitForJuggler = this._name === 'firefox' ? new _manualPromise.ManualPromise() : undefined;
    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport = undefined;
    let browserProcess = undefined;
    const {
      launchedProcess,
      gracefullyClose,
      kill
    } = await (0, _processLauncher.launchProcess)({
      command: executable,
      args: browserArguments,
      env: this._amendEnvironment(env, userDataDir, executable, browserArguments),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      log: message => {
        if (waitForWSEndpoint) {
          const match = message.match(/DevTools listening on (.*)/);
          if (match) waitForWSEndpoint.resolve(match[1]);
        }
        if (waitForJuggler && message.includes('Juggler listening to the pipe')) waitForJuggler.resolve();
        progress.log(message);
        browserLogsCollector.log(message);
      },
      stdio: 'pipe',
      tempDirectories,
      attemptToGracefullyClose: async () => {
        if (options.__testHookGracefullyClose) await options.__testHookGracefullyClose();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        this._attemptToGracefullyCloseBrowser(transport);
      },
      onExit: (exitCode, signal) => {
        // Unblock launch when browser prematurely exits.
        waitForJuggler === null || waitForJuggler === void 0 || waitForJuggler.resolve();
        if (browserProcess && browserProcess.onclose) browserProcess.onclose(exitCode, signal);
      }
    });
    async function closeOrKill(timeout) {
      let timer;
      try {
        await Promise.race([gracefullyClose(), new Promise((resolve, reject) => timer = setTimeout(reject, timeout))]);
      } catch (ignored) {
        await kill().catch(ignored => {}); // Make sure to await actual process exit.
      } finally {
        clearTimeout(timer);
      }
    }
    browserProcess = {
      onclose: undefined,
      process: launchedProcess,
      close: () => closeOrKill(options.__testHookBrowserCloseTimeout || _timeoutSettings.DEFAULT_TIMEOUT),
      kill
    };
    progress.cleanupWhenAborted(() => closeOrKill(progress.timeUntilDeadline()));
    const wsEndpoint = await waitForWSEndpoint;
    await waitForJuggler;
    if (options.useWebSocket) {
      transport = await _transport.WebSocketTransport.connect(progress, wsEndpoint);
    } else {
      const stdio = launchedProcess.stdio;
      transport = new _pipeTransport.PipeTransport(stdio[3], stdio[4]);
    }
    return {
      browserProcess,
      artifactsDir,
      userDataDir,
      transport
    };
  }
  async _createArtifactDirs(options) {
    if (options.downloadsPath) await _fs.default.promises.mkdir(options.downloadsPath, {
      recursive: true
    });
    if (options.tracesDir) await _fs.default.promises.mkdir(options.tracesDir, {
      recursive: true
    });
  }
  async connectOverCDP(metadata, endpointURL, options, timeout) {
    throw new Error('CDP connections are only supported by Chromium');
  }
  async _launchWithSeleniumHub(progress, hubUrl, options) {
    throw new Error('Connecting to SELENIUM_REMOTE_URL is only supported by Chromium');
  }
  _validateLaunchOptions(options) {
    const {
      devtools = false
    } = options;
    let {
      headless = !devtools,
      downloadsPath,
      proxy
    } = options;
    if ((0, _utils.debugMode)()) headless = false;
    if (downloadsPath && !_path.default.isAbsolute(downloadsPath)) downloadsPath = _path.default.join(process.cwd(), downloadsPath);
    if (this.attribution.playwright.options.socksProxyPort) proxy = {
      server: `socks5://127.0.0.1:${this.attribution.playwright.options.socksProxyPort}`
    };
    return {
      ...options,
      devtools,
      headless,
      downloadsPath,
      proxy
    };
  }
  _createUserDataDirArgMisuseError(userDataDirArg) {
    switch (this.attribution.playwright.options.sdkLanguage) {
      case 'java':
        return new Error(`Pass userDataDir parameter to 'BrowserType.launchPersistentContext(userDataDir, options)' instead of specifying '${userDataDirArg}' argument`);
      case 'python':
        return new Error(`Pass user_data_dir parameter to 'browser_type.launch_persistent_context(user_data_dir, **kwargs)' instead of specifying '${userDataDirArg}' argument`);
      case 'csharp':
        return new Error(`Pass userDataDir parameter to 'BrowserType.LaunchPersistentContextAsync(userDataDir, options)' instead of specifying '${userDataDirArg}' argument`);
      default:
        return new Error(`Pass userDataDir parameter to 'browserType.launchPersistentContext(userDataDir, options)' instead of specifying '${userDataDirArg}' argument`);
    }
  }
  _rewriteStartupLog(error) {
    if (!(0, _protocolError.isProtocolError)(error)) return error;
    return this._doRewriteStartupLog(error);
  }
}
exports.BrowserType = BrowserType;
function copyTestHooks(from, to) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook')) to[key] = value;
  }
}
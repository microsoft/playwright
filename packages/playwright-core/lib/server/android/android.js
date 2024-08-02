"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AndroidDevice = exports.Android = void 0;
var _utilsBundle = require("../../utilsBundle");
var _events = require("events");
var _fs = _interopRequireDefault(require("fs"));
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("../../utils");
var _fileUtils = require("../../utils/fileUtils");
var _browserContext = require("../browserContext");
var _progress = require("../progress");
var _crBrowser = require("../chromium/crBrowser");
var _helper = require("../helper");
var _transport = require("../../protocol/transport");
var _debugLogger = require("../../utils/debugLogger");
var _processLauncher = require("../../utils/processLauncher");
var _timeoutSettings = require("../../common/timeoutSettings");
var _instrumentation = require("../instrumentation");
var _chromiumSwitches = require("../chromium/chromiumSwitches");
var _registry = require("../registry");
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

const ARTIFACTS_FOLDER = _path.default.join(_os.default.tmpdir(), 'playwright-artifacts-');
class Android extends _instrumentation.SdkObject {
  constructor(parent, backend) {
    super(parent, 'android');
    this._backend = void 0;
    this._devices = new Map();
    this._timeoutSettings = void 0;
    this._backend = backend;
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings();
  }
  setDefaultTimeout(timeout) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }
  async devices(options) {
    const devices = (await this._backend.devices(options)).filter(d => d.status === 'device');
    const newSerials = new Set();
    for (const d of devices) {
      newSerials.add(d.serial);
      if (this._devices.has(d.serial)) continue;
      const device = await AndroidDevice.create(this, d, options);
      this._devices.set(d.serial, device);
    }
    for (const d of this._devices.keys()) {
      if (!newSerials.has(d)) this._devices.delete(d);
    }
    return [...this._devices.values()];
  }
  _deviceClosed(device) {
    this._devices.delete(device.serial);
  }
}
exports.Android = Android;
class AndroidDevice extends _instrumentation.SdkObject {
  constructor(android, backend, model, options) {
    super(android, 'android-device');
    this._backend = void 0;
    this.model = void 0;
    this.serial = void 0;
    this._options = void 0;
    this._driverPromise = void 0;
    this._lastId = 0;
    this._callbacks = new Map();
    this._pollingWebViews = void 0;
    this._timeoutSettings = void 0;
    this._webViews = new Map();
    this._browserConnections = new Set();
    this._android = void 0;
    this._isClosed = false;
    this._android = android;
    this._backend = backend;
    this.model = model;
    this.serial = backend.serial;
    this._options = options;
    this._timeoutSettings = new _timeoutSettings.TimeoutSettings(android._timeoutSettings);
  }
  static async create(android, backend, options) {
    await backend.init();
    const model = await backend.runCommand('shell:getprop ro.product.model');
    const device = new AndroidDevice(android, backend, model.toString().trim(), options);
    await device._init();
    return device;
  }
  async _init() {
    await this._refreshWebViews();
    const poll = () => {
      this._pollingWebViews = setTimeout(() => this._refreshWebViews().then(poll).catch(() => {
        this.close().catch(() => {});
      }), 500);
    };
    poll();
  }
  setDefaultTimeout(timeout) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }
  async shell(command) {
    const result = await this._backend.runCommand(`shell:${command}`);
    await this._refreshWebViews();
    return result;
  }
  async open(command) {
    return await this._backend.open(`${command}`);
  }
  async screenshot() {
    return await this._backend.runCommand(`shell:screencap -p`);
  }
  async _driver() {
    if (this._isClosed) return;
    if (!this._driverPromise) this._driverPromise = this._installDriver();
    return this._driverPromise;
  }
  async _installDriver() {
    (0, _utilsBundle.debug)('pw:android')('Stopping the old driver');
    await this.shell(`am force-stop com.microsoft.playwright.androiddriver`);

    // uninstall and install driver on every execution
    if (!this._options.omitDriverInstall) {
      (0, _utilsBundle.debug)('pw:android')('Uninstalling the old driver');
      await this.shell(`cmd package uninstall com.microsoft.playwright.androiddriver`);
      await this.shell(`cmd package uninstall com.microsoft.playwright.androiddriver.test`);
      (0, _utilsBundle.debug)('pw:android')('Installing the new driver');
      const executable = _registry.registry.findExecutable('android');
      const packageManagerCommand = (0, _utils.getPackageManagerExecCommand)();
      for (const file of ['android-driver.apk', 'android-driver-target.apk']) {
        const fullName = _path.default.join(executable.directory, file);
        if (!_fs.default.existsSync(fullName)) throw new Error(`Please install Android driver apk using '${packageManagerCommand} playwright install android'`);
        await this.installApk(await _fs.default.promises.readFile(fullName));
      }
    } else {
      (0, _utilsBundle.debug)('pw:android')('Skipping the driver installation');
    }
    (0, _utilsBundle.debug)('pw:android')('Starting the new driver');
    this.shell('am instrument -w com.microsoft.playwright.androiddriver.test/androidx.test.runner.AndroidJUnitRunner').catch(e => (0, _utilsBundle.debug)('pw:android')(e));
    const socket = await this._waitForLocalAbstract('playwright_android_driver_socket');
    const transport = new _transport.PipeTransport(socket, socket, socket, 'be');
    transport.onmessage = message => {
      const response = JSON.parse(message);
      const {
        id,
        result,
        error
      } = response;
      const callback = this._callbacks.get(id);
      if (!callback) return;
      if (error) callback.reject(new Error(error));else callback.fulfill(result);
      this._callbacks.delete(id);
    };
    return transport;
  }
  async _waitForLocalAbstract(socketName) {
    let socket;
    (0, _utilsBundle.debug)('pw:android')(`Polling the socket localabstract:${socketName}`);
    while (!socket) {
      try {
        socket = await this._backend.open(`localabstract:${socketName}`);
      } catch (e) {
        await new Promise(f => setTimeout(f, 250));
      }
    }
    (0, _utilsBundle.debug)('pw:android')(`Connected to localabstract:${socketName}`);
    return socket;
  }
  async send(method, params = {}) {
    // Patch the timeout in!
    params.timeout = this._timeoutSettings.timeout(params);
    const driver = await this._driver();
    if (!driver) throw new Error('Device is closed');
    const id = ++this._lastId;
    const result = new Promise((fulfill, reject) => this._callbacks.set(id, {
      fulfill,
      reject
    }));
    driver.send(JSON.stringify({
      id,
      method,
      params
    }));
    return result;
  }
  async close() {
    if (this._isClosed) return;
    this._isClosed = true;
    if (this._pollingWebViews) clearTimeout(this._pollingWebViews);
    for (const connection of this._browserConnections) await connection.close();
    if (this._driverPromise) {
      const driver = await this._driver();
      driver === null || driver === void 0 || driver.close();
    }
    await this._backend.close();
    this._android._deviceClosed(this);
    this.emit(AndroidDevice.Events.Close);
  }
  async launchBrowser(pkg = 'com.android.chrome', options) {
    (0, _utilsBundle.debug)('pw:android')('Force-stopping', pkg);
    await this._backend.runCommand(`shell:am force-stop ${pkg}`);
    const socketName = (0, _utils.isUnderTest)() ? 'webview_devtools_remote_playwright_test' : 'playwright_' + (0, _utils.createGuid)() + '_devtools_remote';
    const commandLine = this._defaultArgs(options, socketName).join(' ');
    (0, _utilsBundle.debug)('pw:android')('Starting', pkg, commandLine);
    // encode commandLine to base64 to avoid issues (bash encoding) with special characters
    await this._backend.runCommand(`shell:echo "${Buffer.from(commandLine).toString('base64')}" | base64 -d > /data/local/tmp/chrome-command-line`);
    await this._backend.runCommand(`shell:am start -a android.intent.action.VIEW -d about:blank ${pkg}`);
    const browserContext = await this._connectToBrowser(socketName, options);
    await this._backend.runCommand(`shell:rm /data/local/tmp/chrome-command-line`);
    return browserContext;
  }
  _defaultArgs(options, socketName) {
    const chromeArguments = ['_', '--disable-fre', '--no-default-browser-check', `--remote-debugging-socket-name=${socketName}`, ..._chromiumSwitches.chromiumSwitches, ...this._innerDefaultArgs(options)];
    return chromeArguments;
  }
  _innerDefaultArgs(options) {
    const {
      args = [],
      proxy
    } = options;
    const chromeArguments = [];
    if (proxy) {
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      if (proxy.bypass) proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
      if (!process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK && !proxyBypassRules.includes('<-loopback>')) proxyBypassRules.push('<-loopback>');
      if (proxyBypassRules.length > 0) chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
    }
    chromeArguments.push(...args);
    return chromeArguments;
  }
  async connectToWebView(socketName) {
    const webView = this._webViews.get(socketName);
    if (!webView) throw new Error('WebView has been closed');
    return await this._connectToBrowser(socketName);
  }
  async _connectToBrowser(socketName, options = {}) {
    const socket = await this._waitForLocalAbstract(socketName);
    const androidBrowser = new AndroidBrowser(this, socket);
    await androidBrowser._init();
    this._browserConnections.add(androidBrowser);
    const artifactsDir = await _fs.default.promises.mkdtemp(ARTIFACTS_FOLDER);
    const cleanupArtifactsDir = async () => {
      const errors = await (0, _fileUtils.removeFolders)([artifactsDir]);
      for (let i = 0; i < (errors || []).length; ++i) (0, _utilsBundle.debug)('pw:android')(`exception while removing ${artifactsDir}: ${errors[i]}`);
    };
    _processLauncher.gracefullyCloseSet.add(cleanupArtifactsDir);
    socket.on('close', async () => {
      _processLauncher.gracefullyCloseSet.delete(cleanupArtifactsDir);
      cleanupArtifactsDir().catch(e => (0, _utilsBundle.debug)('pw:android')(`could not cleanup artifacts dir: ${e}`));
    });
    const browserOptions = {
      name: 'clank',
      isChromium: true,
      slowMo: 0,
      persistent: {
        ...options,
        noDefaultViewport: true
      },
      artifactsDir,
      downloadsPath: artifactsDir,
      tracesDir: artifactsDir,
      browserProcess: new ClankBrowserProcess(androidBrowser),
      proxy: options.proxy,
      protocolLogger: _helper.helper.debugProtocolLogger(),
      browserLogsCollector: new _debugLogger.RecentLogsCollector(),
      originalLaunchOptions: {}
    };
    (0, _browserContext.validateBrowserContextOptions)(options, browserOptions);
    const browser = await _crBrowser.CRBrowser.connect(this.attribution.playwright, androidBrowser, browserOptions);
    const controller = new _progress.ProgressController((0, _instrumentation.serverSideCallMetadata)(), this);
    const defaultContext = browser._defaultContext;
    await controller.run(async progress => {
      await defaultContext._loadDefaultContextAsIs(progress);
    });
    return defaultContext;
  }
  webViews() {
    return [...this._webViews.values()];
  }
  async installApk(content, options) {
    const args = options && options.args ? options.args : ['-r', '-t', '-S'];
    (0, _utilsBundle.debug)('pw:android')('Opening install socket');
    const installSocket = await this._backend.open(`shell:cmd package install ${args.join(' ')} ${content.length}`);
    (0, _utilsBundle.debug)('pw:android')('Writing driver bytes: ' + content.length);
    await installSocket.write(content);
    const success = await new Promise(f => installSocket.on('data', f));
    (0, _utilsBundle.debug)('pw:android')('Written driver bytes: ' + success);
    installSocket.close();
  }
  async push(content, path, mode = 0o644) {
    const socket = await this._backend.open(`sync:`);
    const sendHeader = async (command, length) => {
      const buffer = Buffer.alloc(command.length + 4);
      buffer.write(command, 0);
      buffer.writeUInt32LE(length, command.length);
      await socket.write(buffer);
    };
    const send = async (command, data) => {
      await sendHeader(command, data.length);
      await socket.write(data);
    };
    await send('SEND', Buffer.from(`${path},${mode}`));
    const maxChunk = 65535;
    for (let i = 0; i < content.length; i += maxChunk) await send('DATA', content.slice(i, i + maxChunk));
    await sendHeader('DONE', Date.now() / 1000 | 0);
    const result = await new Promise(f => socket.once('data', f));
    const code = result.slice(0, 4).toString();
    if (code !== 'OKAY') throw new Error('Could not push: ' + code);
    socket.close();
  }
  async _refreshWebViews() {
    // possible socketName, eg: webview_devtools_remote_32327, webview_devtools_remote_32327_zeus, webview_devtools_remote_zeus
    const sockets = (await this._backend.runCommand(`shell:cat /proc/net/unix | grep webview_devtools_remote`)).toString().split('\n');
    if (this._isClosed) return;
    const socketNames = new Set();
    for (const line of sockets) {
      const matchSocketName = line.match(/[^@]+@(.*?webview_devtools_remote_?.*)/);
      if (!matchSocketName) continue;
      const socketName = matchSocketName[1];
      socketNames.add(socketName);
      if (this._webViews.has(socketName)) continue;

      // possible line: 0000000000000000: 00000002 00000000 00010000 0001 01 5841881 @webview_devtools_remote_zeus
      // the result: match[1] = ''
      const match = line.match(/[^@]+@.*?webview_devtools_remote_?(\d*)/);
      let pid = -1;
      if (match && match[1]) pid = +match[1];
      const pkg = await this._extractPkg(pid);
      if (this._isClosed) return;
      const webView = {
        pid,
        pkg,
        socketName
      };
      this._webViews.set(socketName, webView);
      this.emit(AndroidDevice.Events.WebViewAdded, webView);
    }
    for (const p of this._webViews.keys()) {
      if (!socketNames.has(p)) {
        this._webViews.delete(p);
        this.emit(AndroidDevice.Events.WebViewRemoved, p);
      }
    }
  }
  async _extractPkg(pid) {
    let pkg = '';
    if (pid === -1) return pkg;
    const procs = (await this._backend.runCommand(`shell:ps -A | grep ${pid}`)).toString().split('\n');
    for (const proc of procs) {
      const match = proc.match(/[^\s]+\s+(\d+).*$/);
      if (!match) continue;
      pkg = proc.substring(proc.lastIndexOf(' ') + 1);
    }
    return pkg;
  }
}
exports.AndroidDevice = AndroidDevice;
AndroidDevice.Events = {
  WebViewAdded: 'webViewAdded',
  WebViewRemoved: 'webViewRemoved',
  Close: 'close'
};
class AndroidBrowser extends _events.EventEmitter {
  constructor(device, socket) {
    super();
    this.device = void 0;
    this._socket = void 0;
    this._receiver = void 0;
    this._waitForNextTask = (0, _utils.makeWaitForNextTask)();
    this.onmessage = void 0;
    this.onclose = void 0;
    this.setMaxListeners(0);
    this.device = device;
    this._socket = socket;
    this._socket.on('close', () => {
      this._waitForNextTask(() => {
        if (this.onclose) this.onclose();
      });
    });
    this._receiver = new _utilsBundle.wsReceiver();
    this._receiver.on('message', message => {
      this._waitForNextTask(() => {
        if (this.onmessage) this.onmessage(JSON.parse(message));
      });
    });
  }
  async _init() {
    await this._socket.write(Buffer.from(`GET /devtools/browser HTTP/1.1\r
Upgrade: WebSocket\r
Connection: Upgrade\r
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r
Sec-WebSocket-Version: 13\r
\r
`));
    // HTTP Upgrade response.
    await new Promise(f => this._socket.once('data', f));

    // Start sending web frame to receiver.
    this._socket.on('data', data => this._receiver._write(data, 'binary', () => {}));
  }
  async send(s) {
    await this._socket.write(encodeWebFrame(JSON.stringify(s)));
  }
  async close() {
    this._socket.close();
  }
}
function encodeWebFrame(data) {
  return _utilsBundle.wsSender.frame(Buffer.from(data), {
    opcode: 1,
    mask: true,
    fin: true,
    readOnly: true
  })[0];
}
class ClankBrowserProcess {
  constructor(browser) {
    this._browser = void 0;
    this.onclose = void 0;
    this._browser = browser;
  }
  async kill() {}
  async close() {
    await this._browser.close();
  }
}
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

import { debug } from '../../utilsBundle';
import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type * as stream from 'stream';
import { wsReceiver, wsSender } from '../../utilsBundle';
import { createGuid, makeWaitForNextTask, isUnderTest, getPackageManagerExecCommand } from '../../utils';
import { removeFolders } from '../../utils/fileUtils';
import type { BrowserOptions, BrowserProcess } from '../browser';
import type { BrowserContext } from '../browserContext';
import { validateBrowserContextOptions } from '../browserContext';
import { ProgressController } from '../progress';
import { CRBrowser } from '../chromium/crBrowser';
import { helper } from '../helper';
import { PipeTransport } from '../../protocol/transport';
import { RecentLogsCollector } from '../../utils/debugLogger';
import { gracefullyCloseSet } from '../../utils/processLauncher';
import { TimeoutSettings } from '../../common/timeoutSettings';
import type * as channels from '@protocol/channels';
import { SdkObject, serverSideCallMetadata } from '../instrumentation';
import { chromiumSwitches } from '../chromium/chromiumSwitches';
import { registry } from '../registry';

const ARTIFACTS_FOLDER = path.join(os.tmpdir(), 'playwright-artifacts-');

export interface Backend {
  devices(options: channels.AndroidDevicesOptions): Promise<DeviceBackend[]>;
}

export interface DeviceBackend {
  serial: string;
  status: string;
  close(): Promise<void>;
  init(): Promise<void>;
  runCommand(command: string): Promise<Buffer>;
  open(command: string): Promise<SocketBackend>;
}

export interface SocketBackend extends EventEmitter {
  guid: string;
  write(data: Buffer): Promise<void>;
  close(): void;
}

export class Android extends SdkObject {
  private _backend: Backend;
  private _devices = new Map<string, AndroidDevice>();
  readonly _timeoutSettings: TimeoutSettings;

  constructor(parent: SdkObject, backend: Backend) {
    super(parent, 'android');
    this._backend = backend;
    this._timeoutSettings = new TimeoutSettings();
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async devices(options: channels.AndroidDevicesOptions): Promise<AndroidDevice[]> {
    const devices = (await this._backend.devices(options)).filter(d => d.status === 'device');
    const newSerials = new Set<string>();
    for (const d of devices) {
      newSerials.add(d.serial);
      if (this._devices.has(d.serial))
        continue;
      const device = await AndroidDevice.create(this, d, options);
      this._devices.set(d.serial, device);
    }
    for (const d of this._devices.keys()) {
      if (!newSerials.has(d))
        this._devices.delete(d);
    }
    return [...this._devices.values()];
  }

  _deviceClosed(device: AndroidDevice) {
    this._devices.delete(device.serial);
  }
}

export class AndroidDevice extends SdkObject {
  readonly _backend: DeviceBackend;
  readonly model: string;
  readonly serial: string;
  private _options: channels.AndroidDevicesOptions;
  private _driverPromise: Promise<PipeTransport> | undefined;
  private _lastId = 0;
  private _callbacks = new Map<number, { fulfill: (result: any) => void, reject: (error: Error) => void }>();
  private _pollingWebViews: NodeJS.Timeout | undefined;
  readonly _timeoutSettings: TimeoutSettings;
  private _webViews = new Map<string, channels.AndroidWebView>();

  static Events = {
    WebViewAdded: 'webViewAdded',
    WebViewRemoved: 'webViewRemoved',
    Close: 'close',
  };

  private _browserConnections = new Set<AndroidBrowser>();
  readonly _android: Android;
  private _isClosed = false;

  constructor(android: Android, backend: DeviceBackend, model: string, options: channels.AndroidDevicesOptions) {
    super(android, 'android-device');
    this._android = android;
    this._backend = backend;
    this.model = model;
    this.serial = backend.serial;
    this._options = options;
    this._timeoutSettings = new TimeoutSettings(android._timeoutSettings);
  }

  static async create(android: Android, backend: DeviceBackend, options: channels.AndroidDevicesOptions): Promise<AndroidDevice> {
    await backend.init();
    const model = await backend.runCommand('shell:getprop ro.product.model');
    const device = new AndroidDevice(android, backend, model.toString().trim(), options);
    await device._init();
    return device;
  }

  async _init() {
    await this._refreshWebViews();
    const poll = () => {
      this._pollingWebViews = setTimeout(() => this._refreshWebViews()
          .then(poll)
          .catch(() => {
            this.close().catch(() => {});
          }), 500);
    };
    poll();
  }

  setDefaultTimeout(timeout: number) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async shell(command: string): Promise<Buffer> {
    const result = await this._backend.runCommand(`shell:${command}`);
    await this._refreshWebViews();
    return result;
  }

  async open(command: string): Promise<SocketBackend> {
    return await this._backend.open(`${command}`);
  }

  async screenshot(): Promise<Buffer> {
    return await this._backend.runCommand(`shell:screencap -p`);
  }

  private async _driver(): Promise<PipeTransport | undefined> {
    if (this._isClosed)
      return;
    if (!this._driverPromise)
      this._driverPromise = this._installDriver();
    return this._driverPromise;
  }

  private async _installDriver(): Promise<PipeTransport> {
    debug('pw:android')('Stopping the old driver');
    await this.shell(`am force-stop com.microsoft.playwright.androiddriver`);

    // uninstall and install driver on every execution
    if (!this._options.omitDriverInstall) {
      debug('pw:android')('Uninstalling the old driver');
      await this.shell(`cmd package uninstall com.microsoft.playwright.androiddriver`);
      await this.shell(`cmd package uninstall com.microsoft.playwright.androiddriver.test`);

      debug('pw:android')('Installing the new driver');
      const executable = registry.findExecutable('android')!;
      const packageManagerCommand = getPackageManagerExecCommand();
      for (const file of ['android-driver.apk', 'android-driver-target.apk']) {
        const fullName = path.join(executable.directory!, file);
        if (!fs.existsSync(fullName))
          throw new Error(`Please install Android driver apk using '${packageManagerCommand} playwright install android'`);
        await this.installApk(await fs.promises.readFile(fullName));
      }
    } else {
      debug('pw:android')('Skipping the driver installation');
    }

    debug('pw:android')('Starting the new driver');
    this.shell('am instrument -w com.microsoft.playwright.androiddriver.test/androidx.test.runner.AndroidJUnitRunner').catch(e => debug('pw:android')(e));
    const socket = await this._waitForLocalAbstract('playwright_android_driver_socket');
    const transport = new PipeTransport(socket, socket, socket, 'be');
    transport.onmessage = message => {
      const response = JSON.parse(message);
      const { id, result, error } = response;
      const callback = this._callbacks.get(id);
      if (!callback)
        return;
      if (error)
        callback.reject(new Error(error));
      else
        callback.fulfill(result);
      this._callbacks.delete(id);
    };
    return transport;
  }

  private async _waitForLocalAbstract(socketName: string): Promise<SocketBackend> {
    let socket: SocketBackend | undefined;
    debug('pw:android')(`Polling the socket localabstract:${socketName}`);
    while (!socket) {
      try {
        socket = await this._backend.open(`localabstract:${socketName}`);
      } catch (e) {
        await new Promise(f => setTimeout(f, 250));
      }
    }
    debug('pw:android')(`Connected to localabstract:${socketName}`);
    return socket;
  }

  async send(method: string, params: any = {}): Promise<any> {
    // Patch the timeout in!
    params.timeout = this._timeoutSettings.timeout(params);
    const driver = await this._driver();
    if (!driver)
      throw new Error('Device is closed');
    const id = ++this._lastId;
    const result = new Promise((fulfill, reject) => this._callbacks.set(id, { fulfill, reject }));
    driver.send(JSON.stringify({ id, method, params }));
    return result;
  }

  async close() {
    if (this._isClosed)
      return;
    this._isClosed = true;
    if (this._pollingWebViews)
      clearTimeout(this._pollingWebViews);
    for (const connection of this._browserConnections)
      await connection.close();
    if (this._driverPromise) {
      const driver = await this._driver();
      driver?.close();
    }
    await this._backend.close();
    this._android._deviceClosed(this);
    this.emit(AndroidDevice.Events.Close);
  }

  async launchBrowser(pkg: string = 'com.android.chrome', options: channels.AndroidDeviceLaunchBrowserParams): Promise<BrowserContext> {
    debug('pw:android')('Force-stopping', pkg);
    await this._backend.runCommand(`shell:am force-stop ${pkg}`);
    const socketName = isUnderTest() ? 'webview_devtools_remote_playwright_test' : ('playwright_' + createGuid() + '_devtools_remote');
    const commandLine = this._defaultArgs(options, socketName).join(' ');
    debug('pw:android')('Starting', pkg, commandLine);
    // encode commandLine to base64 to avoid issues (bash encoding) with special characters
    await this._backend.runCommand(`shell:echo "${Buffer.from(commandLine).toString('base64')}" | base64 -d > /data/local/tmp/chrome-command-line`);
    await this._backend.runCommand(`shell:am start -a android.intent.action.VIEW -d about:blank ${pkg}`);
    const browserContext = await this._connectToBrowser(socketName, options);
    await this._backend.runCommand(`shell:rm /data/local/tmp/chrome-command-line`);
    return browserContext;
  }

  private _defaultArgs(options: channels.AndroidDeviceLaunchBrowserParams, socketName: string): string[] {
    const chromeArguments = [
      '_',
      '--disable-fre',
      '--no-default-browser-check',
      `--remote-debugging-socket-name=${socketName}`,
      ...chromiumSwitches,
      ...this._innerDefaultArgs(options)
    ];
    return chromeArguments;
  }

  private _innerDefaultArgs(options: channels.AndroidDeviceLaunchBrowserParams): string[] {
    const { args = [], proxy } = options;
    const chromeArguments = [];
    if (proxy) {
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      const proxyBypassRules = [];
      if (proxy.bypass)
        proxyBypassRules.push(...proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t));
      if (!process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK && !proxyBypassRules.includes('<-loopback>'))
        proxyBypassRules.push('<-loopback>');
      if (proxyBypassRules.length > 0)
        chromeArguments.push(`--proxy-bypass-list=${proxyBypassRules.join(';')}`);
    }
    chromeArguments.push(...args);
    return chromeArguments;
  }

  async connectToWebView(socketName: string): Promise<BrowserContext> {
    const webView = this._webViews.get(socketName);
    if (!webView)
      throw new Error('WebView has been closed');
    return await this._connectToBrowser(socketName);
  }

  private async _connectToBrowser(socketName: string, options: channels.BrowserNewContextParams = {}): Promise<BrowserContext> {
    const socket = await this._waitForLocalAbstract(socketName);
    const androidBrowser = new AndroidBrowser(this, socket);
    await androidBrowser._init();
    this._browserConnections.add(androidBrowser);

    const artifactsDir = await fs.promises.mkdtemp(ARTIFACTS_FOLDER);
    const cleanupArtifactsDir = async () => {
      const errors = await removeFolders([artifactsDir]);
      for (let i = 0; i < (errors || []).length; ++i)
        debug('pw:android')(`exception while removing ${artifactsDir}: ${errors[i]}`);
    };
    gracefullyCloseSet.add(cleanupArtifactsDir);
    socket.on('close', async () => {
      gracefullyCloseSet.delete(cleanupArtifactsDir);
      cleanupArtifactsDir().catch(e => debug('pw:android')(`could not cleanup artifacts dir: ${e}`));
    });
    const browserOptions: BrowserOptions = {
      name: 'clank',
      isChromium: true,
      slowMo: 0,
      persistent: { ...options, noDefaultViewport: true },
      artifactsDir,
      downloadsPath: artifactsDir,
      tracesDir: artifactsDir,
      browserProcess: new ClankBrowserProcess(androidBrowser),
      proxy: options.proxy,
      protocolLogger: helper.debugProtocolLogger(),
      browserLogsCollector: new RecentLogsCollector(),
      originalLaunchOptions: {},
    };
    validateBrowserContextOptions(options, browserOptions);

    const browser = await CRBrowser.connect(this.attribution.playwright, androidBrowser, browserOptions);
    const controller = new ProgressController(serverSideCallMetadata(), this);
    const defaultContext = browser._defaultContext!;
    await controller.run(async progress => {
      await defaultContext._loadDefaultContextAsIs(progress);
    });
    return defaultContext;
  }

  webViews(): channels.AndroidWebView[] {
    return [...this._webViews.values()];
  }

  async installApk(content: Buffer, options?: { args?: string[] }): Promise<void> {
    const args = options && options.args ? options.args : ['-r', '-t', '-S'];
    debug('pw:android')('Opening install socket');
    const installSocket = await this._backend.open(`shell:cmd package install ${args.join(' ')} ${content.length}`);
    debug('pw:android')('Writing driver bytes: ' + content.length);
    await installSocket.write(content);
    const success = await new Promise(f => installSocket.on('data', f));
    debug('pw:android')('Written driver bytes: ' + success);
    installSocket.close();
  }

  async push(content: Buffer, path: string, mode = 0o644): Promise<void> {
    const socket = await this._backend.open(`sync:`);
    const sendHeader = async (command: string, length: number) => {
      const buffer = Buffer.alloc(command.length + 4);
      buffer.write(command, 0);
      buffer.writeUInt32LE(length, command.length);
      await socket.write(buffer);
    };
    const send = async (command: string, data: Buffer) => {
      await sendHeader(command, data.length);
      await socket.write(data);
    };
    await send('SEND', Buffer.from(`${path},${mode}`));
    const maxChunk = 65535;
    for (let i = 0; i < content.length; i += maxChunk)
      await send('DATA', content.slice(i, i + maxChunk));
    await sendHeader('DONE', (Date.now() / 1000) | 0);
    const result = await new Promise<Buffer>(f => socket.once('data', f));
    const code = result.slice(0, 4).toString();
    if (code !== 'OKAY')
      throw new Error('Could not push: ' + code);
    socket.close();
  }

  private async _refreshWebViews() {
    // possible socketName, eg: webview_devtools_remote_32327, webview_devtools_remote_32327_zeus, webview_devtools_remote_zeus
    const sockets = (await this._backend.runCommand(`shell:cat /proc/net/unix | grep webview_devtools_remote`)).toString().split('\n');
    if (this._isClosed)
      return;

    const socketNames = new Set<string>();
    for (const line of sockets) {
      const matchSocketName = line.match(/[^@]+@(.*?webview_devtools_remote_?.*)/);
      if (!matchSocketName)
        continue;

      const socketName = matchSocketName[1];
      socketNames.add(socketName);
      if (this._webViews.has(socketName))
        continue;

      // possible line: 0000000000000000: 00000002 00000000 00010000 0001 01 5841881 @webview_devtools_remote_zeus
      // the result: match[1] = ''
      const match = line.match(/[^@]+@.*?webview_devtools_remote_?(\d*)/);
      let pid = -1;
      if (match && match[1])
        pid = +match[1];

      const pkg = await this._extractPkg(pid);
      if (this._isClosed)
        return;

      const webView = { pid, pkg, socketName };
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

  private async _extractPkg(pid: number) {
    let pkg = '';
    if (pid === -1)
      return pkg;

    const procs = (await this._backend.runCommand(`shell:ps -A | grep ${pid}`)).toString().split('\n');
    for (const proc of procs) {
      const match = proc.match(/[^\s]+\s+(\d+).*$/);
      if (!match)
        continue;
      pkg = proc.substring(proc.lastIndexOf(' ') + 1);
    }
    return pkg;
  }
}

class AndroidBrowser extends EventEmitter {
  readonly device: AndroidDevice;
  private _socket: SocketBackend;
  private _receiver: stream.Writable;
  private _waitForNextTask = makeWaitForNextTask();
  onmessage?: (message: any) => void;
  onclose?: () => void;

  constructor(device: AndroidDevice, socket: SocketBackend) {
    super();
    this.setMaxListeners(0);
    this.device = device;
    this._socket = socket;
    this._socket.on('close', () => {
      this._waitForNextTask(() => {
        if (this.onclose)
          this.onclose();
      });
    });
    this._receiver = new wsReceiver() as stream.Writable;
    this._receiver.on('message', message => {
      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage(JSON.parse(message));
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
    await new Promise(f => this._socket!.once('data', f));

    // Start sending web frame to receiver.
    this._socket.on('data', data => this._receiver._write(data, 'binary', () => {}));
  }

  async send(s: any) {
    await this._socket!.write(encodeWebFrame(JSON.stringify(s)));
  }

  async close() {
    this._socket!.close();
  }
}

function encodeWebFrame(data: string): Buffer {
  return wsSender.frame(Buffer.from(data), {
    opcode: 1,
    mask: true,
    fin: true,
    readOnly: true
  })[0];
}

class ClankBrowserProcess implements BrowserProcess {
  private _browser: AndroidBrowser;

  constructor(browser: AndroidBrowser) {
    this._browser = browser;
  }

  onclose: ((exitCode: number | null, signal: string | null) => void) | undefined;

  async kill(): Promise<void> {
  }

  async close(): Promise<void> {
    await this._browser.close();
  }
}



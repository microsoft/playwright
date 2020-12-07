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

import * as debug from 'debug';
import * as types from '../types';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as stream from 'stream';
import * as util from 'util';
import * as ws from 'ws';
import { createGuid, makeWaitForNextTask } from '../../utils/utils';
import { BrowserOptions, BrowserProcess } from '../browser';
import { BrowserContext, validateBrowserContextOptions } from '../browserContext';
import { ProgressController } from '../progress';
import { CRBrowser } from '../chromium/crBrowser';
import { helper } from '../helper';
import { Transport } from '../../protocol/transport';
import { RecentLogsCollector } from '../../utils/debugLogger';

const readFileAsync = util.promisify(fs.readFile);

export interface Backend {
  devices(): Promise<DeviceBackend[]>;
}

export interface DeviceBackend {
  serial: string;
  close(): Promise<void>;
  init(): Promise<void>;
  runCommand(command: string): Promise<string>;
  open(command: string): Promise<SocketBackend>;
}

export interface SocketBackend extends EventEmitter {
  write(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export class Android {
  private _backend: Backend;

  constructor(backend: Backend) {
    this._backend = backend;
  }

  async devices(): Promise<AndroidDevice[]> {
    const devices = await this._backend.devices();
    return await Promise.all(devices.map(d => AndroidDevice.create(d)));
  }
}

export class AndroidDevice {
  readonly _backend: DeviceBackend;
  readonly model: string;
  readonly serial: string;
  private _driverPromise: Promise<Transport> | undefined;
  private _lastId = 0;
  private _callbacks = new Map<number, { fulfill: (result: any) => void, reject: (error: Error) => void }>();

  constructor(backend: DeviceBackend, model: string) {
    this._backend = backend;
    this.model = model;
    this.serial = backend.serial;
  }

  static async create(backend: DeviceBackend): Promise<AndroidDevice> {
    await backend.init();
    const model = await backend.runCommand('shell:getprop ro.product.model');
    return new AndroidDevice(backend, model);
  }

  async shell(command: string): Promise<string> {
    return await this._backend.runCommand(`shell:${command}`);
  }

  private async _driver(): Promise<Transport> {
    if (this._driverPromise)
      return this._driverPromise;
    let callback: any;
    this._driverPromise = new Promise(f => callback = f);

    debug('pw:android')('Stopping the old driver');
    await this.shell(`am force-stop com.microsoft.playwright.androiddriver`);

    debug('pw:android')('Uninstalling the old driver');
    await this.shell(`cmd package uninstall com.microsoft.playwright.androiddriver`);
    await this.shell(`cmd package uninstall com.microsoft.playwright.androiddriver.test`);

    debug('pw:android')('Installing the new driver');
    for (const file of ['android-driver.apk', 'android-driver-target.apk']) {
      const driverFile = await readFileAsync(require.resolve(`../../../bin/${file}`));
      const installSocket = await this._backend.open(`shell:cmd package install -r -t -S ${driverFile.length}`);
      debug('pw:android')('Writing driver bytes: ' + driverFile.length);
      await installSocket.write(driverFile);
      const success = await new Promise(f => installSocket.on('data', f));
      debug('pw:android')('Written driver bytes: ' + success);
    }

    debug('pw:android')('Starting the new driver');
    this.shell(`am instrument -w com.microsoft.playwright.androiddriver.test/androidx.test.runner.AndroidJUnitRunner`);

    debug('pw:android')('Polling the socket');
    let socket;
    while (!socket) {
      try {
        socket = await this._backend.open(`localabstract:playwright_android_driver_socket`);
      } catch (e)  {
        await new Promise(f => setTimeout(f, 100));
      }
    }

    debug('pw:android')('Connected to driver');
    const transport = new Transport(socket, socket, socket, 'be');
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

    callback(transport);
    return this._driverPromise;
  }

  async send(method: string, params: any): Promise<any> {
    const driver = await this._driver();
    const id = ++this._lastId;
    const result = new Promise((fulfill, reject) => this._callbacks.set(id, { fulfill, reject }));
    driver.send(JSON.stringify({ id, method, params }));
    return result;
  }

  async close() {
    const driver = await this._driver();
    driver.close();
    await this._backend.close();
  }

  async launchBrowser(packageName: string = 'com.android.chrome', options: types.BrowserContextOptions = {}): Promise<BrowserContext> {
    debug('pw:android')('Force-stopping', packageName);
    await this._backend.runCommand(`shell:am force-stop ${packageName}`);

    const socketName = createGuid();
    const commandLine = `_ --disable-fre --no-default-browser-check --no-first-run --remote-debugging-socket-name=${socketName}`;
    debug('pw:android')('Starting', packageName, commandLine);
    await this._backend.runCommand(`shell:echo "${commandLine}" > /data/local/tmp/chrome-command-line`);
    await this._backend.runCommand(`shell:am start -n ${packageName}/com.google.android.apps.chrome.Main about:blank`);

    debug('pw:android')('Polling for socket', socketName);
    while (true) {
      const net = await this._backend.runCommand(`shell:cat /proc/net/unix | grep ${socketName}$`);
      if (net)
        break;
      await new Promise(f => setTimeout(f, 100));
    }
    debug('pw:android')('Got the socket, connecting');
    const androidBrowser = new AndroidBrowser(this, packageName, socketName);
    await androidBrowser._open();

    const browserOptions: BrowserOptions = {
      name: 'clank',
      slowMo: 0,
      persistent: { ...options, noDefaultViewport: true },
      downloadsPath: undefined,
      browserProcess: new ClankBrowserProcess(androidBrowser),
      proxy: options.proxy,
      protocolLogger: helper.debugProtocolLogger(),
      browserLogsCollector: new RecentLogsCollector()
    };
    validateBrowserContextOptions(options, browserOptions);

    const browser = await CRBrowser.connect(androidBrowser, browserOptions);
    const controller = new ProgressController();
    await controller.run(async progress => {
      await browser._defaultContext!._loadDefaultContext(progress);
    });
    return browser._defaultContext!;
  }
}

class AndroidBrowser extends EventEmitter {
  readonly device: AndroidDevice;
  readonly socketName: string;
  private _socket: SocketBackend | undefined;
  private _receiver: stream.Writable;
  private _waitForNextTask = makeWaitForNextTask();
  onmessage?: (message: any) => void;
  onclose?: () => void;
  private _packageName: string;

  constructor(device: AndroidDevice, packageName: string, socketName: string) {
    super();
    this._packageName = packageName;
    this.device = device;
    this.socketName = socketName;
    this._receiver = new (ws as any).Receiver() as stream.Writable;
    this._receiver.on('message', message => {
      this._waitForNextTask(() => {
        if (this.onmessage)
          this.onmessage(JSON.parse(message));
      });
    });
  }

  async _open() {
    this._socket = await this.device._backend.open(`localabstract:${this.socketName}`);
    this._socket.on('close', () => {
      this._waitForNextTask(() => {
        if (this.onclose)
          this.onclose();
      });
    });
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
    await this._socket!.close();
    await this.device._backend.runCommand(`shell:am force-stop ${this._packageName}`);
  }
}

function encodeWebFrame(data: string): Buffer {
  return (ws as any).Sender.frame(Buffer.from(data), {
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

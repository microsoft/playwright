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
import { EventEmitter } from 'events';
import * as stream from 'stream';
import * as ws from 'ws';
import { createGuid, makeWaitForNextTask } from '../../utils/utils';

export interface Backend {
  devices(): Promise<DeviceBackend[]>;
}

export interface DeviceBackend {
  close(): Promise<void>;
  init(): Promise<void>;
  runCommand(command: string): Promise<string>;
  open(command: string): Promise<SocketBackend>;
}

export interface SocketBackend extends EventEmitter {
  write(data: Buffer): Promise<void>;
  close(): Promise<void>;
}

export class AndroidClient {
  backend: Backend;

  constructor(backend: Backend) {
    this.backend = backend;
  }

  async devices(): Promise<AndroidDevice[]> {
    const devices = await this.backend.devices();
    return devices.map(b => new AndroidDevice(b));
  }
}

export class AndroidDevice {
  readonly backend: DeviceBackend;
  private _model: string | undefined;

  constructor(backend: DeviceBackend) {
    this.backend = backend;
  }

  async init() {
    await this.backend.init();
    this._model = await this.backend.runCommand('shell:getprop ro.product.model');
  }

  async close() {
    await this.backend.close();
  }

  async launchBrowser(packageName: string): Promise<AndroidBrowser> {
    debug('pw:android')('Force-stopping', packageName);
    await this.backend.runCommand(`shell:am force-stop ${packageName}`);

    const socketName = createGuid();
    const commandLine = `_ --disable-fre --no-default-browser-check --no-first-run --remote-debugging-socket-name=${socketName}`;
    debug('pw:android')('Starting', packageName, commandLine);
    await this.backend.runCommand(`shell:echo "${commandLine}" > /data/local/tmp/chrome-command-line`);
    await this.backend.runCommand(`shell:am start -n ${packageName}/com.google.android.apps.chrome.Main about:blank`);

    debug('pw:android')('Polling for socket', socketName);
    while (true) {
      const net = await this.backend.runCommand(`shell:cat /proc/net/unix | grep ${socketName}$`);
      if (net)
        break;
      await new Promise(f => setTimeout(f, 100));
    }
    debug('pw:android')('Got the socket, connecting');
    const browser = new AndroidBrowser(this, packageName, socketName);
    await browser._open();
    return browser;
  }

  model(): string | undefined {
    return this._model;
  }
}

export class AndroidBrowser extends EventEmitter {
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
    this._socket = await this.device.backend.open(`localabstract:${this.socketName}`);
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
    await this.device.backend.runCommand(`shell:am force-stop ${this._packageName}`);
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

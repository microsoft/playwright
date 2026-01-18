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

import net from 'net';

import { debug } from 'playwright-core/lib/utilsBundle';

const daemonDebug = debug('pw:daemon');

export class SocketConnection {
  private _socket: net.Socket;
  private _pendingBuffers: Buffer[] = [];

  onclose?: () => void;
  onmessage?: (message: any) => void;

  constructor(socket: net.Socket) {
    this._socket = socket;
    socket.on('data', buffer => this._onData(buffer));
    socket.on('close', () => {
      this.onclose?.();
    });
    socket.on('error', e => daemonDebug(`error: ${e.message}`));
  }

  async send(message: any) {
    await new Promise((resolve, reject) => {
      this._socket.write(`${JSON.stringify(message)}\n`, error => {
        if (error)
          reject(error);
        else
          resolve(undefined);
      });
    });
  }

  close() {
    this._socket.destroy();
  }

  private _onData(buffer: Buffer) {
    let end = buffer.indexOf('\n');
    if (end === -1) {
      this._pendingBuffers.push(buffer);
      return;
    }
    this._pendingBuffers.push(buffer.slice(0, end));
    const message = Buffer.concat(this._pendingBuffers).toString();
    this._dispatchMessage(message);

    let start = end + 1;
    end = buffer.indexOf('\n', start);
    while (end !== -1) {
      const message = buffer.toString(undefined, start, end);
      this._dispatchMessage(message);
      start = end + 1;
      end = buffer.indexOf('\n', start);
    }
    this._pendingBuffers = [buffer.slice(start)];
  }

  private _dispatchMessage(message: string) {
    try {
      this.onmessage?.(JSON.parse(message));
    } catch (e) {
      daemonDebug('failed to dispatch message', e);
    }
  }
}

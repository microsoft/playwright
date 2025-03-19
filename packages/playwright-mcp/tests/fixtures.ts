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

import { spawn } from 'child_process';
import EventEmitter from 'events';

import type { ChildProcess } from 'child_process';

export class MCPServer extends EventEmitter {
  private _child: ChildProcess;
  private _messageQueue: any[] = [];
  private _messageResolvers: ((value: any) => void)[] = [];
  private _buffer: string = '';

  constructor(command: string, args: string[]) {
    super();
    this._child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._child.stdout?.on('data', data => {
      this._buffer += data.toString();
      let newlineIndex: number;

      while ((newlineIndex = this._buffer.indexOf('\n')) !== -1) {
        const message = this._buffer.slice(0, newlineIndex).trim();
        this._buffer = this._buffer.slice(newlineIndex + 1);

        if (!message)
          continue;

        const parsed = JSON.parse(message);
        if (this._messageResolvers.length > 0) {
          const resolve = this._messageResolvers.shift();
          resolve!(parsed);
        } else {
          this._messageQueue.push(parsed);
        }
      }
    });

    this._child.stderr?.on('data', data => {
      throw new Error('Server stderr:', data.toString());
    });

    this._child.on('exit', code => {
      if (code !== 0)
        throw new Error(`Server exited with code ${code}`);
    });
  }

  async send(message: any, options?: { timeout?: number }): Promise<void> {
    await this.sendNoReply(message);
    return this._waitForResponse(options || {});
  }

  async sendNoReply(message: any): Promise<void> {
    const jsonMessage = JSON.stringify(message) + '\n';
    await new Promise<void>((resolve, reject) => {
      this._child.stdin?.write(jsonMessage, err => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }

  private async _waitForResponse(options: { timeout?: number }): Promise<any> {
    if (this._messageQueue.length > 0)
      return this._messageQueue.shift();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for message'));
      }, options.timeout || 5000);

      this._messageResolvers.push(message => {
        clearTimeout(timeoutId);
        resolve(message);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise(resolve => {
      this._child.on('exit', () => resolve());
      this._child.stdin?.end();
    });
  }
}

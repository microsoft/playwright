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

import { ChildProcess } from 'child_process';
import { helper } from '../helper';
import { EventEmitter } from 'events';

export class WebSocketWrapper {
  readonly wsEndpoint: string;
  private _bindings: (Map<any, any> | Set<any>)[];

  constructor(wsEndpoint: string, bindings: (Map<any, any>|Set<any>)[]) {
    this.wsEndpoint = wsEndpoint;
    this._bindings = bindings;
  }

  async checkLeaks() {
    let counter = 0;
    return new Promise((fulfill, reject) => {
      const check = () => {
        const filtered = this._bindings.filter(entry => entry.size);
        if (!filtered.length) {
          fulfill();
          return;
        }

        if (++counter >= 50) {
          reject(new Error('Web socket leak ' + filtered.map(entry => [...entry.keys()].join(':')).join('|')));
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }
}

export class BrowserServer extends EventEmitter {
  private _process: ChildProcess;
  private _gracefullyClose: () => Promise<void>;
  private _kill: () => Promise<void>;
  _webSocketWrapper: WebSocketWrapper | null = null;

  constructor(process: ChildProcess, gracefullyClose: () => Promise<void>, kill: () => Promise<void>) {
    super();
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._kill = kill;
  }

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string {
    return this._webSocketWrapper ? this._webSocketWrapper.wsEndpoint : '';
  }

  async kill(): Promise<void> {
    await this._kill();
  }

  async close(): Promise<void> {
    await this._gracefullyClose();
  }

  async _checkLeaks(): Promise<void> {
    if (this._webSocketWrapper)
      await this._webSocketWrapper.checkLeaks();
  }

  async _closeOrKill(deadline: number): Promise<void> {
    try {
      await helper.waitWithDeadline(this.close(), '', deadline, ''); // The error message is ignored.
    } catch (ignored) {
      await this.kill(); // Make sure to await actual process exit.
    }
  }
}

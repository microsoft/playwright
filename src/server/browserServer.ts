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

import { ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { helper } from '../helper';
import { RootLogger } from '../logger';
import { TimeoutSettings } from '../timeoutSettings';
import { LaunchOptions } from './browserType';

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
  private _process: ChildProcess | undefined;
  private _gracefullyClose: (() => Promise<void>) | undefined;
  private _webSocketWrapper: WebSocketWrapper | null = null;
  readonly _launchOptions: LaunchOptions;
  readonly _logger: RootLogger;
  readonly _launchDeadline: number;

  constructor(options: LaunchOptions) {
    super();
    this._launchOptions = options;
    this._logger = new RootLogger(options.logger);
    this._launchDeadline = TimeoutSettings.computeDeadline(typeof options.timeout === 'number' ? options.timeout : 30000);
  }

  _initialize(process: ChildProcess, gracefullyClose: () => Promise<void>, webSocketWrapper: WebSocketWrapper | null) {
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._webSocketWrapper = webSocketWrapper;
  }

  _isInitialized(): boolean {
    return !!this._process;
  }

  process(): ChildProcess {
    return this._process!;
  }

  wsEndpoint(): string {
    return this._webSocketWrapper ? this._webSocketWrapper.wsEndpoint : '';
  }

  kill() {
    if (this._process!.pid && !this._process!.killed) {
      try {
        if (process.platform === 'win32')
          execSync(`taskkill /pid ${this._process!.pid} /T /F`);
        else
          process.kill(-this._process!.pid, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    }
  }

  async close(): Promise<void> {
    await this._gracefullyClose!();
  }

  async _checkLeaks(): Promise<void> {
    if (this._webSocketWrapper)
      await this._webSocketWrapper.checkLeaks();
  }

  async _initializeOrClose<T>(init: () => Promise<T>): Promise<T> {
    try {
      let promise: Promise<T>;
      if ((this._launchOptions as any).__testHookBeforeCreateBrowser)
        promise = (this._launchOptions as any).__testHookBeforeCreateBrowser().then(init);
      else
        promise = init();
      const result = await helper.waitWithDeadline(promise, 'the browser to launch', this._launchDeadline, 'pw:browser*');
      this._logger.stopLaunchRecording();
      return result;
    } catch (e) {
      e.message += '\n=============== Process output during launch: ===============\n' +
          this._logger.stopLaunchRecording() +
          '\n=============================================================';
      await this._closeOrKill();
      throw e;
    }
  }

  private async _closeOrKill(): Promise<void> {
    try {
      await helper.waitWithDeadline(this.close(), '', this._launchDeadline, ''); // The error message is ignored.
    } catch (ignored) {
      this.kill();
    }
  }
}

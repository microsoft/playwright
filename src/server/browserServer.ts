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
import { EventEmitter } from 'events';

export class BrowserServer extends EventEmitter {
  private _process: ChildProcess;
  private _gracefullyClose: () => Promise<void>;
  private _kill: () => Promise<void>;

  constructor(process: ChildProcess, gracefullyClose: () => Promise<void>, kill: () => Promise<void>) {
    super();
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._kill = kill;
  }

  process(): ChildProcess {
    return this._process;
  }

  async kill(): Promise<void> {
    await this._kill();
  }

  async close(): Promise<void> {
    await this._gracefullyClose();
  }

  async _closeOrKill(timeout: number): Promise<void> {
    let timer: NodeJS.Timer;
    try {
      await Promise.race([
        this.close(),
        new Promise((resolve, reject) => timer = setTimeout(reject, timeout)),
      ]);
    } catch (ignored) {
      await this.kill().catch(ignored => {}); // Make sure to await actual process exit.
    } finally {
      clearTimeout(timer!);
    }
  }
}

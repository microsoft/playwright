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
import * as platform from '../platform';

export class BrowserServer extends platform.EventEmitter {
  private _process: ChildProcess;
  private _gracefullyClose: () => Promise<void>;
  private _browserWSEndpoint: string | null = null;

  constructor(process: ChildProcess, gracefullyClose: () => Promise<void>, wsEndpoint: string | null) {
    super();
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._browserWSEndpoint = wsEndpoint;
  }

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string | null {
    return this._browserWSEndpoint;
  }

  kill() {
    if (this._process.pid && !this._process.killed) {
      try {
        if (process.platform === 'win32')
          execSync(`taskkill /pid ${this._process.pid} /T /F`);
        else
          process.kill(-this._process.pid, 'SIGKILL');
      } catch (e) {
        // the process might have already stopped
      }
    }
  }

  async close(): Promise<void> {
    await this._gracefullyClose();
  }
}

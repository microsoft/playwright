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
import { ConnectOptions } from '../browser';

export class BrowserApp {
  private _process: ChildProcess;
  private _gracefullyClose: () => Promise<void>;
  private _connectOptions: ConnectOptions;

  constructor(process: ChildProcess, gracefullyClose: () => Promise<void>, connectOptions: ConnectOptions) {
    this._process = process;
    this._gracefullyClose = gracefullyClose;
    this._connectOptions = connectOptions;
  }

  process(): ChildProcess {
    return this._process;
  }

  wsEndpoint(): string | null {
    return this._connectOptions.browserWSEndpoint || null;
  }

  connectOptions(): ConnectOptions {
    return this._connectOptions;
  }

  async close(): Promise<void> {
    await this._gracefullyClose();
  }
}

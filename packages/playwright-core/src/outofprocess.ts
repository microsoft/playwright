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

import { Connection } from './client/connection';
import { IpcTransport } from './protocol/transport';
import type { Playwright } from './client/playwright';
import * as childProcess from 'child_process';
import * as path from 'path';
import { ManualPromise } from './utils/manualPromise';

export async function start(env: any = {}): Promise<{ playwright: Playwright, stop: () => Promise<void> }> {
  const client = new PlaywrightClient(env);
  const playwright = await client._playwright;
  (playwright as any).driverProcess = client._driverProcess;
  return { playwright, stop: () => client.stop() };
}

class PlaywrightClient {
  _playwright: Promise<Playwright>;
  _driverProcess: childProcess.ChildProcess;
  private _closePromise = new ManualPromise<void>();
  private _transport: IpcTransport;
  private _stopped = false;

  constructor(env: any) {
    this._driverProcess = childProcess.fork(path.join(__dirname, 'cli', 'cli.js'), ['run-driver'], {
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
      detached: true,
      env: {
        ...process.env,
        ...env
      },
    });
    this._driverProcess.unref();
    this._driverProcess.on('exit', this._onExit.bind(this));

    const connection = new Connection();
    this._transport = new IpcTransport(this._driverProcess);
    connection.onmessage = message => this._transport.send(JSON.stringify(message));
    this._transport.onmessage = message => connection.dispatch(JSON.parse(message));
    this._transport.onclose = () => this._closePromise.resolve();

    this._playwright = connection.initializePlaywright();
  }

  async stop() {
    this._stopped = true;
    this._transport.close();
    await this._closePromise;
  }

  private _onExit(exitCode: number | null, signal: string | null) {
    if (this._stopped)
      this._closePromise.resolve();
    else
      throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
  }

}

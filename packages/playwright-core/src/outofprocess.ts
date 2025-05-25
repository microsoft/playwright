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

import * as childProcess from 'child_process';
import path from 'path';

import { Connection } from './client/connection';
import { PipeTransport } from './server/utils/pipeTransport';
import { ManualPromise } from './utils/isomorphic/manualPromise';
import { nodePlatform } from './server/utils/nodePlatform';

import type { Playwright } from './client/playwright';


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

  constructor(env: any) {
    this._driverProcess = childProcess.fork(path.join(__dirname, '..', 'cli.js'), ['run-driver'], {
      stdio: 'pipe',
      detached: true,
      env: {
        ...process.env,
        ...env
      },
    });
    this._driverProcess.unref();
    this._driverProcess.stderr!.on('data', data => process.stderr.write(data));

    const connection = new Connection(nodePlatform);
    const transport = new PipeTransport(this._driverProcess.stdin!, this._driverProcess.stdout!);
    connection.onmessage = message => transport.send(JSON.stringify(message));
    transport.onmessage = message => connection.dispatch(JSON.parse(message));
    transport.onclose = () => this._closePromise.resolve();

    this._playwright = connection.initializePlaywright();
  }

  async stop() {
    this._driverProcess.stdin!.destroy();
    this._driverProcess.stdout!.destroy();
    this._driverProcess.stderr!.destroy();
    await this._closePromise;
  }
}

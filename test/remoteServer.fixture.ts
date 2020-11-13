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

import { folio as base } from './fixtures';

import path from 'path';
import { spawn } from 'child_process';
import type { BrowserType, Browser, LaunchOptions } from '..';

type ServerFixtures = {
  remoteServer: RemoteServer;
  clusterRemoteServer: RemoteServer;
};
const fixtures = base.extend<ServerFixtures>();

fixtures.remoteServer.init(async ({ browserType, browserOptions }, run) => {
  const remoteServer = new RemoteServer();
  await remoteServer._start(browserType, browserOptions);
  await run(remoteServer);
  await remoteServer.close();
});

fixtures.clusterRemoteServer.init(async ({ browserType, browserOptions }, run) => {
  const remoteServer = new RemoteServer();
  await remoteServer._start(browserType, browserOptions, { inCluster: true });
  await run(remoteServer);
  await remoteServer.close();
});

export const folio = fixtures.build();

const playwrightPath = path.join(__dirname, '..');

export class RemoteServer {
  private _output: Map<string, string>;
  private _outputCallback: Map<string, () => void>;
  private _child: import('child_process').ChildProcess;
  private _exitPromise: Promise<{ exitCode: number | null, signal: string | null }>;
  private _didExit: boolean;
  private _wsEndpoint: string;
  private _browserPid: number;
  private _watchdogPid: number;

  async _start(browserType: BrowserType<Browser>, browserOptions: LaunchOptions, extraOptions?: any) {
    this._output = new Map();
    this._outputCallback = new Map();
    this._didExit = false;

    const launchOptions = {...browserOptions,
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
      executablePath: browserOptions.executablePath || browserType.executablePath(),
      logger: undefined,
    };
    const options = {
      playwrightPath,
      browserTypeName: browserType.name(),
      launchOptions,
    };
    this._child = spawn('node', [path.join(__dirname, 'fixtures', 'closeme.js'), JSON.stringify(options)], { env: process.env });
    this._child.on('error', (...args) => console.log('ERROR', ...args));
    this._exitPromise = new Promise(resolve => this._child.on('exit', (exitCode, signal) => {
      this._didExit = true;
      resolve({ exitCode, signal });
    }));

    let outputString = '';
    this._child.stdout.on('data', data => {
      outputString += data.toString();
      // Uncomment to debug.
      // console.log(data.toString());
      let match: RegExpMatchArray | null;
      while ((match = outputString.match(/\(([^()]+)=>([^()]+)\)/))) {
        const key = match[1];
        const value = match[2];
        this._addOutput(key, value);
        outputString = outputString.substring(match.index + match[0].length);
      }
    });
    this._child.stderr.on('data', data => {
      console.log(data.toString());
    });

    this._wsEndpoint = await this.out('wsEndpoint');
    this._browserPid = Number(await this.out('pid'));
    this._watchdogPid = Number(await this.out('watchdogPid'));
  }

  _addOutput(key: string, value: string) {
    this._output.set(key, value);
    const cb = this._outputCallback.get(key);
    this._outputCallback.delete(key);
    if (cb)
      cb();
  }

  async out(key: string): Promise<string> {
    if (!this._output.has(key))
      await new Promise(f => this._outputCallback.set(key, f));
    return this._output.get(key)!;
  }

  wsEndpoint() {
    return this._wsEndpoint;
  }

  browserPid() {
    return this._browserPid;
  }

  watchdogPid() {
    return this._watchdogPid;
  }

  child() {
    return this._child;
  }

  async childExitStatus() {
    return await this._exitPromise;
  }

  async close() {
    if (!this._didExit)
      this._child.kill();
    await this.childExitStatus();
  }
}

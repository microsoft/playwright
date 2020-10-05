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

import { fixtures as baseFixtures } from './fixtures';

import path from 'path';
import { spawn } from 'child_process';
import type { BrowserType, Browser, LaunchOptions } from '..';

type ServerFixtures = {
  remoteServer: RemoteServer;
  stallingRemoteServer: RemoteServer;
};

export const serverFixtures = baseFixtures.defineTestFixtures<ServerFixtures>({
  remoteServer: async ({ browserType, defaultBrowserOptions }, test) => {
    const remoteServer = new RemoteServer();
    await remoteServer._start(browserType, defaultBrowserOptions);
    await test(remoteServer);
    await remoteServer.close();
  },

  stallingRemoteServer: async ({ browserType, defaultBrowserOptions }, test) => {
    const remoteServer = new RemoteServer();
    await remoteServer._start(browserType, defaultBrowserOptions, { stallOnClose: true });
    await test(remoteServer);
    await remoteServer.close();
  },
});

const playwrightPath = path.join(__dirname, '..');

export class RemoteServer {
  _output: Map<any, any>;
  _outputCallback: Map<any, any>;
  _browserType: BrowserType<Browser>;
  _child: import('child_process').ChildProcess;
  _exitPromise: Promise<unknown>;
  _exitAndDisconnectPromise: Promise<any>;
  _browser: Browser;
  _didExit: boolean;
  _wsEndpoint: string;

  async _start(browserType: BrowserType<Browser>, defaultBrowserOptions: LaunchOptions, extraOptions?: { stallOnClose: boolean; }) {
    this._output = new Map();
    this._outputCallback = new Map();
    this._didExit = false;

    this._browserType = browserType;
    const launchOptions = {...defaultBrowserOptions,
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
      executablePath: defaultBrowserOptions.executablePath || browserType.executablePath(),
      logger: undefined,
    };
    const options = {
      playwrightPath,
      browserTypeName: browserType.name(),
      launchOptions,
      ...extraOptions,
    };
    this._child = spawn('node', [path.join(__dirname, 'fixtures', 'closeme.js'), JSON.stringify(options)]);
    this._child.on('error', (...args) => console.log('ERROR', ...args));
    this._exitPromise = new Promise(resolve => this._child.on('exit', (exitCode, signal) => {
      this._didExit = true;
      resolve(exitCode);
    }));

    let outputString = '';
    this._child.stdout.on('data', data => {
      outputString += data.toString();
      // Uncomment to debug.
      // console.log(data.toString());
      let match;
      while ((match = outputString.match(/\(([^()]+)=>([^()]+)\)/))) {
        const key = match[1];
        const value = match[2];
        this._addOutput(key, value);
        outputString = outputString.substring(match.index + match[0].length);
      }
    });

    this._wsEndpoint = await this.out('wsEndpoint');
  }

  _addOutput(key, value) {
    this._output.set(key, value);
    const cb = this._outputCallback.get(key);
    this._outputCallback.delete(key);
    if (cb)
      cb();
  }

  async out(key) {
    if (!this._output.has(key))
      await new Promise(f => this._outputCallback.set(key, f));
    return this._output.get(key);
  }

  wsEndpoint() {
    return this._wsEndpoint;
  }

  child() {
    return this._child;
  }

  async childExitCode() {
    return await this._exitPromise;
  }

  async close() {
    if (!this._didExit)
      this._child.kill();
    return await this.childExitCode();
  }
}

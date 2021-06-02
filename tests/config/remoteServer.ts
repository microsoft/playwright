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

import path from 'path';
import { spawn } from 'child_process';
import type { BrowserType, Browser, LaunchOptions } from '../../index';

const playwrightPath = path.join(__dirname, '..', '..');

export type RemoteServerOptions = {
  stallOnClose?: boolean;
  disconnectOnSIGHUP?: boolean;
  inCluster?: boolean;
  url?: string;
};

export class RemoteServer {
  _output: Map<any, any>;
  _outputCallback: Map<any, any>;
  _browserType: BrowserType;
  _child: import('child_process').ChildProcess;
  _exitPromise: Promise<unknown>;
  _exitAndDisconnectPromise: Promise<any>;
  _browser: Browser;
  _didExit: boolean;
  _wsEndpoint: string;

  async _start(browserType: BrowserType, browserOptions: LaunchOptions, remoteServerOptions: RemoteServerOptions = {}) {
    this._output = new Map();
    this._outputCallback = new Map();
    this._didExit = false;

    this._browserType = browserType;
    // Copy options to prevent a large JSON string when launching subprocess.
    // Otherwise, we get `Error: spawn ENAMETOOLONG` on Windows.
    const launchOptions: LaunchOptions = {
      args: browserOptions.args,
      headless: browserOptions.headless,
      channel: browserOptions.channel,
      tracesDir: browserOptions.tracesDir,
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
      executablePath: browserOptions.channel ? undefined : browserOptions.executablePath || browserType.executablePath(),
      logger: undefined,
    };
    const options = {
      playwrightPath,
      browserTypeName: browserType.name(),
      launchOptions,
      ...remoteServerOptions,
    };
    this._child = spawn('node', [path.join(__dirname, 'remote-server-impl.js'), JSON.stringify(options)], { env: process.env });
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
    this._child.stderr.on('data', data => {
      console.log(data.toString());
    });

    this._wsEndpoint = await this.out('wsEndpoint');

    if (remoteServerOptions.url) {
      this._browser = await this._browserType.connect({ wsEndpoint: this._wsEndpoint });
      const page = await this._browser.newPage();
      await page.goto(remoteServerOptions.url);
    }
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
    if (this._browser) {
      await this._browser.close();
      this._browser = undefined;
    }
    if (!this._didExit)
      this._child.kill();
    return await this.childExitCode();
  }
}

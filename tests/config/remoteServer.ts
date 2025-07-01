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
import type { BrowserType, Browser } from 'playwright-core';
import type { CommonFixtures, TestChildProcess } from './commonFixtures';

export interface PlaywrightServer {
  wsEndpoint(): string;
  close(): Promise<void>;
}

export class RunServer implements PlaywrightServer {
  private _process!: TestChildProcess;
  _wsEndpoint!: string;

  async start(childProcess: CommonFixtures['childProcess'], mode?: 'extension' | 'default', env?: NodeJS.ProcessEnv) {
    const command = ['node', path.join(__dirname, '..', '..', 'packages', 'playwright-core', 'cli.js'), 'run-server'];
    if (mode === 'extension')
      command.push('--mode=extension');
    this._process = childProcess({
      command,
      env: {
        ...process.env,
        ...env,
      },
    });

    let wsEndpointCallback: (value: string) => void;
    const wsEndpointPromise = new Promise<string>(f => wsEndpointCallback = f);
    this._process.onOutput = data => {
      const prefix = 'Listening on ';
      const line = data.toString();
      if (line.startsWith(prefix))
        wsEndpointCallback(line.substr(prefix.length));
    };

    this._wsEndpoint = await wsEndpointPromise;
  }

  wsEndpoint() {
    return this._wsEndpoint;
  }

  async close() {
    await this._process.kill('SIGINT');
  }
}

export type RemoteServerOptions = {
  stallOnClose?: boolean;
  disconnectOnSIGHUP?: boolean;
  exitOnFile?: string;
  exitOnWarning?: boolean;
  inCluster?: boolean;
  url?: string;
  startStopAndRunHttp?: boolean;
  sharedBrowser?: boolean;
};

export class RemoteServer implements PlaywrightServer {
  private _process!: TestChildProcess;
  readonly _output = new Map<string, string>();
  readonly _outputCallback = new Map<string, () => void>();
  _browserType!: BrowserType;
  _exitAndDisconnectPromise: Promise<any> | undefined;
  _browser: Browser | undefined;
  _wsEndpoint!: string;

  async _start(childProcess: CommonFixtures['childProcess'], browserType: BrowserType, channel: string, remoteServerOptions: RemoteServerOptions = {}) {
    this._browserType = browserType;
    const browserOptions = (browserType as any)._playwright._defaultLaunchOptions;
    // Copy options to prevent a large JSON string when launching subprocess.
    // Otherwise, we get `Error: spawn ENAMETOOLONG` on Windows.
    const launchOptions: Parameters<BrowserType['launchServer']>[0] = {
      args: browserOptions.args,
      headless: browserOptions.headless,
      channel: browserOptions.channel,
      executablePath: browserOptions.executablePath,
      handleSIGINT: true,
      handleSIGTERM: true,
      handleSIGHUP: true,
      logger: undefined,
    };
    if (remoteServerOptions.sharedBrowser)
      (launchOptions as any)._sharedBrowser = true;
    const options = {
      browserTypeName: browserType.name(),
      channel,
      launchOptions,
      ...remoteServerOptions,
    };
    this._process = childProcess({
      command: ['node', path.join(__dirname, 'remote-server-impl.js'), JSON.stringify(options)],
    });

    let index = 0;
    this._process.onOutput = () => {
      let match;
      while ((match = this._process.output.substring(index).match(/\(([^()]+)=>([^()]+)\)/))) {
        const key = match[1];
        const value = match[2];
        this._addOutput(key, value);
        index += match.index! + match[0].length;
      }
    };

    this._wsEndpoint = await this.out('wsEndpoint');

    if (remoteServerOptions.url) {
      this._browser = await this._browserType.connect({ wsEndpoint: this._wsEndpoint });
      const page = await this._browser.newPage();
      await page.goto(remoteServerOptions.url);
    }
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
      await new Promise<void>(f => this._outputCallback.set(key, f));
    return this._output.get(key)!;
  }

  wsEndpoint() {
    return this._wsEndpoint;
  }

  child() {
    return this._process.process;
  }

  async childExitCode() {
    return await this._process.exitCode;
  }

  async childSignal() {
    return (await this._process.exited).signal;
  }

  async close() {
    if (this._browser) {
      await this._browser.close();
      this._browser = undefined;
    }
    await this._process.kill('SIGINT');
    await this.childExitCode();
  }
}

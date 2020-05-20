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

import { BrowserContext } from '../browserContext';
import { BrowserServer } from './browserServer';
import * as browserPaths from '../install/browserPaths';
import { Logger, RootLogger } from '../logger';
import { ConnectionTransport, WebSocketTransport } from '../transport';
import { BrowserBase, BrowserOptions, Browser } from '../browser';
import { assert } from '../helper';

export type BrowserArgOptions = {
  headless?: boolean,
  args?: string[],
  devtools?: boolean,
};

type LaunchOptionsBase = BrowserArgOptions & {
  executablePath?: string,
  ignoreDefaultArgs?: boolean | string[],
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  logger?: Logger,
  env?: {[key: string]: string|number|boolean}
};

export function processBrowserArgOptions(options: LaunchOptionsBase): { devtools: boolean, headless: boolean } {
  const { devtools = false, headless = !devtools } = options;
  return { devtools, headless };
}

export type ConnectOptions = {
  wsEndpoint: string,
  slowMo?: number,
  logger?: Logger,
};
export type LaunchType = 'local' | 'server' | 'persistent';
export type LaunchOptions = LaunchOptionsBase & { slowMo?: number };
export type LaunchServerOptions = LaunchOptionsBase & { port?: number };

export interface BrowserType {
  executablePath(): string;
  name(): string;
  launch(options?: LaunchOptions): Promise<Browser>;
  launchServer(options?: LaunchServerOptions): Promise<BrowserServer>;
  launchPersistentContext(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext>;
  connect(options: ConnectOptions): Promise<Browser>;
}

export abstract class BrowserTypeBase implements BrowserType {
  private _name: string;
  private _executablePath: string | undefined;
  readonly _browserPath: string;

  constructor(packagePath: string, browser: browserPaths.BrowserDescriptor) {
    this._name = browser.name;
    const browsersPath = browserPaths.browsersPath(packagePath);
    this._browserPath = browserPaths.browserDirectory(browsersPath, browser);
    this._executablePath = browserPaths.executablePath(this._browserPath, browser);
  }

  executablePath(): string {
    if (!this._executablePath)
      throw new Error('Browser is not supported on current platform');
    return this._executablePath;
  }

  name(): string {
    return this._name;
  }

  async launch(options: LaunchOptions = {}): Promise<Browser> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    const browserServer = new BrowserServer(options);
    const { transport, downloadsPath } = await this._launchServer(options, 'local', browserServer);
    return await browserServer._initializeOrClose(async () => {
      return this._connectToServer(browserServer, false, transport!, downloadsPath);
    });
  }

  async launchPersistentContext(userDataDir: string, options: LaunchOptions = {}): Promise<BrowserContext> {
    const browserServer = new BrowserServer(options);
    const { transport, downloadsPath } = await this._launchServer(options, 'persistent', browserServer, userDataDir);

    return await browserServer._initializeOrClose(async () => {
      const browser = await this._connectToServer(browserServer, true, transport!, downloadsPath);
      const context = browser._defaultContext!;
      if (!options.ignoreDefaultArgs || Array.isArray(options.ignoreDefaultArgs))
        await context._loadDefaultContext();
      return context;
    });
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    const browserServer = new BrowserServer(options);
    await this._launchServer(options, 'server', browserServer);
    return browserServer;
  }

  async connect(options: ConnectOptions): Promise<Browser> {
    const logger = new RootLogger(options.logger);
    return await WebSocketTransport.connect(options.wsEndpoint, async transport => {
      if ((options as any).__testHookBeforeCreateBrowser)
        await (options as any).__testHookBeforeCreateBrowser();
      return this._connectToTransport(transport, { slowMo: options.slowMo, logger, downloadsPath: '' });
    }, logger);
  }

  abstract _launchServer(options: LaunchServerOptions, launchType: LaunchType, browserServer: BrowserServer, userDataDir?: string): Promise<{ transport?: ConnectionTransport, downloadsPath: string }>;
  abstract _connectToServer(browserServer: BrowserServer, persistent: boolean, transport: ConnectionTransport, downloadsPath: string): Promise<BrowserBase>;
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BrowserBase>;
}

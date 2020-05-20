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
import { assert, helper } from '../helper';
import { TimeoutSettings } from '../timeoutSettings';

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
  timeout?: number,
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
    return this._innerLaunch('local', options);
  }

  async launchPersistentContext(userDataDir: string, options: LaunchOptions = {}): Promise<BrowserContext> {
    const browser = await this._innerLaunch('persistent', options, userDataDir);
    return browser._defaultContext!;
  }

  async _innerLaunch(launchType: LaunchType, options: LaunchOptions, userDataDir?: string): Promise<BrowserBase> {
    const deadline = TimeoutSettings.computeDeadline(options.timeout, 30000);
    const logger = new RootLogger(options.logger);
    logger.startLaunchRecording();

    let browserServer: BrowserServer | undefined;
    try {
      browserServer = await this._launchServer(options, launchType, logger, deadline, userDataDir);
      const promise = this._innerLaunchPromise(browserServer, launchType, options);
      const browser = await helper.waitWithDeadline(promise, 'the browser to launch', deadline, 'pw:browser*');
      return browser;
    } catch (e) {
      e.message += '\n=============== Process output during launch: ===============\n' +
          logger.launchRecording() +
          '\n=============================================================';
      if (browserServer)
        await browserServer._closeOrKill(deadline);
      throw e;
    } finally {
      logger.stopLaunchRecording();
    }
  }

  async _innerLaunchPromise(browserServer: BrowserServer, launchType: LaunchType, options: LaunchOptions): Promise<BrowserBase> {
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();

    const browser = await this._connectToServer(browserServer, launchType === 'persistent');
    if (launchType === 'persistent' && (!options.ignoreDefaultArgs || Array.isArray(options.ignoreDefaultArgs))) {
      const context = browser._defaultContext!;
      await context._loadDefaultContext();
    }
    return browser;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    const logger = new RootLogger(options.logger);
    return this._launchServer(options, 'server', logger, TimeoutSettings.computeDeadline(options.timeout, 30000));
  }

  async connect(options: ConnectOptions): Promise<Browser> {
    const deadline = TimeoutSettings.computeDeadline(options.timeout, 30000);
    const logger = new RootLogger(options.logger);
    logger.startLaunchRecording();

    let transport: ConnectionTransport | undefined;
    try {
      transport = await WebSocketTransport.connect(options.wsEndpoint, logger, deadline);
      const promise = this._innerConnectPromise(transport, options, logger);
      const browser = await helper.waitWithDeadline(promise, 'connect to browser', deadline, 'pw:browser*');
      logger.stopLaunchRecording();
      return browser;
    } catch (e) {
      e.message += '\n=============== Process output during connect: ===============\n' +
          logger.launchRecording() +
          '\n=============================================================';
      try {
        if (transport)
          transport.close();
      } catch (e) {
      }
      throw e;
    } finally {
      logger.stopLaunchRecording();
    }
  }

  async _innerConnectPromise(transport: ConnectionTransport, options: ConnectOptions, logger: RootLogger): Promise<Browser> {
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();
    return this._connectToTransport(transport, { slowMo: options.slowMo, logger, downloadsPath: '' });
  }

  abstract _launchServer(options: LaunchServerOptions, launchType: LaunchType, logger: RootLogger, deadline: number, userDataDir?: string): Promise<BrowserServer>;
  abstract _connectToServer(browserServer: BrowserServer, persistent: boolean): Promise<BrowserBase>;
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BrowserBase>;
}

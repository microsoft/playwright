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

import * as folio from 'folio';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions, Page } from '../../index';
import { removeFolders } from '../../lib/utils/utils';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import { RemoteServer, RemoteServerOptions } from './remoteServer';
import { CommonArgs, baseTest } from './baseTest';

const mkdtempAsync = util.promisify(fs.mkdtemp);

type PlaywrightTestArgs = {
  createUserDataDir: () => Promise<string>;
  launchPersistent: (options?: Parameters<BrowserType['launchPersistentContext']>[1]) => Promise<{ context: BrowserContext, page: Page }>;
  startRemoteServer: (options?: RemoteServerOptions) => Promise<RemoteServer>;
};

export type PlaywrightEnvOptions = {
  launchOptions?: LaunchOptions;
  traceDir?: string;
};

type PlaywrightWorkerArgs = {
  browserType: BrowserType;
  browserOptions: LaunchOptions;
};

class PlaywrightEnv {
  protected _browserOptions: LaunchOptions;
  protected _browserType: BrowserType;
  private _userDataDirs: string[] = [];
  private _persistentContext: BrowserContext | undefined;
  private _remoteServer: RemoteServer | undefined;

  hasBeforeAllOptions(options: PlaywrightEnvOptions) {
    return 'launchOptions' in options || 'traceDir' in options;
  }

  async beforeAll(args: CommonArgs & PlaywrightEnvOptions, workerInfo: folio.WorkerInfo): Promise<PlaywrightWorkerArgs> {
    this._browserType = args.playwright[args.browserName];
    this._browserOptions = {
      _traceDir: args.traceDir,
      channel: args.browserChannel,
      headless: !args.headful,
      handleSIGINT: false,
      ...args.launchOptions,
    } as any;
    return {
      browserType: this._browserType,
      browserOptions: this._browserOptions,
    };
  }

  private async _createUserDataDir() {
    // We do not put user data dir in testOutputPath,
    // because we do not want to upload them as test result artifacts.
    //
    // Additionally, it is impossible to upload user data dir after test run:
    // - Firefox removes lock file later, presumably from another watchdog process?
    // - WebKit has circular symlinks that makes CI go crazy.
    const dir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
    this._userDataDirs.push(dir);
    return dir;
  }

  private async _launchPersistent(options?: Parameters<BrowserType['launchPersistentContext']>[1]) {
    if (this._persistentContext)
      throw new Error('can only launch one persitent context');
    const userDataDir = await this._createUserDataDir();
    this._persistentContext = await this._browserType.launchPersistentContext(userDataDir, { ...this._browserOptions, ...options });
    const page = this._persistentContext.pages()[0];
    return { context: this._persistentContext, page };
  }

  private async _startRemoteServer(options?: RemoteServerOptions): Promise<RemoteServer> {
    if (this._remoteServer)
      throw new Error('can only start one remote server');
    this._remoteServer = new RemoteServer();
    await this._remoteServer._start(this._browserType, this._browserOptions, options);
    return this._remoteServer;
  }

  async beforeEach({}, testInfo: folio.TestInfo): Promise<PlaywrightTestArgs> {
    return {
      createUserDataDir: this._createUserDataDir.bind(this),
      launchPersistent: this._launchPersistent.bind(this),
      startRemoteServer: this._startRemoteServer.bind(this),
    };
  }

  async afterEach({}, testInfo: folio.TestInfo) {
    if (this._persistentContext) {
      await this._persistentContext.close();
      this._persistentContext = undefined;
    }
    if (this._remoteServer) {
      await this._remoteServer.close();
      this._remoteServer = undefined;
    }
    await removeFolders(this._userDataDirs);
    this._userDataDirs = [];
  }
}

type BrowserTestArgs = {
  browser: Browser;
  browserVersion: string;
  contextOptions: BrowserContextOptions;
  contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
};

type BrowserTestOptions = {
  contextOptions?: BrowserContextOptions;
};

class BrowserEnv {
  private _browser: Browser | undefined;
  private _contexts: BrowserContext[] = [];
  protected _browserVersion: string;

  hasBeforeAllOptions(options: BrowserTestOptions) {
    return false;
  }

  async beforeAll(args: PlaywrightWorkerArgs, workerInfo: folio.WorkerInfo) {
    this._browser = await args.browserType.launch(args.browserOptions);
    this._browserVersion = this._browser.version();
  }

  async beforeEach(options: CommonArgs & BrowserTestOptions, testInfo: folio.TestInfo): Promise<BrowserTestArgs> {
    const debugName = path.relative(testInfo.project.outputDir, testInfo.outputDir).replace(/[\/\\]/g, '-');
    const contextOptions = {
      recordVideo: options.video ? { dir: testInfo.outputPath('') } : undefined,
      _debugName: debugName,
      ...options.contextOptions,
    } as BrowserContextOptions;

    testInfo.data.browserVersion = this._browserVersion;

    const contextFactory = async (options: BrowserContextOptions = {}) => {
      const context = await this._browser.newContext({ ...contextOptions, ...options });
      this._contexts.push(context);
      return context;
    };

    return {
      browser: this._browser,
      browserVersion: this._browserVersion,
      contextOptions,
      contextFactory,
    };
  }

  async afterEach({}, testInfo: folio.TestInfo) {
    for (const context of this._contexts)
      await context.close();
    this._contexts = [];
  }

  async afterAll({}, workerInfo: folio.WorkerInfo) {
    if (this._browser)
      await this._browser.close();
    this._browser = undefined;
  }
}

class ContextEnv {
  async beforeEach(args: BrowserTestArgs, testInfo: folio.TestInfo) {
    const context = await args.contextFactory();
    const page = await context.newPage();
    return { context, page };
  }
}

export const playwrightTest = baseTest.extend(new PlaywrightEnv());
export const browserTest = playwrightTest.extend(new BrowserEnv());
export const contextTest = browserTest.extend(new ContextEnv());

export { expect } from 'folio';

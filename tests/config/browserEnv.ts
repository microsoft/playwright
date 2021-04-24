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

import type { Env, WorkerInfo, TestInfo } from 'folio';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions } from '../../index';
import { start } from '../../lib/outofprocess';
import { PlaywrightClient } from '../../lib/remote/playwrightClient';
import { removeFolders } from '../../lib/utils/utils';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as util from 'util';
import * as childProcess from 'child_process';
import { PlaywrightTestArgs } from './playwrightTest';
import { BrowserTestArgs } from './browserTest';
import { RemoteServer, RemoteServerOptions } from './remoteServer';

const mkdtempAsync = util.promisify(fs.mkdtemp);

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

type TestOptions = {
  mode: 'default' | 'driver' | 'service';
  video?: boolean;
  traceDir?: string;
};

class DriverMode {
  private _playwrightObject: any;

  async setup(workerInfo: WorkerInfo) {
    this._playwrightObject = await start();
    return this._playwrightObject;
  }

  async teardown() {
    await this._playwrightObject.stop();
  }
}

class ServiceMode {
  private _playwrightObejct: any;
  private _client: any;
  private _serviceProcess: childProcess.ChildProcess;

  async setup(workerInfo: WorkerInfo) {
    const port = 10507 + workerInfo.workerIndex;
    this._serviceProcess = childProcess.fork(path.join(__dirname, '..', '..', 'lib', 'cli', 'cli.js'), ['run-server', String(port)], {
      stdio: 'pipe'
    });
    this._serviceProcess.stderr.pipe(process.stderr);
    await new Promise<void>(f => {
      this._serviceProcess.stdout.on('data', data => {
        if (data.toString().includes('Listening on'))
          f();
      });
    });
    this._serviceProcess.on('exit', this._onExit);
    this._client = await PlaywrightClient.connect(`ws://localhost:${port}/ws`);
    this._playwrightObejct = this._client.playwright();
    return this._playwrightObejct;
  }

  async teardown() {
    await this._client.close();
    this._serviceProcess.removeListener('exit', this._onExit);
    const processExited = new Promise(f => this._serviceProcess.on('exit', f));
    this._serviceProcess.kill();
    await processExited;
  }

  private _onExit(exitCode, signal) {
    throw new Error(`Server closed with exitCode=${exitCode} signal=${signal}`);
  }
}

class DefaultMode {
  async setup(workerInfo: WorkerInfo) {
    return require('../../index');
  }

  async teardown() {
  }
}

export class PlaywrightEnv implements Env<PlaywrightTestArgs> {
  private _mode: DriverMode | ServiceMode | DefaultMode;
  protected _browserName: BrowserName;
  protected _options: LaunchOptions & TestOptions;
  protected _browserOptions: LaunchOptions;
  private _playwright: typeof import('../../index');
  protected _browserType: BrowserType;
  private _userDataDirs: string[] = [];
  private _persistentContext: BrowserContext | undefined;
  private _remoteServer: RemoteServer | undefined;

  constructor(browserName: BrowserName, options: LaunchOptions & TestOptions) {
    this._browserName = browserName;
    this._options = options;
    this._mode = {
      default: new DefaultMode(),
      service: new ServiceMode(),
      driver: new DriverMode(),
    }[this._options.mode];
  }

  async beforeAll(workerInfo: WorkerInfo) {
    require('../../lib/utils/utils').setUnderTest();
    this._playwright = await this._mode.setup(workerInfo);
    this._browserType = this._playwright[this._browserName];
    const options = {
      ...this._options,
      _traceDir: this._options.traceDir,
      handleSIGINT: false,
    };
    this._browserOptions = options;
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

  async beforeEach(testInfo: TestInfo) {
    // Different screenshots per browser.
    testInfo.snapshotPathSegment = this._browserName;
    testInfo.data = {
      browserName: this._browserName,
    };
    const headful = !this._browserOptions.headless;
    if (headful)
      testInfo.data.headful = true;
    if (this._options.mode !== 'default')
      testInfo.data.mode = this._options.mode;
    if (this._options.video)
      testInfo.data.video = true;
    return {
      playwright: this._playwright,
      browserName: this._browserName,
      browserType: this._browserType,
      browserChannel: this._options.channel,
      browserOptions: this._browserOptions,
      isChromium: this._browserName === 'chromium',
      isFirefox: this._browserName === 'firefox',
      isWebKit: this._browserName === 'webkit',
      isAndroid: false,
      isElectron: false,
      isWindows: os.platform() === 'win32',
      isMac: os.platform() === 'darwin',
      isLinux: os.platform() === 'linux',
      headful,
      video: !!this._options.video,
      mode: this._options.mode,
      platform: os.platform() as ('win32' | 'darwin' | 'linux'),
      createUserDataDir: this._createUserDataDir.bind(this),
      launchPersistent: this._launchPersistent.bind(this),
      toImpl: (this._playwright as any)._toImpl,
      startRemoteServer: this._startRemoteServer.bind(this),
    };
  }

  async afterEach(testInfo: TestInfo) {
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

  async afterAll(workerInfo: WorkerInfo) {
    await this._mode.teardown();
  }
}

export class BrowserEnv extends PlaywrightEnv implements Env<BrowserTestArgs> {
  private _browser: Browser | undefined;
  private _contextOptions: BrowserContextOptions;
  private _contexts: BrowserContext[] = [];
  protected _browserVersion: string;

  constructor(browserName: BrowserName, options: LaunchOptions & BrowserContextOptions & TestOptions) {
    super(browserName, options);
    this._contextOptions = options;
  }

  async beforeAll(workerInfo: WorkerInfo) {
    await super.beforeAll(workerInfo);
    this._browser = await this._browserType.launch(this._browserOptions);
    this._browserVersion = this._browser.version();
  }

  async beforeEach(testInfo: TestInfo) {
    const result = await super.beforeEach(testInfo);
    const debugName = path.relative(testInfo.config.outputDir, testInfo.outputPath('')).replace(/[\/\\]/g, '-');
    const contextOptions = {
      recordVideo: this._options.video ? { dir: testInfo.outputPath('') } : undefined,
      _debugName: debugName,
      ...this._contextOptions,
    } as BrowserContextOptions;

    testInfo.data.browserVersion = this._browserVersion;

    const contextFactory = async (options: BrowserContextOptions = {}) => {
      const context = await this._browser.newContext({ ...contextOptions, ...options });
      this._contexts.push(context);
      return context;
    };

    return {
      ...result,
      browser: this._browser,
      contextOptions: this._contextOptions as BrowserContextOptions,
      contextFactory,
    };
  }

  async afterEach(testInfo: TestInfo) {
    for (const context of this._contexts)
      await context.close();
    this._contexts = [];
    await super.afterEach(testInfo);
  }

  async afterAll(workerInfo: WorkerInfo) {
    if (this._browser)
      await this._browser.close();
    this._browser = undefined;
    await super.afterAll(workerInfo);
  }
}

export class PageEnv extends BrowserEnv {
  async beforeEach(testInfo: TestInfo) {
    const result = await super.beforeEach(testInfo);
    const context = await result.contextFactory();
    const page = await context.newPage();
    return {
      ...result,
      browserVersion: this._browserVersion,
      context,
      page,
    };
  }
}

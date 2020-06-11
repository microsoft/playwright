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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import { BrowserContext, PersistentContextOptions, verifyProxySettings, validateBrowserContextOptions } from '../browserContext';
import { BrowserServer } from './browserServer';
import * as browserPaths from '../install/browserPaths';
import { Logger, InnerLogger } from '../logger';
import { ConnectionTransport, WebSocketTransport } from '../transport';
import { BrowserBase, BrowserOptions, Browser } from '../browser';
import { assert } from '../helper';
import { launchProcess, Env, waitForLine } from './processLauncher';
import { Events } from '../events';
import { PipeTransport } from './pipeTransport';
import { Progress, runAbortableTask } from '../progress';
import { ProxySettings } from '../types';
import { TimeoutSettings } from '../timeoutSettings';
import { WebSocketServer } from './webSocketServer';

export type FirefoxUserPrefsOptions = {
  firefoxUserPrefs?: { [key: string]: string | number | boolean },
};

export type LaunchOptionsBase = {
  executablePath?: string,
  args?: string[],
  ignoreDefaultArgs?: boolean | string[],
  handleSIGINT?: boolean,
  handleSIGTERM?: boolean,
  handleSIGHUP?: boolean,
  timeout?: number,
  logger?: Logger,
  env?: Env,
  headless?: boolean,
  devtools?: boolean,
  proxy?: ProxySettings,
  downloadsPath?: string,
};

type ConnectOptions = {
  wsEndpoint: string,
  slowMo?: number,
  logger?: Logger,
  timeout?: number,
};
export type LaunchOptions = LaunchOptionsBase & { slowMo?: number };
type LaunchServerOptions = LaunchOptionsBase & { port?: number };

export interface BrowserType {
  executablePath(): string;
  name(): string;
  launch(options?: LaunchOptions & FirefoxUserPrefsOptions): Promise<Browser>;
  launchServer(options?: LaunchServerOptions & FirefoxUserPrefsOptions): Promise<BrowserServer>;
  launchPersistentContext(userDataDir: string, options?: LaunchOptions & PersistentContextOptions): Promise<BrowserContext>;
  connect(options: ConnectOptions): Promise<Browser>;
}

const mkdirAsync = util.promisify(fs.mkdir);
const mkdtempAsync = util.promisify(fs.mkdtemp);
const DOWNLOADS_FOLDER = path.join(os.tmpdir(), 'playwright_downloads-');

type WebSocketNotPipe = { webSocketRegex: RegExp, stream: 'stdout' | 'stderr' };

export abstract class BrowserTypeBase implements BrowserType {
  private _name: string;
  private _executablePath: string | undefined;
  private _webSocketNotPipe: WebSocketNotPipe | null;
  readonly _browserPath: string;

  constructor(packagePath: string, browser: browserPaths.BrowserDescriptor, webSocketOrPipe: WebSocketNotPipe | null) {
    this._name = browser.name;
    const browsersPath = browserPaths.browsersPath(packagePath);
    this._browserPath = browserPaths.browserDirectory(browsersPath, browser);
    this._executablePath = browserPaths.executablePath(this._browserPath, browser);
    this._webSocketNotPipe = webSocketOrPipe;
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
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = validateLaunchOptions(options);
    const logger = new InnerLogger(options.logger);
    const browser = await runAbortableTask(progress => this._innerLaunch(progress, options, logger, undefined), logger, TimeoutSettings.timeout(options));
    return browser;
  }

  async launchPersistentContext(userDataDir: string, options: LaunchOptions & PersistentContextOptions = {}): Promise<BrowserContext> {
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = validateLaunchOptions(options);
    const persistent = validateBrowserContextOptions(options);
    const logger = new InnerLogger(options.logger);
    const browser = await runAbortableTask(progress => this._innerLaunch(progress, options, logger, persistent, userDataDir), logger, TimeoutSettings.timeout(options));
    return browser._defaultContext!;
  }

  async _innerLaunch(progress: Progress, options: LaunchOptions, logger: InnerLogger, persistent: PersistentContextOptions | undefined, userDataDir?: string): Promise<BrowserBase> {
    options.proxy = options.proxy ? verifyProxySettings(options.proxy) : undefined;
    const { browserServer, downloadsPath, transport } = await this._launchServer(progress, options, !!persistent, logger, userDataDir);
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();
    const browserOptions: BrowserOptions = {
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      logger,
      downloadsPath,
      ownedServer: browserServer,
      proxy: options.proxy,
    };
    copyTestHooks(options, browserOptions);
    const browser = await this._connectToTransport(transport, browserOptions);
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    const hasCustomArguments = !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs);
    if (persistent && !hasCustomArguments)
      await browser._defaultContext!._loadDefaultContext();
    return browser;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launchServer`. Use `browserType.launchPersistentContext` instead');
    options = validateLaunchOptions(options);
    const logger = new InnerLogger(options.logger);
    const { port = 0 } = options;
    return runAbortableTask(async progress => {
      const { browserServer, transport } = await this._launchServer(progress, options, false, logger);
      browserServer._webSocketServer = this._startWebSocketServer(transport, logger, port);
      return browserServer;
    }, logger, TimeoutSettings.timeout(options));
  }

  async connect(options: ConnectOptions): Promise<Browser> {
    const logger = new InnerLogger(options.logger);
    return runAbortableTask(async progress => {
      const transport = await WebSocketTransport.connect(progress, options.wsEndpoint);
      progress.cleanupWhenAborted(() => transport.closeAndWait());
      if ((options as any).__testHookBeforeCreateBrowser)
        await (options as any).__testHookBeforeCreateBrowser();
      const browser = await this._connectToTransport(transport, { slowMo: options.slowMo, logger });
      return browser;
    }, logger, TimeoutSettings.timeout(options));
  }

  private async _launchServer(progress: Progress, options: LaunchServerOptions, isPersistent: boolean, logger: InnerLogger, userDataDir?: string): Promise<{ browserServer: BrowserServer, downloadsPath: string, transport: ConnectionTransport }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;

    const tempDirectories = [];
    let downloadsPath: string;
    if (options.downloadsPath) {
      downloadsPath = options.downloadsPath;
      await mkdirAsync(options.downloadsPath, { recursive: true });
    } else {
      downloadsPath = await mkdtempAsync(DOWNLOADS_FOLDER);
      tempDirectories.push(downloadsPath);
    }

    if (!userDataDir) {
      userDataDir = await mkdtempAsync(path.join(os.tmpdir(), `playwright_${this._name}dev_profile-`));
      tempDirectories.push(userDataDir);
    }

    const browserArguments = [];
    if (!ignoreDefaultArgs)
      browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir));
    else if (Array.isArray(ignoreDefaultArgs))
      browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      browserArguments.push(...args);

    const executable = executablePath || this.executablePath();
    if (!executable)
      throw new Error(`No executable path is specified. Pass "executablePath" option directly.`);

    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserServer: BrowserServer | undefined = undefined;
    const { launchedProcess, gracefullyClose, kill } = await launchProcess({
      executablePath: executable,
      args: browserArguments,
      env: this._amendEnvironment(env, userDataDir, executable, browserArguments),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      progress,
      pipe: !this._webSocketNotPipe,
      tempDirectories,
      attemptToGracefullyClose: async () => {
        if ((options as any).__testHookGracefullyClose)
          await (options as any).__testHookGracefullyClose();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        this._attemptToGracefullyCloseBrowser(transport!);
      },
      onExit: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, kill);
    progress.cleanupWhenAborted(() => browserServer && browserServer._closeOrKill(progress.timeUntilDeadline()));

    if (this._webSocketNotPipe) {
      const match = await waitForLine(progress, launchedProcess, this._webSocketNotPipe.stream === 'stdout' ? launchedProcess.stdout : launchedProcess.stderr, this._webSocketNotPipe.webSocketRegex);
      const innerEndpoint = match[1];
      transport = await WebSocketTransport.connect(progress, innerEndpoint);
    } else {
      const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
      transport = new PipeTransport(stdio[3], stdio[4], logger);
    }
    return { browserServer, downloadsPath, transport };
  }

  abstract _defaultArgs(options: LaunchOptionsBase, isPersistent: boolean, userDataDir: string): string[];
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BrowserBase>;
  abstract _startWebSocketServer(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketServer;
  abstract _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env;
  abstract _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook'))
      (to as any)[key] = value;
  }
}

function validateLaunchOptions<Options extends LaunchOptionsBase>(options: Options): Options {
  const { devtools = false, headless = !devtools } = options;
  return { ...options, devtools, headless };
}

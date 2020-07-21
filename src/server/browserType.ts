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
import { BrowserContext, verifyProxySettings, validateBrowserContextOptions } from '../browserContext';
import { BrowserServer } from './browserServer';
import * as browserPaths from '../install/browserPaths';
import { Loggers, Logger } from '../logger';
import { ConnectionTransport, WebSocketTransport } from '../transport';
import { BrowserBase, BrowserOptions, Browser } from '../browser';
import { assert, helper } from '../helper';
import { launchProcess, Env, waitForLine } from './processLauncher';
import { Events } from '../events';
import { PipeTransport } from './pipeTransport';
import { Progress, runAbortableTask } from '../progress';
import * as types from '../types';
import { TimeoutSettings } from '../timeoutSettings';
import { WebSocketServer } from './webSocketServer';
import { LoggerSink } from '../loggerSink';
import { validateDependencies } from './validateDependencies';

type FirefoxPrefsOptions = { firefoxUserPrefs?: { [key: string]: string | number | boolean } };
type LaunchOptions = types.LaunchOptions & { logger?: LoggerSink };
type ConnectOptions = types.ConnectOptions & { logger?: LoggerSink };


export type LaunchNonPersistentOptions = LaunchOptions & FirefoxPrefsOptions;
type LaunchPersistentOptions = LaunchOptions & types.BrowserContextOptions;
type LaunchServerOptions = types.LaunchServerOptions & { logger?: LoggerSink } & FirefoxPrefsOptions;

export interface BrowserType {
  executablePath(): string;
  name(): string;
  launch(options?: LaunchNonPersistentOptions): Promise<Browser>;
  launchServer(options?: LaunchServerOptions): Promise<BrowserServer>;
  launchPersistentContext(userDataDir: string, options?: LaunchPersistentOptions): Promise<BrowserContext>;
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
  private _browserDescriptor: browserPaths.BrowserDescriptor;
  readonly _browserPath: string;

  constructor(packagePath: string, browser: browserPaths.BrowserDescriptor, webSocketOrPipe: WebSocketNotPipe | null) {
    this._name = browser.name;
    const browsersPath = browserPaths.browsersPath(packagePath);
    this._browserDescriptor = browser;
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

  async launch(options: LaunchNonPersistentOptions = {}): Promise<Browser> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = validateLaunchOptions(options);
    const loggers = new Loggers(options.logger);
    const browser = await runAbortableTask(progress => this._innerLaunch(progress, options, loggers, undefined), loggers.browser, TimeoutSettings.timeout(options), `browserType.launch`).catch(e => { throw this._rewriteStartupError(e); });
    return browser;
  }

  async launchPersistentContext(userDataDir: string, options: LaunchPersistentOptions = {}): Promise<BrowserContext> {
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    options = validateLaunchOptions(options);
    const persistent = validateBrowserContextOptions(options);
    const loggers = new Loggers(options.logger);
    const browser = await runAbortableTask(progress => this._innerLaunch(progress, options, loggers, persistent, userDataDir), loggers.browser, TimeoutSettings.timeout(options), 'browserType.launchPersistentContext').catch(e => { throw this._rewriteStartupError(e); });
    return browser._defaultContext!;
  }

  async _innerLaunch(progress: Progress, options: LaunchOptions, logger: Loggers, persistent: types.BrowserContextOptions | undefined, userDataDir?: string): Promise<BrowserBase> {
    options.proxy = options.proxy ? verifyProxySettings(options.proxy) : undefined;
    const { browserServer, downloadsPath, transport } = await this._launchServer(progress, options, !!persistent, logger, userDataDir);
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();
    const browserOptions: BrowserOptions = {
      name: this._name,
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      loggers: logger,
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
    const loggers = new Loggers(options.logger);
    const { port = 0 } = options;
    return runAbortableTask(async progress => {
      const { browserServer, transport } = await this._launchServer(progress, options, false, loggers);
      browserServer._webSocketServer = this._startWebSocketServer(transport, loggers.browser, port);
      return browserServer;
    }, loggers.browser, TimeoutSettings.timeout(options), 'browserType.launchServer');
  }

  async connect(options: ConnectOptions): Promise<Browser> {
    const loggers = new Loggers(options.logger);
    return runAbortableTask(async progress => {
      const transport = await WebSocketTransport.connect(progress, options.wsEndpoint);
      progress.cleanupWhenAborted(() => transport.closeAndWait());
      if ((options as any).__testHookBeforeCreateBrowser)
        await (options as any).__testHookBeforeCreateBrowser();
      const browser = await this._connectToTransport(transport, { name: this._name, slowMo: options.slowMo, loggers });
      return browser;
    }, loggers.browser, TimeoutSettings.timeout(options), 'browserType.connect');
  }

  private async _launchServer(progress: Progress, options: LaunchServerOptions, isPersistent: boolean, loggers: Loggers, userDataDir?: string): Promise<{ browserServer: BrowserServer, downloadsPath: string, transport: ConnectionTransport }> {
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

    if (!executablePath) {
      // We can only validate dependencies for bundled browsers.
      await validateDependencies(this._browserPath, this._browserDescriptor);
    }

    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserServer: BrowserServer | undefined = undefined;
    const { launchedProcess, gracefullyClose, kill } = await launchProcess({
      executablePath: executable,
      args: this._amendArguments(browserArguments),
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
      transport = new PipeTransport(stdio[3], stdio[4], loggers.browser);
    }
    return { browserServer, downloadsPath, transport };
  }

  abstract _defaultArgs(options: types.LaunchOptionsBase, isPersistent: boolean, userDataDir: string): string[];
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BrowserBase>;
  abstract _startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer;
  abstract _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env;
  abstract _amendArguments(browserArguments: string[]): string[];
  abstract _rewriteStartupError(error: Error): Error;
  abstract _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook'))
      (to as any)[key] = value;
  }
}

function validateLaunchOptions<Options extends types.LaunchOptionsBase>(options: Options): Options {
  const { devtools = false, headless = !helper.isDebugMode() && !devtools } = options;
  return { ...options, devtools, headless };
}

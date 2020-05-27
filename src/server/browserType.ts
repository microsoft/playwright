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
import { BrowserContext, PersistentContextOptions, validatePersistentContextOptions } from '../browserContext';
import { BrowserServer, WebSocketWrapper } from './browserServer';
import * as browserPaths from '../install/browserPaths';
import { Logger, RootLogger, InnerLogger } from '../logger';
import { ConnectionTransport, WebSocketTransport } from '../transport';
import { BrowserBase, BrowserOptions, Browser } from '../browser';
import { assert, helper } from '../helper';
import { TimeoutSettings } from '../timeoutSettings';
import { launchProcess, Env, waitForLine } from './processLauncher';
import { Events } from '../events';
import { TimeoutError } from '../errors';
import { PipeTransport } from './pipeTransport';

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
  env?: Env,
};

export function processBrowserArgOptions(options: LaunchOptionsBase): { devtools: boolean, headless: boolean } {
  const { devtools = false, headless = !devtools } = options;
  return { devtools, headless };
}

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
  launch(options?: LaunchOptions): Promise<Browser>;
  launchServer(options?: LaunchServerOptions): Promise<BrowserServer>;
  launchPersistentContext(userDataDir: string, options?: LaunchOptions & PersistentContextOptions): Promise<BrowserContext>;
  connect(options: ConnectOptions): Promise<Browser>;
}

const mkdtempAsync = util.promisify(fs.mkdtemp);
const DOWNLOADS_FOLDER = path.join(os.tmpdir(), 'playwright_downloads-');

export abstract class BrowserTypeBase implements BrowserType {
  private _name: string;
  private _executablePath: string | undefined;
  private _webSocketRegexNotPipe: RegExp | null;
  readonly _browserPath: string;

  constructor(packagePath: string, browser: browserPaths.BrowserDescriptor, webSocketRegexNotPipe: RegExp | null) {
    this._name = browser.name;
    const browsersPath = browserPaths.browsersPath(packagePath);
    this._browserPath = browserPaths.browserDirectory(browsersPath, browser);
    this._executablePath = browserPaths.executablePath(this._browserPath, browser);
    this._webSocketRegexNotPipe = webSocketRegexNotPipe;
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
    return this._innerLaunch(options, undefined);
  }

  async launchPersistentContext(userDataDir: string, options: LaunchOptions & PersistentContextOptions = {}): Promise<BrowserContext> {
    assert(!(options as any).port, 'Cannot specify a port without launching as a server.');
    const persistent = validatePersistentContextOptions(options);
    const browser = await this._innerLaunch(options, persistent, userDataDir);
    return browser._defaultContext!;
  }

  async _innerLaunch(options: LaunchOptions, persistent: PersistentContextOptions | undefined, userDataDir?: string): Promise<BrowserBase> {
    const deadline = TimeoutSettings.computeDeadline(options.timeout);
    const logger = new RootLogger(options.logger);
    logger.startLaunchRecording();

    let browserServer: BrowserServer | undefined;
    try {
      const launched = await this._launchServer(options, !!persistent, logger, deadline, userDataDir);
      browserServer = launched.browserServer;
      const browserOptions: BrowserOptions = {
        slowMo: options.slowMo,
        persistent,
        headful: !processBrowserArgOptions(options).headless,
        logger,
        downloadsPath: launched.downloadsPath,
        ownedServer: browserServer,
      };
      copyTestHooks(options, browserOptions);
      const hasCustomArguments = !!options.ignoreDefaultArgs && !Array.isArray(options.ignoreDefaultArgs);
      const promise = this._innerCreateBrowser(launched.transport, browserOptions, hasCustomArguments);
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

  async _innerCreateBrowser(transport: ConnectionTransport, browserOptions: BrowserOptions, hasCustomArguments: boolean): Promise<BrowserBase> {
    if ((browserOptions as any).__testHookBeforeCreateBrowser)
      await (browserOptions as any).__testHookBeforeCreateBrowser();
    const browser = await this._connectToTransport(transport, browserOptions);
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    if (browserOptions.persistent && !hasCustomArguments)
      await browser._defaultContext!._loadDefaultContext();
    return browser;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launchServer`. Use `browserType.launchPersistentContext` instead');
    const { port = 0 } = options;
    const logger = new RootLogger(options.logger);
    const { browserServer, transport } = await this._launchServer(options, false, logger, TimeoutSettings.computeDeadline(options.timeout));
    browserServer._webSocketWrapper = this._wrapTransportWithWebSocket(transport, logger, port);
    return browserServer;
  }

  async connect(options: ConnectOptions): Promise<Browser> {
    const deadline = TimeoutSettings.computeDeadline(options.timeout);
    const logger = new RootLogger(options.logger);
    logger.startLaunchRecording();

    let transport: ConnectionTransport | undefined;
    try {
      transport = await WebSocketTransport.connect(options.wsEndpoint, logger, deadline);
      const browserOptions: BrowserOptions = {
        slowMo: options.slowMo,
        logger,
      };
      copyTestHooks(options, browserOptions);
      const promise = this._innerCreateBrowser(transport, browserOptions, false);
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

  private async _launchServer(options: LaunchServerOptions, isPersistent: boolean, logger: RootLogger, deadline: number, userDataDir?: string): Promise<{ browserServer: BrowserServer, downloadsPath: string, transport: ConnectionTransport }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;

    const downloadsPath = await mkdtempAsync(DOWNLOADS_FOLDER);
    const tempDirectories = [downloadsPath];
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
    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: executable,
      args: browserArguments,
      env: this._amendEnvironment(env, userDataDir, executable, browserArguments),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      logger,
      pipe: !this._webSocketRegexNotPipe,
      tempDirectories,
      attemptToGracefullyClose: async () => {
        if ((options as any).__testHookGracefullyClose)
          await (options as any).__testHookGracefullyClose();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        this._attemptToGracefullyCloseBrowser(transport!);
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    try {
      if (this._webSocketRegexNotPipe) {
        const timeoutError = new TimeoutError(`Timed out while trying to connect to the browser!`);
        const match = await waitForLine(launchedProcess, launchedProcess.stdout, this._webSocketRegexNotPipe, helper.timeUntilDeadline(deadline), timeoutError);
        const innerEndpoint = match[1];
        transport = await WebSocketTransport.connect(innerEndpoint, logger, deadline);
      } else {
        const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
        transport = new PipeTransport(stdio[3], stdio[4], logger);
      }
    } catch (e) {
      // If we can't establish a connection, kill the process and exit.
      helper.killProcess(launchedProcess);
      throw e;
    }
    browserServer = new BrowserServer(launchedProcess, gracefullyClose);
    return { browserServer, downloadsPath, transport };
  }

  abstract _defaultArgs(options: BrowserArgOptions, isPersistent: boolean, userDataDir: string): string[];
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<BrowserBase>;
  abstract _wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper;
  abstract _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env;
  abstract _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook'))
      (to as any)[key] = value;
  }
}

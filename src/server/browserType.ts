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
import { BrowserContext, normalizeProxySettings, validateBrowserContextOptions } from './browserContext';
import * as browserPaths from '../utils/browserPaths';
import { ConnectionTransport, WebSocketTransport } from './transport';
import { BrowserOptions, Browser, BrowserProcess } from './browser';
import { launchProcess, Env, waitForLine, envArrayToObject } from './processLauncher';
import { PipeTransport } from './pipeTransport';
import { Progress, ProgressController } from './progress';
import * as types from './types';
import { TimeoutSettings } from '../utils/timeoutSettings';
import { validateHostRequirements } from './validateDependencies';
import { isDebugMode } from '../utils/utils';

const mkdirAsync = util.promisify(fs.mkdir);
const mkdtempAsync = util.promisify(fs.mkdtemp);
const existsAsync = (path: string): Promise<boolean> => new Promise(resolve => fs.stat(path, err => resolve(!err)));
const DOWNLOADS_FOLDER = path.join(os.tmpdir(), 'playwright_downloads-');

type WebSocketNotPipe = { webSocketRegex: RegExp, stream: 'stdout' | 'stderr' };

export abstract class BrowserType {
  private _name: string;
  private _executablePath: string;
  private _webSocketNotPipe: WebSocketNotPipe | null;
  private _browserDescriptor: browserPaths.BrowserDescriptor;
  readonly _browserPath: string;

  constructor(packagePath: string, browser: browserPaths.BrowserDescriptor, webSocketOrPipe: WebSocketNotPipe | null) {
    this._name = browser.name;
    const browsersPath = browserPaths.browsersPath(packagePath);
    this._browserDescriptor = browser;
    this._browserPath = browserPaths.browserDirectory(browsersPath, browser);
    this._executablePath = browserPaths.executablePath(this._browserPath, browser) || '';
    this._webSocketNotPipe = webSocketOrPipe;
  }

  executablePath(): string {
    return this._executablePath;
  }

  name(): string {
    return this._name;
  }

  async launch(options: types.LaunchOptions = {}): Promise<Browser> {
    options = validateLaunchOptions(options);
    const controller = new ProgressController();
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      return this._innerLaunch(progress, options, undefined).catch(e => { throw this._rewriteStartupError(e); });
    }, TimeoutSettings.timeout(options));
    return browser;
  }

  async launchPersistentContext(userDataDir: string, options: types.LaunchPersistentOptions = {}): Promise<BrowserContext> {
    options = validateLaunchOptions(options);
    const persistent: types.BrowserContextOptions = options;
    const controller = new ProgressController();
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      return this._innerLaunch(progress, options, persistent, userDataDir).catch(e => { throw this._rewriteStartupError(e); });
    }, TimeoutSettings.timeout(options));
    return browser._defaultContext!;
  }

  async _innerLaunch(progress: Progress, options: types.LaunchOptions, persistent: types.BrowserContextOptions | undefined, userDataDir?: string): Promise<Browser> {
    options.proxy = options.proxy ? normalizeProxySettings(options.proxy) : undefined;
    const { browserProcess, downloadsPath, transport } = await this._launchProcess(progress, options, !!persistent, userDataDir);
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();
    const browserOptions: BrowserOptions = {
      name: this._name,
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      downloadsPath,
      browserProcess,
      proxy: options.proxy,
    };
    if (persistent)
      validateBrowserContextOptions(persistent, browserOptions);
    copyTestHooks(options, browserOptions);
    const browser = await this._connectToTransport(transport, browserOptions);
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    if (persistent && !options.ignoreAllDefaultArgs)
      await browser._defaultContext!._loadDefaultContext(progress);
    return browser;
  }

  private async _launchProcess(progress: Progress, options: types.LaunchOptions, isPersistent: boolean, userDataDir?: string): Promise<{ browserProcess: BrowserProcess, downloadsPath: string, transport: ConnectionTransport }> {
    const {
      ignoreDefaultArgs,
      ignoreAllDefaultArgs,
      args = [],
      executablePath = null,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;

    const env = options.env ? envArrayToObject(options.env) : process.env;

    const tempDirectories = [];
    const ensurePath = async (tmpPrefix: string, pathFromOptions?: string) => {
      let dir;
      if (pathFromOptions) {
        dir = pathFromOptions;
        await mkdirAsync(pathFromOptions, { recursive: true });
      } else {
        dir = await mkdtempAsync(tmpPrefix);
        tempDirectories.push(dir);
      }
      return dir;
    };
    // TODO: add downloadsPath to newContext().
    const downloadsPath = await ensurePath(DOWNLOADS_FOLDER, options.downloadsPath);

    if (!userDataDir) {
      userDataDir = await mkdtempAsync(path.join(os.tmpdir(), `playwright_${this._name}dev_profile-`));
      tempDirectories.push(userDataDir);
    }

    const browserArguments = [];
    if (ignoreAllDefaultArgs)
      browserArguments.push(...args);
    else if (ignoreDefaultArgs)
      browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir));

    const executable = executablePath || this.executablePath();
    if (!executable)
      throw new Error(`No executable path is specified. Pass "executablePath" option directly.`);
    if (!(await existsAsync(executable))) {
      const errorMessageLines = [`Failed to launch ${this._name} because executable doesn't exist at ${executable}`];
      // If we tried using stock downloaded browser, suggest re-installing playwright.
      if (!executablePath)
        errorMessageLines.push(`Try re-installing playwright with "npm install playwright"`);
      throw new Error(errorMessageLines.join('\n'));
    }

    if (!executablePath) {
      // We can only validate dependencies for bundled browsers.
      await validateHostRequirements(this._browserPath, this._browserDescriptor);
    }

    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserProcess: BrowserProcess | undefined = undefined;
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
        if (browserProcess && browserProcess.onclose)
          browserProcess.onclose(exitCode, signal);
      },
    });
    browserProcess = {
      onclose: undefined,
      process: launchedProcess,
      close: gracefullyClose,
      kill
    };
    progress.cleanupWhenAborted(() => browserProcess && closeOrKill(browserProcess, progress.timeUntilDeadline()));

    if (this._webSocketNotPipe) {
      const match = await waitForLine(progress, launchedProcess, this._webSocketNotPipe.stream === 'stdout' ? launchedProcess.stdout : launchedProcess.stderr, this._webSocketNotPipe.webSocketRegex);
      const innerEndpoint = match[1];
      transport = await WebSocketTransport.connect(progress, innerEndpoint);
    } else {
      const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
      transport = new PipeTransport(stdio[3], stdio[4]);
    }
    return { browserProcess, downloadsPath, transport };
  }

  abstract _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[];
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<Browser>;
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

function validateLaunchOptions<Options extends types.LaunchOptions>(options: Options): Options {
  const { devtools = false, headless = !isDebugMode() && !devtools } = options;
  return { ...options, devtools, headless };
}

async function closeOrKill(browserProcess: BrowserProcess, timeout: number): Promise<void> {
  let timer: NodeJS.Timer;
  try {
    await Promise.race([
      browserProcess.close(),
      new Promise((resolve, reject) => timer = setTimeout(reject, timeout)),
    ]);
  } catch (ignored) {
    await browserProcess.kill().catch(ignored => {}); // Make sure to await actual process exit.
  } finally {
    clearTimeout(timer!);
  }
}

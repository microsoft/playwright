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

import fs from 'fs';
import * as os from 'os';
import path from 'path';
import type { BrowserContext } from './browserContext';
import { normalizeProxySettings, validateBrowserContextOptions } from './browserContext';
import type { BrowserName } from './registry';
import { registry } from './registry';
import type { ConnectionTransport } from './transport';
import { WebSocketTransport } from './transport';
import type { BrowserOptions, Browser, BrowserProcess, PlaywrightOptions } from './browser';
import type { Env } from '../utils/processLauncher';
import { launchProcess, envArrayToObject } from '../utils/processLauncher';
import { PipeTransport } from './pipeTransport';
import type { Progress } from './progress';
import { ProgressController } from './progress';
import type * as types from './types';
import { DEFAULT_TIMEOUT, TimeoutSettings } from '../common/timeoutSettings';
import { debugMode } from '../utils';
import { existsAsync } from '../utils/fileUtils';
import { helper } from './helper';
import { RecentLogsCollector } from '../common/debugLogger';
import type { CallMetadata } from './instrumentation';
import { SdkObject } from './instrumentation';

export const kNoXServerRunningError = 'Looks like you launched a headed browser without having a XServer running.\n' +
  'Set either \'headless: true\' or use \'xvfb-run <your-playwright-app>\' before running Playwright.\n\n<3 Playwright Team';

export abstract class BrowserType extends SdkObject {
  private _name: BrowserName;
  readonly _playwrightOptions: PlaywrightOptions;

  constructor(browserName: BrowserName, playwrightOptions: PlaywrightOptions) {
    super(playwrightOptions.rootSdkObject, 'browser-type');
    this.attribution.browserType = this;
    this._playwrightOptions = playwrightOptions;
    this._name = browserName;
  }

  executablePath(): string {
    return registry.findExecutable(this._name).executablePath(this._playwrightOptions.sdkLanguage) || '';
  }

  name(): string {
    return this._name;
  }

  async launch(metadata: CallMetadata, options: types.LaunchOptions, protocolLogger?: types.ProtocolLogger): Promise<Browser> {
    options = this._validateLaunchOptions(options);
    const controller = new ProgressController(metadata, this);
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      const seleniumHubUrl = (options as any).__testHookSeleniumRemoteURL || process.env.SELENIUM_REMOTE_URL;
      if (seleniumHubUrl)
        return this._launchWithSeleniumHub(progress, seleniumHubUrl, options);
      return this._innerLaunchWithRetries(progress, options, undefined, helper.debugProtocolLogger(protocolLogger)).catch(e => { throw this._rewriteStartupError(e); });
    }, TimeoutSettings.timeout(options));
    return browser;
  }

  async launchPersistentContext(metadata: CallMetadata, userDataDir: string, options: types.LaunchPersistentOptions): Promise<BrowserContext> {
    options = this._validateLaunchOptions(options);
    const controller = new ProgressController(metadata, this);
    const persistent: types.BrowserContextOptions = options;
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      return this._innerLaunchWithRetries(progress, options, persistent, helper.debugProtocolLogger(), userDataDir).catch(e => { throw this._rewriteStartupError(e); });
    }, TimeoutSettings.timeout(options));
    return browser._defaultContext!;
  }

  async _innerLaunchWithRetries(progress: Progress, options: types.LaunchOptions, persistent: types.BrowserContextOptions | undefined, protocolLogger: types.ProtocolLogger, userDataDir?: string): Promise<Browser> {
    try {
      return await this._innerLaunch(progress, options, persistent, protocolLogger, userDataDir);
    } catch (error) {
      // @see https://github.com/microsoft/playwright/issues/5214
      const errorMessage = typeof error === 'object' && typeof error.message === 'string' ? error.message : '';
      if (errorMessage.includes('Inconsistency detected by ld.so')) {
        progress.log(`<restarting browser due to hitting race condition in glibc>`);
        return this._innerLaunch(progress, options, persistent, protocolLogger, userDataDir);
      }
      throw error;
    }
  }

  async _innerLaunch(progress: Progress, options: types.LaunchOptions, persistent: types.BrowserContextOptions | undefined, protocolLogger: types.ProtocolLogger, maybeUserDataDir?: string): Promise<Browser> {
    options.proxy = options.proxy ? normalizeProxySettings(options.proxy) : undefined;
    const browserLogsCollector = new RecentLogsCollector();
    const { browserProcess, userDataDir, artifactsDir, transport } = await this._launchProcess(progress, options, !!persistent, browserLogsCollector, maybeUserDataDir);
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();
    const browserOptions: BrowserOptions = {
      ...this._playwrightOptions,
      name: this._name,
      isChromium: this._name === 'chromium',
      channel: options.channel,
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      artifactsDir,
      downloadsPath: (options.downloadsPath || artifactsDir)!,
      tracesDir: (options.tracesDir || artifactsDir)!,
      browserProcess,
      customExecutablePath: options.executablePath,
      proxy: options.proxy,
      protocolLogger,
      browserLogsCollector,
      wsEndpoint: options.useWebSocket ? (transport as WebSocketTransport).wsEndpoint : undefined,
    };
    if (persistent)
      validateBrowserContextOptions(persistent, browserOptions);
    copyTestHooks(options, browserOptions);
    const browser = await this._connectToTransport(transport, browserOptions);
    (browser as any)._userDataDirForTest = userDataDir;
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    if (persistent && !options.ignoreAllDefaultArgs)
      await browser._defaultContext!._loadDefaultContext(progress);
    return browser;
  }

  private async _launchProcess(progress: Progress, options: types.LaunchOptions, isPersistent: boolean, browserLogsCollector: RecentLogsCollector, userDataDir?: string): Promise<{ browserProcess: BrowserProcess, artifactsDir: string, userDataDir: string, transport: ConnectionTransport }> {
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
    if (options.downloadsPath)
      await fs.promises.mkdir(options.downloadsPath, { recursive: true });
    if (options.tracesDir)
      await fs.promises.mkdir(options.tracesDir, { recursive: true });

    const artifactsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-artifacts-'));
    tempDirectories.push(artifactsDir);

    if (userDataDir) {
      // Firefox bails if the profile directory does not exist, Chrome creates it. We ensure consistent behavior here.
      if (!await existsAsync(userDataDir))
        await fs.promises.mkdir(userDataDir, { recursive: true, mode: 0o700 });
    } else {
      userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `playwright_${this._name}dev_profile-`));
      tempDirectories.push(userDataDir);
    }

    const browserArguments = [];
    if (ignoreAllDefaultArgs)
      browserArguments.push(...args);
    else if (ignoreDefaultArgs)
      browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      browserArguments.push(...this._defaultArgs(options, isPersistent, userDataDir));

    let executable: string;
    if (executablePath) {
      if (!(await existsAsync(executablePath)))
        throw new Error(`Failed to launch ${this._name} because executable doesn't exist at ${executablePath}`);
      executable = executablePath;
    } else {
      const registryExecutable = registry.findExecutable(options.channel || this._name);
      if (!registryExecutable || registryExecutable.browserName !== this._name)
        throw new Error(`Unsupported ${this._name} channel "${options.channel}"`);
      executable = registryExecutable.executablePathOrDie(this._playwrightOptions.sdkLanguage);
      await registryExecutable.validateHostRequirements(this._playwrightOptions.sdkLanguage);
    }

    let wsEndpointCallback: ((wsEndpoint: string) => void) | undefined;
    const shouldWaitForWSListening = options.useWebSocket || options.args?.some(a => a.startsWith('--remote-debugging-port'));
    const waitForWSEndpoint = shouldWaitForWSListening ? new Promise<string>(f => wsEndpointCallback = f) : undefined;
    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserProcess: BrowserProcess | undefined = undefined;
    const { launchedProcess, gracefullyClose, kill } = await launchProcess({
      command: executable,
      args: browserArguments,
      env: this._amendEnvironment(env, userDataDir, executable, browserArguments),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      log: (message: string) => {
        if (wsEndpointCallback) {
          const match = message.match(/DevTools listening on (.*)/);
          if (match)
            wsEndpointCallback(match[1]);
        }
        progress.log(message);
        browserLogsCollector.log(message);
      },
      stdio: 'pipe',
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
    async function closeOrKill(timeout: number): Promise<void> {
      let timer: NodeJS.Timer;
      try {
        await Promise.race([
          gracefullyClose(),
          new Promise((resolve, reject) => timer = setTimeout(reject, timeout)),
        ]);
      } catch (ignored) {
        await kill().catch(ignored => {}); // Make sure to await actual process exit.
      } finally {
        clearTimeout(timer!);
      }
    }
    browserProcess = {
      onclose: undefined,
      process: launchedProcess,
      close: () => closeOrKill((options as any).__testHookBrowserCloseTimeout || DEFAULT_TIMEOUT),
      kill
    };
    progress.cleanupWhenAborted(() => closeOrKill(progress.timeUntilDeadline()));
    let wsEndpoint: string | undefined;
    if (shouldWaitForWSListening)
      wsEndpoint = await waitForWSEndpoint;
    if (options.useWebSocket) {
      transport = await WebSocketTransport.connect(progress, wsEndpoint!);
    } else {
      const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
      transport = new PipeTransport(stdio[3], stdio[4]);
    }
    return { browserProcess, artifactsDir, userDataDir, transport };
  }

  async connectOverCDP(metadata: CallMetadata, endpointURL: string, options: { slowMo?: number }, timeout?: number): Promise<Browser> {
    throw new Error('CDP connections are only supported by Chromium');
  }

  async _launchWithSeleniumHub(progress: Progress, hubUrl: string, options: types.LaunchOptions): Promise<Browser> {
    throw new Error('Connecting to SELENIUM_REMOTE_URL is only supported by Chromium');
  }

  private _validateLaunchOptions<Options extends types.LaunchOptions>(options: Options): Options {
    const { devtools = false } = options;
    let { headless = !devtools, downloadsPath, proxy } = options;
    if (debugMode())
      headless = false;
    if (downloadsPath && !path.isAbsolute(downloadsPath))
      downloadsPath = path.join(process.cwd(), downloadsPath);
    if (this._playwrightOptions.socksProxyPort)
      proxy = { server: `socks5://127.0.0.1:${this._playwrightOptions.socksProxyPort}` };
    return { ...options, devtools, headless, downloadsPath, proxy };
  }

  abstract _defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[];
  abstract _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<Browser>;
  abstract _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env;
  abstract _rewriteStartupError(error: Error): Error;
  abstract _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook'))
      (to as any)[key] = value;
  }
}

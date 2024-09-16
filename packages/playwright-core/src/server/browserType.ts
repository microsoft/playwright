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
import type { BrowserOptions, Browser, BrowserProcess } from './browser';
import type { Env } from '../utils/processLauncher';
import { launchProcess, envArrayToObject } from '../utils/processLauncher';
import { PipeTransport } from './pipeTransport';
import type { Progress } from './progress';
import { ProgressController } from './progress';
import type * as types from './types';
import type * as channels from '@protocol/channels';
import { DEFAULT_TIMEOUT, TimeoutSettings } from '../common/timeoutSettings';
import { debugMode, ManualPromise } from '../utils';
import { existsAsync } from '../utils/fileUtils';
import { helper } from './helper';
import { RecentLogsCollector } from '../utils/debugLogger';
import type { CallMetadata } from './instrumentation';
import { SdkObject } from './instrumentation';
import { type ProtocolError, isProtocolError } from './protocolError';
import { ClientCertificatesProxy } from './socksClientCertificatesInterceptor';

export const kNoXServerRunningError = 'Looks like you launched a headed browser without having a XServer running.\n' +
  'Set either \'headless: true\' or use \'xvfb-run <your-playwright-app>\' before running Playwright.\n\n<3 Playwright Team';


export abstract class BrowserReadyState {
  protected readonly _wsEndpoint = new ManualPromise<string|undefined>();

  onBrowserExit(): void {
    // Unblock launch when browser prematurely exits.
    this._wsEndpoint.resolve(undefined);
  }
  async waitUntilReady(): Promise<{ wsEndpoint?: string }> {
    const wsEndpoint = await this._wsEndpoint;
    return { wsEndpoint };
  }

  abstract onBrowserOutput(message: string): void;
}

export abstract class BrowserType extends SdkObject {
  private _name: BrowserName;
  _useBidi: boolean = false;

  constructor(parent: SdkObject, browserName: BrowserName) {
    super(parent, 'browser-type');
    this.attribution.browserType = this;
    this._name = browserName;
  }

  executablePath(): string {
    return registry.findExecutable(this._name).executablePath(this.attribution.playwright.options.sdkLanguage) || '';
  }

  name(): string {
    return this._name;
  }

  async launch(metadata: CallMetadata, options: types.LaunchOptions, protocolLogger?: types.ProtocolLogger): Promise<Browser> {
    options = this._validateLaunchOptions(options);
    if (this._useBidi)
      options.useWebSocket = true;
    const controller = new ProgressController(metadata, this);
    controller.setLogName('browser');
    const browser = await controller.run(progress => {
      const seleniumHubUrl = (options as any).__testHookSeleniumRemoteURL || process.env.SELENIUM_REMOTE_URL;
      if (seleniumHubUrl)
        return this._launchWithSeleniumHub(progress, seleniumHubUrl, options);
      return this._innerLaunchWithRetries(progress, options, undefined, helper.debugProtocolLogger(protocolLogger)).catch(e => { throw this._rewriteStartupLog(e); });
    }, TimeoutSettings.launchTimeout(options));
    return browser;
  }

  async launchPersistentContext(metadata: CallMetadata, userDataDir: string, options: channels.BrowserTypeLaunchPersistentContextOptions & { useWebSocket?: boolean, internalIgnoreHTTPSErrors?: boolean }): Promise<BrowserContext> {
    const launchOptions = this._validateLaunchOptions(options);
    if (this._useBidi)
      launchOptions.useWebSocket = true;
    const controller = new ProgressController(metadata, this);
    controller.setLogName('browser');
    const browser = await controller.run(async progress => {
      // Note: Any initial TLS requests will fail since we rely on the Page/Frames initialize which sets ignoreHTTPSErrors.
      let clientCertificatesProxy: ClientCertificatesProxy | undefined;
      if (options.clientCertificates?.length) {
        clientCertificatesProxy = new ClientCertificatesProxy(options);
        launchOptions.proxyOverride = await clientCertificatesProxy?.listen();
        options = { ...options };
        options.internalIgnoreHTTPSErrors = true;
      }
      progress.cleanupWhenAborted(() => clientCertificatesProxy?.close());
      const browser = await this._innerLaunchWithRetries(progress, launchOptions, options, helper.debugProtocolLogger(), userDataDir).catch(e => { throw this._rewriteStartupLog(e); });
      browser._defaultContext!._clientCertificatesProxy = clientCertificatesProxy;
      return browser;
    }, TimeoutSettings.launchTimeout(launchOptions));
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
      originalLaunchOptions: options,
    };
    if (persistent)
      validateBrowserContextOptions(persistent, browserOptions);
    copyTestHooks(options, browserOptions);
    const browser = await this.connectToTransport(transport, browserOptions);
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

    await this._createArtifactDirs(options);

    const tempDirectories = [];
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
      browserArguments.push(...this.defaultArgs(options, isPersistent, userDataDir).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      browserArguments.push(...this.defaultArgs(options, isPersistent, userDataDir));

    let executable: string;
    if (executablePath) {
      if (!(await existsAsync(executablePath)))
        throw new Error(`Failed to launch ${this._name} because executable doesn't exist at ${executablePath}`);
      executable = executablePath;
    } else {
      const registryExecutable = registry.findExecutable(options.channel || this._name);
      if (!registryExecutable || registryExecutable.browserName !== this._name)
        throw new Error(`Unsupported ${this._name} channel "${options.channel}"`);
      executable = registryExecutable.executablePathOrDie(this.attribution.playwright.options.sdkLanguage);
      await registry.validateHostRequirementsForExecutablesIfNeeded([registryExecutable], this.attribution.playwright.options.sdkLanguage);
    }

    const readyState = this.readyState(options);
    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserProcess: BrowserProcess | undefined = undefined;
    const { launchedProcess, gracefullyClose, kill } = await launchProcess({
      command: executable,
      args: browserArguments,
      env: this.amendEnvironment(env, userDataDir, executable, browserArguments),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      log: (message: string) => {
        readyState?.onBrowserOutput(message);
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
        this.attemptToGracefullyCloseBrowser(transport!);
      },
      onExit: (exitCode, signal) => {
        // Unblock launch when browser prematurely exits.
        readyState?.onBrowserExit();
        if (browserProcess && browserProcess.onclose)
          browserProcess.onclose(exitCode, signal);
      },
    });
    async function closeOrKill(timeout: number): Promise<void> {
      let timer: NodeJS.Timeout;
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
    const wsEndpoint = (await readyState?.waitUntilReady())?.wsEndpoint;
    if (options.useWebSocket) {
      transport = await WebSocketTransport.connect(progress, wsEndpoint!);
    } else {
      const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
      transport = new PipeTransport(stdio[3], stdio[4]);
    }
    return { browserProcess, artifactsDir, userDataDir, transport };
  }

  async _createArtifactDirs(options: types.LaunchOptions): Promise<void> {
    if (options.downloadsPath)
      await fs.promises.mkdir(options.downloadsPath, { recursive: true });
    if (options.tracesDir)
      await fs.promises.mkdir(options.tracesDir, { recursive: true });
  }

  async connectOverCDP(metadata: CallMetadata, endpointURL: string, options: { slowMo?: number }, timeout?: number): Promise<Browser> {
    throw new Error('CDP connections are only supported by Chromium');
  }

  async _launchWithSeleniumHub(progress: Progress, hubUrl: string, options: types.LaunchOptions): Promise<Browser> {
    throw new Error('Connecting to SELENIUM_REMOTE_URL is only supported by Chromium');
  }

  private _validateLaunchOptions(options: types.LaunchOptions): types.LaunchOptions {
    const { devtools = false } = options;
    let { headless = !devtools, downloadsPath, proxy } = options;
    if (debugMode())
      headless = false;
    if (downloadsPath && !path.isAbsolute(downloadsPath))
      downloadsPath = path.join(process.cwd(), downloadsPath);
    if (this.attribution.playwright.options.socksProxyPort)
      proxy = { server: `socks5://127.0.0.1:${this.attribution.playwright.options.socksProxyPort}` };
    return { ...options, devtools, headless, downloadsPath, proxy };
  }

  protected _createUserDataDirArgMisuseError(userDataDirArg: string): Error {
    switch (this.attribution.playwright.options.sdkLanguage) {
      case 'java':
        return new Error(`Pass userDataDir parameter to 'BrowserType.launchPersistentContext(userDataDir, options)' instead of specifying '${userDataDirArg}' argument`);
      case 'python':
        return new Error(`Pass user_data_dir parameter to 'browser_type.launch_persistent_context(user_data_dir, **kwargs)' instead of specifying '${userDataDirArg}' argument`);
      case 'csharp':
        return new Error(`Pass userDataDir parameter to 'BrowserType.LaunchPersistentContextAsync(userDataDir, options)' instead of specifying '${userDataDirArg}' argument`);
      default:
        return new Error(`Pass userDataDir parameter to 'browserType.launchPersistentContext(userDataDir, options)' instead of specifying '${userDataDirArg}' argument`);
    }
  }

  _rewriteStartupLog(error: Error): Error {
    if (!isProtocolError(error))
      return error;
    return this.doRewriteStartupLog(error);
  }

  readyState(options: types.LaunchOptions): BrowserReadyState|undefined {
    return undefined;
  }

  abstract defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[];
  abstract connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<Browser>;
  abstract amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env;
  abstract doRewriteStartupLog(error: ProtocolError): ProtocolError;
  abstract attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook'))
      (to as any)[key] = value;
  }
}

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
import os from 'os';
import path from 'path';

import { normalizeProxySettings, validateBrowserContextOptions } from './browserContext';
import { debugMode } from './utils/debug';
import { assert } from '../utils/isomorphic/assert';
import { ManualPromise } from '../utils/isomorphic/manualPromise';
import { DEFAULT_PLAYWRIGHT_TIMEOUT } from '../utils/isomorphic/time';
import { existsAsync, removeFolders } from './utils/fileUtils';
import { helper } from './helper';
import { SdkObject } from './instrumentation';
import { PipeTransport } from './pipeTransport';
import { envArrayToObject, launchProcess } from './utils/processLauncher';
import {  isProtocolError } from './protocolError';
import { registry } from './registry';
import { ClientCertificatesProxy } from './socksClientCertificatesInterceptor';
import { WebSocketTransport } from './transport';
import { RecentLogsCollector } from './utils/debugLogger';

import type { Browser, BrowserOptions, BrowserProcess } from './browser';
import type { BrowserContext } from './browserContext';
import type { Env } from './utils/processLauncher';
import type { Progress } from './progress';
import type { ProtocolError } from './protocolError';
import type { BrowserName } from './registry';
import type { ConnectionTransport } from './transport';
import type * as types from './types';
import type * as channels from '@protocol/channels';

export const kNoXServerRunningError = 'Looks like you launched a headed browser without having a XServer running.\n' +
  'Set either \'headless: true\' or use \'xvfb-run <your-playwright-app>\' before running Playwright.\n\n<3 Playwright Team';

export abstract class BrowserType extends SdkObject {
  private _name: BrowserName;

  constructor(parent: SdkObject, browserName: BrowserName) {
    super(parent, 'browser-type');
    this.attribution.browserType = this;
    this._name = browserName;
    this.logName = 'browser';
  }

  executablePath(): string {
    return registry.findExecutable(this._name).executablePath(this.attribution.playwright.options.sdkLanguage) || '';
  }

  name(): string {
    return this._name;
  }

  async launch(progress: Progress, options: types.LaunchOptions, protocolLogger?: types.ProtocolLogger): Promise<Browser> {
    options = this._validateLaunchOptions(options);
    const seleniumHubUrl = (options as any).__testHookSeleniumRemoteURL || process.env.SELENIUM_REMOTE_URL;
    if (seleniumHubUrl)
      return this._launchWithSeleniumHub(progress, seleniumHubUrl, options);
    return this._innerLaunchWithRetries(progress, options, undefined, helper.debugProtocolLogger(protocolLogger)).catch(e => { throw this._rewriteStartupLog(e); });
  }

  async launchPersistentContext(progress: Progress, userDataDir: string, options: channels.BrowserTypeLaunchPersistentContextOptions & { cdpPort?: number, internalIgnoreHTTPSErrors?: boolean, socksProxyPort?: number }): Promise<BrowserContext> {
    const launchOptions = this._validateLaunchOptions(options);
    // Note: Any initial TLS requests will fail since we rely on the Page/Frames initialize which sets ignoreHTTPSErrors.
    let clientCertificatesProxy: ClientCertificatesProxy | undefined;
    if (options.clientCertificates?.length) {
      clientCertificatesProxy = await progress.raceWithCleanup(ClientCertificatesProxy.create(options), proxy => proxy.close());
      launchOptions.proxyOverride = clientCertificatesProxy.proxySettings();
      options = { ...options };
      options.internalIgnoreHTTPSErrors = true;
    }
    const browser = await this._innerLaunchWithRetries(progress, launchOptions, options, helper.debugProtocolLogger(), userDataDir).catch(e => { throw this._rewriteStartupLog(e); });
    browser._defaultContext!._clientCertificatesProxy = clientCertificatesProxy;
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
      await progress.race((options as any).__testHookBeforeCreateBrowser());
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
      wsEndpoint: transport instanceof WebSocketTransport ? transport.wsEndpoint : undefined,
      originalLaunchOptions: options,
    };
    if (persistent)
      validateBrowserContextOptions(persistent, browserOptions);
    copyTestHooks(options, browserOptions);
    const browser = await progress.race(this.connectToTransport(transport, browserOptions, browserLogsCollector));
    (browser as any)._userDataDirForTest = userDataDir;
    // We assume no control when using custom arguments, and do not prepare the default context in that case.
    if (persistent && !options.ignoreAllDefaultArgs)
      await browser._defaultContext!._loadDefaultContext(progress);
    return browser;
  }

  private async _prepareToLaunch(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string | undefined) {
    const {
      ignoreDefaultArgs,
      ignoreAllDefaultArgs,
      args = [],
      executablePath = null,
    } = options;
    await this._createArtifactDirs(options);

    const tempDirectories: string[] = [];
    const artifactsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-artifacts-'));
    tempDirectories.push(artifactsDir);

    if (userDataDir) {
      assert(path.isAbsolute(userDataDir), 'userDataDir must be an absolute path');
      // Firefox bails if the profile directory does not exist, Chrome creates it. We ensure consistent behavior here.
      if (!await existsAsync(userDataDir))
        await fs.promises.mkdir(userDataDir, { recursive: true, mode: 0o700 });
    } else {
      userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `playwright_${this._name}dev_profile-`));
      tempDirectories.push(userDataDir);
    }
    await this.prepareUserDataDir(options, userDataDir);

    const browserArguments: string[] = [];
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
      const registryExecutable = registry.findExecutable(this.getExecutableName(options));
      if (!registryExecutable || registryExecutable.browserName !== this._name)
        throw new Error(`Unsupported ${this._name} channel "${options.channel}"`);
      executable = registryExecutable.executablePathOrDie(this.attribution.playwright.options.sdkLanguage);
      await registry.validateHostRequirementsForExecutablesIfNeeded([registryExecutable], this.attribution.playwright.options.sdkLanguage);
    }

    return { executable, browserArguments, userDataDir, artifactsDir, tempDirectories };
  }

  private async _launchProcess(progress: Progress, options: types.LaunchOptions, isPersistent: boolean, browserLogsCollector: RecentLogsCollector, userDataDir?: string): Promise<{ browserProcess: BrowserProcess, artifactsDir: string, userDataDir: string, transport: ConnectionTransport }> {
    const {
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;

    const env = options.env ? envArrayToObject(options.env) : process.env;
    const prepared = await progress.race(this._prepareToLaunch(options, isPersistent, userDataDir));
    progress.cleanupWhenAborted(() => removeFolders(prepared.tempDirectories));

    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserProcess: BrowserProcess | undefined = undefined;
    const exitPromise = new ManualPromise();
    const { launchedProcess, gracefullyClose, kill } = await launchProcess({
      command: prepared.executable,
      args: prepared.browserArguments,
      env: this.amendEnvironment(env, prepared.userDataDir, isPersistent),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      log: (message: string) => {
        progress.log(message);
        browserLogsCollector.log(message);
      },
      stdio: 'pipe',
      tempDirectories: prepared.tempDirectories,
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
        exitPromise.resolve();
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
      close: () => closeOrKill((options as any).__testHookBrowserCloseTimeout || DEFAULT_PLAYWRIGHT_TIMEOUT),
      kill
    };
    progress.cleanupWhenAborted(() => closeOrKill(DEFAULT_PLAYWRIGHT_TIMEOUT));
    const { wsEndpoint } = await progress.race([
      this.waitForReadyState(options, browserLogsCollector),
      exitPromise.then(() => ({ wsEndpoint: undefined })),
    ]);
    if (options.cdpPort !== undefined || !this.supportsPipeTransport()) {
      transport = await WebSocketTransport.connect(progress, wsEndpoint!);
    } else {
      const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
      transport = new PipeTransport(stdio[3], stdio[4]);
    }
    progress.cleanupWhenAborted(() => transport.close());
    return { browserProcess, artifactsDir: prepared.artifactsDir, userDataDir: prepared.userDataDir, transport };
  }

  async _createArtifactDirs(options: types.LaunchOptions): Promise<void> {
    if (options.downloadsPath)
      await fs.promises.mkdir(options.downloadsPath, { recursive: true });
    if (options.tracesDir)
      await fs.promises.mkdir(options.tracesDir, { recursive: true });
  }

  async connectOverCDP(progress: Progress, endpointURL: string, options: { slowMo?: number, timeout?: number, headers?: types.HeadersArray }): Promise<Browser> {
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
    if (options.socksProxyPort)
      proxy = { server: `socks5://127.0.0.1:${options.socksProxyPort}` };
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

  async waitForReadyState(options: types.LaunchOptions, browserLogsCollector: RecentLogsCollector): Promise<{ wsEndpoint?: string }> {
    return {};
  }

  async prepareUserDataDir(options: types.LaunchOptions, userDataDir: string): Promise<void> {
  }

  supportsPipeTransport(): boolean {
    return true;
  }

  getExecutableName(options: types.LaunchOptions): string {
    return options.channel || this._name;
  }

  abstract defaultArgs(options: types.LaunchOptions, isPersistent: boolean, userDataDir: string): string[];
  abstract connectToTransport(transport: ConnectionTransport, options: BrowserOptions, browserLogsCollector: RecentLogsCollector): Promise<Browser>;
  abstract amendEnvironment(env: Env, userDataDir: string, isPersistent: boolean): Env;
  abstract doRewriteStartupLog(error: ProtocolError): ProtocolError;
  abstract attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith('__testHook'))
      (to as any)[key] = value;
  }
}

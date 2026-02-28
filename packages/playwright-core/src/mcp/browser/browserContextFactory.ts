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

import crypto from 'crypto';
import fs from 'fs';
import net from 'net';
import path from 'path';

import * as playwright from '../../..';
import { registryDirectory } from '../../server/registry/index';
import { startTraceViewerServer } from '../../server';
import { testDebug } from '../log';
import { outputDir, outputFile } from './config';
import { firstRootPath } from '../sdk/server';

import type { FullConfig } from './config';
import type { LaunchOptions, BrowserContextOptions } from '../../client/types';
import type { ClientInfo } from '../sdk/server';

export function contextFactory(config: FullConfig): BrowserContextFactory {
  if (config.browser.remoteEndpoint)
    return new RemoteContextFactory(config);
  if (config.browser.cdpEndpoint)
    return new CdpContextFactory(config);
  if (config.browser.isolated)
    return new IsolatedContextFactory(config);
  return new PersistentContextFactory(config);
}

export interface BrowserContextFactory {
  contexts(clientInfo: ClientInfo): Promise<playwright.BrowserContext[]>;
  createContext(clientInfo: ClientInfo): Promise<playwright.BrowserContext>;
}

export function identityBrowserContextFactory(browserContext: playwright.BrowserContext): BrowserContextFactory {
  return {
    contexts: async (clientInfo: ClientInfo) => {
      return [browserContext];
    },

    createContext: async (clientInfo: ClientInfo) => {
      return browserContext;
    }
  };
}

class BaseContextFactory implements BrowserContextFactory {
  readonly config: FullConfig;
  private _logName: string;
  protected _browserPromise: Promise<playwright.Browser> | undefined;

  constructor(name: string, config: FullConfig) {
    this._logName = name;
    this.config = config;
  }

  protected async _obtainBrowser(clientInfo: ClientInfo): Promise<playwright.Browser> {
    if (this._browserPromise)
      return this._browserPromise;
    testDebug(`obtain browser (${this._logName})`);
    this._browserPromise = this._doObtainBrowser(clientInfo);
    void this._browserPromise.then(browser => {
      browser.on('disconnected', () => {
        this._browserPromise = undefined;
      });
    }).catch(() => {
      this._browserPromise = undefined;
    });
    return this._browserPromise;
  }

  protected async _doObtainBrowser(clientInfo: ClientInfo): Promise<playwright.Browser> {
    throw new Error('Not implemented');
  }

  async contexts(clientInfo: ClientInfo): Promise<playwright.BrowserContext[]> {
    const browser = await this._obtainBrowser(clientInfo);
    return browser.contexts();
  }

  async createContext(clientInfo: ClientInfo): Promise<playwright.BrowserContext> {
    testDebug(`create browser context (${this._logName})`);
    const browser = await this._obtainBrowser(clientInfo);
    return await this._doCreateContext(browser, clientInfo);
  }

  protected async _doCreateContext(browser: playwright.Browser, clientInfo: ClientInfo): Promise<playwright.BrowserContext> {
    throw new Error('Not implemented');
  }
}

class IsolatedContextFactory extends BaseContextFactory {
  constructor(config: FullConfig) {
    super('isolated', config);
  }

  protected override async _doObtainBrowser(clientInfo: ClientInfo): Promise<playwright.Browser> {
    await injectCdpPort(this.config.browser);
    const browserType = playwright[this.config.browser.browserName];
    const tracesDir = await computeTracesDir(this.config, clientInfo);
    if (tracesDir && this.config.saveTrace)
      await startTraceServer(this.config, tracesDir);
    return browserType.launch({
      tracesDir,
      ...this.config.browser.launchOptions,
      handleSIGINT: false,
      handleSIGTERM: false,
    }).catch(error => {
      if (error.message.includes('Executable doesn\'t exist'))
        throwBrowserIsNotInstalledError(this.config);
      throw error;
    });
  }

  protected override async _doCreateContext(browser: playwright.Browser, clientInfo: ClientInfo): Promise<playwright.BrowserContext> {
    return browser.newContext(await browserContextOptionsFromConfig(this.config, clientInfo));
  }
}

class CdpContextFactory extends BaseContextFactory {
  constructor(config: FullConfig) {
    super('cdp', config);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    return playwright.chromium.connectOverCDP(this.config.browser.cdpEndpoint!, {
      headers: this.config.browser.cdpHeaders,
      timeout: this.config.browser.cdpTimeout
    });
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return this.config.browser.isolated ? await browser.newContext() : browser.contexts()[0];
  }
}

class RemoteContextFactory extends BaseContextFactory {
  constructor(config: FullConfig) {
    super('remote', config);
  }

  protected override async _doObtainBrowser(): Promise<playwright.Browser> {
    const url = new URL(this.config.browser.remoteEndpoint!);
    url.searchParams.set('browser', this.config.browser.browserName);
    if (this.config.browser.launchOptions)
      url.searchParams.set('launch-options', JSON.stringify(this.config.browser.launchOptions));
    return playwright[this.config.browser.browserName].connect(String(url));
  }

  protected override async _doCreateContext(browser: playwright.Browser): Promise<playwright.BrowserContext> {
    return browser.newContext();
  }
}

class PersistentContextFactory extends BaseContextFactory {
  readonly name = 'persistent';
  readonly description = 'Create a new persistent browser context';

  constructor(config: FullConfig) {
    super('persistent', config);
  }

  protected override async _doObtainBrowser(clientInfo: ClientInfo): Promise<playwright.Browser> {
    await injectCdpPort(this.config.browser);
    testDebug('create browser context (persistent)');
    const userDataDir = this.config.browser.userDataDir ?? await this._createUserDataDir(clientInfo);
    const tracesDir = await computeTracesDir(this.config, clientInfo);
    if (tracesDir && this.config.saveTrace)
      await startTraceServer(this.config, tracesDir);

    if (await isProfileLocked5Times(userDataDir))
      throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);

    const browserType = playwright[this.config.browser.browserName];
    const launchOptions: LaunchOptions & BrowserContextOptions = {
      tracesDir,
      ...this.config.browser.launchOptions,
      ...await browserContextOptionsFromConfig(this.config, clientInfo),
      handleSIGINT: false,
      handleSIGTERM: false,
      ignoreDefaultArgs: [
        '--disable-extensions',
      ],
      assistantMode: true,
    };
    try {
      const browserContext = await browserType.launchPersistentContext(userDataDir, launchOptions);
      return browserContext.browser()!;
    } catch (error: any) {
      if (error.message.includes('Executable doesn\'t exist'))
        throwBrowserIsNotInstalledError(this.config);
      if (error.message.includes('cannot open shared object file: No such file or directory')) {
        const browserName = launchOptions.channel ?? this.config.browser.browserName;
        throw new Error(`Missing system dependencies required to run browser ${browserName}. Install them with: sudo npx playwright install-deps ${browserName}`);
      }
      if (error.message.includes('ProcessSingleton') || error.message.includes('exitCode=21'))
        throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);
      throw error;
    }
  }

  private async _createUserDataDir(clientInfo: ClientInfo) {
    const dir = process.env.PWMCP_PROFILES_DIR_FOR_TEST ?? registryDirectory;
    const browserToken = this.config.browser.launchOptions?.channel ?? this.config.browser?.browserName;
    // Hesitant putting hundreds of files into the user's workspace, so using it for hashing instead.
    const rootPath = firstRootPath(clientInfo);
    const rootPathToken = rootPath ? `-${createHash(rootPath)}` : '';
    const result = path.join(dir, `mcp-${browserToken}${rootPathToken}`);
    await fs.promises.mkdir(result, { recursive: true });
    return result;
  }
}

async function injectCdpPort(browserConfig: FullConfig['browser']) {
  if (browserConfig.browserName === 'chromium')
    (browserConfig.launchOptions as any).cdpPort = await findFreePort();
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function startTraceServer(config: FullConfig, tracesDir: string): Promise<string | undefined> {
  if (!config.saveTrace)
    return;

  const server = await startTraceViewerServer();
  const urlPrefix = server.urlPrefix('human-readable');
  const url = urlPrefix + '/trace/index.html?trace=' + tracesDir + '/trace.json';
  // eslint-disable-next-line no-console
  console.error('\nTrace viewer listening on ' + url);
}

function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 7);
}

async function computeTracesDir(config: FullConfig, clientInfo: ClientInfo): Promise<string | undefined> {
  return path.resolve(outputDir(config, clientInfo), 'traces');
}

async function browserContextOptionsFromConfig(config: FullConfig, clientInfo: ClientInfo): Promise<playwright.BrowserContextOptions> {
  const result = { ...config.browser.contextOptions };
  if (config.saveVideo) {
    const dir = await outputFile(config, clientInfo, `videos`, { origin: 'code' });
    result.recordVideo = {
      dir,
      size: config.saveVideo,
    };
  }
  return result;
}

async function isProfileLocked5Times(userDataDir: string): Promise<boolean> {
  for (let i = 0; i < 5; i++) {
    if (!isProfileLocked(userDataDir))
      return false;
    await new Promise(f => setTimeout(f, 1000));
  }
  return true;
}

export function isProfileLocked(userDataDir: string): boolean {
  const lockFile = process.platform === 'win32' ? 'lockfile' : 'SingletonLock';
  const lockPath = path.join(userDataDir, lockFile);

  if (process.platform === 'win32') {
    try {
      const fd = fs.openSync(lockPath, 'r+');
      fs.closeSync(fd);
      return false;
    } catch (e: any) {
      return e.code !== 'ENOENT';
    }
  }

  try {
    const target = fs.readlinkSync(lockPath);
    const pid = parseInt(target.split('-').pop() || '', 10);
    if (isNaN(pid))
      return false;
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function throwBrowserIsNotInstalledError(config: FullConfig): never {
  const channel = config.browser.launchOptions?.channel ?? config.browser.browserName;
  if (config.skillMode)
    throw new Error(`Browser "${channel}" is not installed. Run \`playwright-cli install-browser ${channel}\` to install`);
  else
    throw new Error(`Browser "${channel}" is not installed. Either install it (likely) or change the config.`);
}

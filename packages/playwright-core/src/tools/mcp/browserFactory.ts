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
import path from 'path';

import { playwright } from '../../inprocess';
import { registryDirectory } from '../../server/registry/index';
import { testDebug } from './log';
import { outputDir } from '../backend/context';
import { createExtensionBrowser } from './extensionContextFactory';
import { connectToBrowserAcrossVersions } from '../utils/connect';
import { serverRegistry } from '../../serverRegistry';
// eslint-disable-next-line no-restricted-imports
import { connectToBrowser } from '../../client/connect';

import type { CDPBrowserConfig, ExtensionBrowserConfig, FullConfig, LocalBrowserConfig, RemoteBrowserConfig, ResolvedBrowser } from './config';
import type { ClientInfo } from '../utils/mcp/server';
// eslint-disable-next-line no-restricted-imports
import type { Playwright } from '../../client/playwright';
import type * as playwrightTypes from '../../..';
import type { BrowserInfo } from '../../serverRegistry';

type BrowserWithInfo = {
  browser: playwrightTypes.Browser,
  browserInfo: BrowserInfo,
  canBind: boolean,
  ownership: 'attached' | 'own',
};

export async function createBrowser(config: FullConfig, clientInfo: ClientInfo): Promise<playwrightTypes.Browser> {
  const { browser } = await createBrowserWithInfo(config, clientInfo);
  return browser;
}

export async function createBrowserWithInfo(config: FullConfig, clientInfo: ClientInfo): Promise<BrowserWithInfo> {
  if (config.browser.mode === 'local')
    return await createLocalBrowserWithInfo(config, config.browser, clientInfo);
  return await createAttachedBrowser(config.browser, clientInfo);
}

async function createAttachedBrowser(browserConfig: CDPBrowserConfig | RemoteBrowserConfig | ExtensionBrowserConfig, clientInfo: ClientInfo): Promise<BrowserWithInfo> {
  switch (browserConfig.mode) {
    case 'remote':
      return await createRemoteBrowser(browserConfig);
    case 'cdp': {
      const browser = await createCDPBrowser(browserConfig);
      return { browser, browserInfo: browserInfo(browser, browserConfig, undefined), canBind: true, ownership: 'attached' };
    }
    case 'extension': {
      const browser = await createExtensionBrowser(browserConfig.channel, clientInfo.clientName);
      return { browser, browserInfo: browserInfo(browser, browserConfig, undefined), canBind: false, ownership: 'attached' };
    }
  }
}

async function createLocalBrowserWithInfo(config: FullConfig, browserConfig: LocalBrowserConfig, clientInfo: ClientInfo): Promise<BrowserWithInfo> {
  if (browserConfig.isolated) {
    const browser = await createIsolatedBrowser(config, browserConfig, clientInfo);
    return { browser, browserInfo: browserInfo(browser, browserConfig, undefined), canBind: true, ownership: 'own' };
  }
  const userDataDir = browserConfig.userDataDir ?? await createUserDataDir(browserConfig, clientInfo);
  const browser = await createPersistentBrowser(config, browserConfig, userDataDir, clientInfo);
  return { browser, browserInfo: browserInfo(browser, browserConfig, userDataDir), canBind: true, ownership: 'own' };
}

export interface BrowserContextFactory {
  contexts(clientInfo: ClientInfo): Promise<playwrightTypes.BrowserContext[]>;
  createContext(clientInfo: ClientInfo): Promise<playwrightTypes.BrowserContext>;
}

type BrowserLike = {
  contexts(): playwrightTypes.BrowserContext[];
  newContext(options?: playwrightTypes.BrowserContextOptions): Promise<playwrightTypes.BrowserContext>;
};

export async function acquireBrowserContext(browser: BrowserLike, browserConfig: ResolvedBrowser): Promise<playwrightTypes.BrowserContext> {
  if (browserConfig.isolated)
    return await browser.newContext(browserConfig.contextOptions);
  return browser.contexts()[0];
}

function browserInfo(browser: playwrightTypes.Browser, browserConfig: ResolvedBrowser, userDataDir: string | undefined): BrowserInfo {
  // eslint-disable-next-line no-restricted-syntax
  const guid = (browser as any)._guid;
  const browserName = browserConfig.browserName;
  switch (browserConfig.mode) {
    case 'local':
      return { guid, browserName, launchOptions: browserConfig.launchOptions, userDataDir };
    case 'extension':
      return { guid, browserName, launchOptions: { channel: browserConfig.channel }, userDataDir };
    case 'cdp':
    case 'remote':
      return { guid, browserName, launchOptions: {}, userDataDir };
  }
}

async function createIsolatedBrowser(config: FullConfig, browserConfig: LocalBrowserConfig, clientInfo: ClientInfo): Promise<playwrightTypes.Browser> {
  testDebug('create browser (isolated)');
  const browserType = playwright[browserConfig.browserName];
  const tracesDir = await computeTracesDir(config, clientInfo);
  const browser = await browserType.launch({
    tracesDir,
    ...browserConfig.launchOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
  }).catch(error => {
    if (error.message.includes('Executable doesn\'t exist'))
      throwBrowserIsNotInstalledError(config, browserConfig);
    throw error;
  });
  return browser;
}

async function createCDPBrowser(browserConfig: CDPBrowserConfig): Promise<playwrightTypes.Browser> {
  testDebug('create browser (cdp)');
  const browser = await playwright.chromium.connectOverCDP(browserConfig.cdpEndpoint, {
    headers: browserConfig.cdpHeaders,
    timeout: browserConfig.cdpTimeout
  });
  return browser;
}

async function createRemoteBrowser(browserConfig: RemoteBrowserConfig): Promise<BrowserWithInfo> {
  testDebug('create browser (remote)');
  const descriptor = await serverRegistry.find(browserConfig.remoteEndpoint);
  if (descriptor) {
    const browser = await connectToBrowserAcrossVersions(descriptor);
    return {
      browser,
      browserInfo: {
        guid: descriptor.browser.guid,
        browserName: descriptor.browser.browserName,
        launchOptions: descriptor.browser.launchOptions,
        userDataDir: descriptor.browser.userDataDir
      },
      canBind: false,
      ownership: 'attached'
    };
  }

  const playwrightObject = playwright as Playwright;
  // Use connectToBrowser instead of playwright[browserName].connect because we don't have browserName.
  const browser = await connectToBrowser(playwrightObject, { endpoint: browserConfig.remoteEndpoint });
  browser._connectToBrowserType(playwrightObject[browser._browserName], {}, undefined);
  return {
    browser,
    browserInfo: browserInfo(browser, browserConfig, undefined),
    canBind: false,
    ownership: 'attached',
  };
}

async function createPersistentBrowser(config: FullConfig, browserConfig: LocalBrowserConfig, userDataDir: string, clientInfo: ClientInfo): Promise<playwrightTypes.Browser> {
  testDebug('create browser (persistent)');
  const tracesDir = await computeTracesDir(config, clientInfo);

  if (await isProfileLocked5Times(userDataDir))
    throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);

  const browserType = playwright[browserConfig.browserName];
  const configIgnoreDefaultArgs = browserConfig.launchOptions?.ignoreDefaultArgs;
  const launchOptions: playwrightTypes.LaunchOptions & playwrightTypes.BrowserContextOptions = {
    tracesDir,
    ...browserConfig.launchOptions,
    ...browserConfig.contextOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
    ignoreDefaultArgs: configIgnoreDefaultArgs === true
      ? true
      : [
        '--disable-extensions',
        ...Array.isArray(configIgnoreDefaultArgs) ? configIgnoreDefaultArgs : [],
      ],
  };
  try {
    const browserContext = await browserType.launchPersistentContext(userDataDir, launchOptions);
    const browser = browserContext.browser()!;
    return browser;
  } catch (error: any) {
    if (error.message.includes('Executable doesn\'t exist'))
      throwBrowserIsNotInstalledError(config, browserConfig);
    if (error.message.includes('cannot open shared object file: No such file or directory')) {
      const browserName = launchOptions.channel ?? browserConfig.browserName;
      throw new Error(`Missing system dependencies required to run browser ${browserName}. Install them with: sudo npx playwright install-deps ${browserName}`);
    }
    if (error.message.includes('ProcessSingleton') || error.message.includes('exitCode=21'))
      throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);
    throw error;
  }
}

async function createUserDataDir(browserConfig: LocalBrowserConfig, clientInfo: ClientInfo) {
  const dir = process.env.PWMCP_PROFILES_DIR_FOR_TEST ?? registryDirectory;
  const browserToken = browserConfig.launchOptions.channel ?? browserConfig.browserName;
  // Hesitant putting hundreds of files into the user's workspace, so using it for hashing instead.
  const rootPathToken = createHash(clientInfo.cwd);
  const result = path.join(dir, `mcp-${browserToken}-${rootPathToken}`);
  await fs.promises.mkdir(result, { recursive: true });
  return result;
}

function createHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 7);
}

async function computeTracesDir(config: FullConfig, clientInfo: ClientInfo): Promise<string | undefined> {
  return path.resolve(outputDir({ config, cwd: clientInfo.cwd }), 'traces');
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

function throwBrowserIsNotInstalledError(config: FullConfig, browserConfig: LocalBrowserConfig): never {
  const channel = browserConfig.launchOptions.channel ?? browserConfig.browserName;
  if (config.skillMode)
    throw new Error(`Browser "${channel}" is not installed. Run \`playwright-cli install-browser ${channel}\` to install`);
  else
    throw new Error(`Browser "${channel}" is not installed. Run \`npx @playwright/mcp install-browser ${channel}\` to install`);
}

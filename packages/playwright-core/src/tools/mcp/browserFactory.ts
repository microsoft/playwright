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
import { testDebug } from './log';
import { outputDir } from '../backend/context';
import { createExtensionBrowser } from './extensionContextFactory';
import { connectToBrowser, connectToBrowserAcrossVersions } from '../../client/connect';
import { serverRegistry } from '../../serverRegistry';

import type { FullConfig } from './config';
import type { ConnectOptions } from '../../client/types';
import type { ClientInfo } from '../utils/mcp/server';
import type { Playwright } from '../../client/playwright';

export async function createBrowser(config: FullConfig, clientInfo: ClientInfo): Promise<playwright.Browser> {
  if (config.browser.remoteEndpoint)
    return await createRemoteBrowser(config);
  if (config.browser.cdpEndpoint)
    return await createCDPBrowser(config);
  if (config.browser.isolated)
    return await createIsolatedBrowser(config, clientInfo);
  if (config.extension)
    return await createExtensionBrowser(config, clientInfo);
  return await createPersistentBrowser(config, clientInfo);
}

export interface BrowserContextFactory {
  contexts(clientInfo: ClientInfo): Promise<playwright.BrowserContext[]>;
  createContext(clientInfo: ClientInfo): Promise<playwright.BrowserContext>;
}

async function createIsolatedBrowser(config: FullConfig, clientInfo: ClientInfo): Promise<playwright.Browser> {
  testDebug('create browser (isolated)');
  await injectCdpPort(config.browser);
  const browserType = playwright[config.browser.browserName];
  const tracesDir = await computeTracesDir(config, clientInfo);
  return await browserType.launch({
    tracesDir,
    ...config.browser.launchOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
  }).catch(error => {
    if (error.message.includes('Executable doesn\'t exist'))
      throwBrowserIsNotInstalledError(config);
    throw error;
  });
}

async function createCDPBrowser(config: FullConfig): Promise<playwright.Browser> {
  testDebug('create browser (cdp)');
  return playwright.chromium.connectOverCDP(config.browser.cdpEndpoint!, {
    headers: config.browser.cdpHeaders,
    timeout: config.browser.cdpTimeout
  });
}

async function createRemoteBrowser(config: FullConfig): Promise<playwright.Browser> {
  testDebug('create browser (remote)');
  const descriptor = await serverRegistry.find(config.browser.remoteEndpoint!);
  if (descriptor)
    return await connectToBrowserAcrossVersions(descriptor);

  const endpoint = config.browser.remoteEndpoint!;
  const params: ConnectOptions = { endpoint };
  const playwrightObject = playwright as Playwright;
  const browser = await connectToBrowser(playwrightObject, params);
  browser._connectToBrowserType(playwrightObject[browser._browserName], {}, undefined);
  return browser;
}

async function createPersistentBrowser(config: FullConfig, clientInfo: ClientInfo): Promise<playwright.Browser> {
  testDebug('create browser (persistent)');
  await injectCdpPort(config.browser);
  const userDataDir = config.browser.userDataDir ?? await createUserDataDir(config, clientInfo);
  const tracesDir = await computeTracesDir(config, clientInfo);

  if (await isProfileLocked5Times(userDataDir))
    throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);

  const browserType = playwright[config.browser.browserName];
  const launchOptions: playwright.LaunchOptions & playwright.BrowserContextOptions = {
    tracesDir,
    ...config.browser.launchOptions,
    ...config.browser.contextOptions,
    handleSIGINT: false,
    handleSIGTERM: false,
    ignoreDefaultArgs: [
      '--disable-extensions',
    ],
    assistantMode: true,
  } as any;
  try {
    const browserContext = await browserType.launchPersistentContext(userDataDir, launchOptions);
    return browserContext.browser()!;
  } catch (error: any) {
    if (error.message.includes('Executable doesn\'t exist'))
      throwBrowserIsNotInstalledError(config);
    if (error.message.includes('cannot open shared object file: No such file or directory')) {
      const browserName = launchOptions.channel ?? config.browser.browserName;
      throw new Error(`Missing system dependencies required to run browser ${browserName}. Install them with: sudo npx playwright install-deps ${browserName}`);
    }
    if (error.message.includes('ProcessSingleton') || error.message.includes('exitCode=21'))
      throw new Error(`Browser is already in use for ${userDataDir}, use --isolated to run multiple instances of the same browser`);
    throw error;
  }
}

async function createUserDataDir(config: FullConfig, clientInfo: ClientInfo) {
  const dir = process.env.PWMCP_PROFILES_DIR_FOR_TEST ?? registryDirectory;
  const browserToken = config.browser.launchOptions?.channel ?? config.browser?.browserName;
  // Hesitant putting hundreds of files into the user's workspace, so using it for hashing instead.
  const rootPathToken = createHash(clientInfo.cwd);
  const result = path.join(dir, `mcp-${browserToken}-${rootPathToken}`);
  await fs.promises.mkdir(result, { recursive: true });
  return result;
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

function throwBrowserIsNotInstalledError(config: FullConfig): never {
  const channel = config.browser.launchOptions?.channel ?? config.browser.browserName;
  if (config.skillMode)
    throw new Error(`Browser "${channel}" is not installed. Run \`playwright-cli install-browser ${channel}\` to install`);
  else
    throw new Error(`Browser "${channel}" is not installed. Run \`npx @playwright/mcp install-browser ${channel}\` to install`);
}

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
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import * as path from 'path';
import type { BrowserContext, BrowserContextOptions, BrowserType, Page } from 'playwright-core';
import { removeFolders } from '../../packages/playwright-core/lib/utils/fileUtils';
import { baseTest } from './baseTest';
import { type RemoteServerOptions, type PlaywrightServer, RunServer, RemoteServer } from './remoteServer';
import type { Log } from '../../packages/trace/src/har';
import { parseHar } from '../config/utils';

export type BrowserTestWorkerFixtures = PageWorkerFixtures & {
  browserVersion: string;
  defaultSameSiteCookieValue: string;
  allowsThirdParty: boolean;
  browserMajorVersion: number;
  browserType: BrowserType;
  isAndroid: boolean;
  isElectron: boolean;
};

interface StartRemoteServer {
  (kind: 'run-server' | 'launchServer'): Promise<PlaywrightServer>;
  (kind: 'launchServer', options?: RemoteServerOptions): Promise<RemoteServer>;
}

type BrowserTestTestFixtures = PageTestFixtures & {
  createUserDataDir: () => Promise<string>;
  launchPersistent: (options?: Parameters<BrowserType['launchPersistentContext']>[1]) => Promise<{ context: BrowserContext, page: Page }>;
  startRemoteServer: StartRemoteServer;
  contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
  pageWithHar(options?: { outputPath?: string, content?: 'embed' | 'attach' | 'omit', omitContent?: boolean }): Promise<{ context: BrowserContext, page: Page, getLog: () => Promise<Log>, getZip: () => Promise<Map<string, Buffer>> }>
};

const test = baseTest.extend<BrowserTestTestFixtures, BrowserTestWorkerFixtures>({
  browserVersion: [async ({ browser }, run) => {
    await run(browser.version());
  }, { scope: 'worker' }],

  browserType: [async ({ playwright, browserName, mode }, run) => {
    test.skip(mode === 'service2');
    await run(playwright[browserName]);
  }, { scope: 'worker' }],

  allowsThirdParty: [async ({ browserName, browserMajorVersion, channel }, run) => {
    if (browserName === 'firefox' && !channel)
      await run(browserMajorVersion >= 103);
    else if (browserName === 'firefox' && channel === 'firefox-beta')
      await run(browserMajorVersion < 103 || browserMajorVersion >= 110);
    else
      await run(false);
  }, { scope: 'worker' }],

  defaultSameSiteCookieValue: [async ({ browserName, browserMajorVersion, channel, isLinux }, run) => {
    if (browserName === 'chromium')
      await run('Lax');
    else if (browserName === 'webkit' && isLinux)
      await run('Lax');
    else if (browserName === 'webkit' && !isLinux)
      await run('None');
    else if (browserName === 'firefox' && channel === 'firefox-beta')
      await run(browserMajorVersion >= 103 && browserMajorVersion < 110 ? 'Lax' : 'None');
    else if (browserName === 'firefox' && channel !== 'firefox-beta')
      await run(browserMajorVersion >= 103 ? 'None' : 'Lax');
    else
      throw new Error('unknown browser - ' + browserName);
  }, { scope: 'worker' }],

  browserMajorVersion: [async ({ browserVersion }, run) => {
    await run(Number(browserVersion.split('.')[0]));
  }, { scope: 'worker' }],

  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isWebView2: [false, { scope: 'worker' }],

  contextFactory: async ({ _contextFactory }: any, run) => {
    await run(_contextFactory);
  },

  createUserDataDir: async ({ mode }, run) => {
    test.skip(mode.startsWith('service'));
    const dirs: string[] = [];
    // We do not put user data dir in testOutputPath,
    // because we do not want to upload them as test result artifacts.
    //
    // Additionally, it is impossible to upload user data dir after test run:
    // - Firefox removes lock file later, presumably from another watchdog process?
    // - WebKit has circular symlinks that makes CI go crazy.
    await run(async () => {
      const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-'));
      dirs.push(dir);
      return dir;
    });
    await removeFolders(dirs);
  },

  launchPersistent: async ({ createUserDataDir, browserType }, run) => {
    let persistentContext: BrowserContext | undefined;
    await run(async options => {
      if (persistentContext)
        throw new Error('can only launch one persistent context');
      const userDataDir = await createUserDataDir();
      persistentContext = await browserType.launchPersistentContext(userDataDir, { ...options });
      const page = persistentContext.pages()[0];
      return { context: persistentContext, page };
    });
    if (persistentContext)
      await persistentContext.close();
  },

  startRemoteServer: async ({ childProcess, browserType }, run) => {
    let server: PlaywrightServer | undefined;
    const fn = async (kind: 'launchServer' | 'run-server', options?: RemoteServerOptions) => {
      if (server)
        throw new Error('can only start one remote server');
      if (kind === 'launchServer') {
        const remoteServer = new RemoteServer();
        await remoteServer._start(childProcess, browserType, options);
        server = remoteServer;
      } else {
        const runServer = new RunServer();
        await runServer.start(childProcess);
        server = runServer;
      }
      return server;
    };
    await run(fn as any);
    if (server) {
      await server.close();
      // Give any connected browsers a chance to disconnect to avoid
      // poisoning next test with quasy-alive browsers.
      await new Promise(f => setTimeout(f, 1000));
    }
  },
  pageWithHar: async ({ contextFactory }, use, testInfo) => {
    const pageWithHar = async (options: { outputPath?: string, content?: 'embed' | 'attach' | 'omit', omitContent?: boolean } = {}) => {
      const harPath = testInfo.outputPath(options.outputPath || 'test.har');
      const context = await contextFactory({ recordHar: { path: harPath, content: options.content, omitContent: options.omitContent }, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      return {
        page,
        context,
        getLog: async () => {
          await context.close();
          return JSON.parse(fs.readFileSync(harPath).toString())['log'] as Log;
        },
        getZip: async () => {
          await context.close();
          return parseHar(harPath);
        },
      };
    };
    await use(pageWithHar);
  }
});

export const playwrightTest = test;
export const browserTest = test;
export const contextTest = test;

export { expect } from '@playwright/test';

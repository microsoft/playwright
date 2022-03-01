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
import { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import * as path from 'path';
import type { BrowserContext, BrowserContextOptions, BrowserType, Page } from 'playwright-core';
import { removeFolders } from '../../packages/playwright-core/lib/utils/utils';
import { baseTest } from './baseTest';
import { RemoteServer, RemoteServerOptions } from './remoteServer';

export type BrowserTestWorkerFixtures = PageWorkerFixtures & {
  browserVersion: string;
  browserMajorVersion: number;
  browserType: BrowserType;
  isAndroid: boolean;
  isElectron: boolean;
};

type BrowserTestTestFixtures = PageTestFixtures & {
  createUserDataDir: () => Promise<string>;
  launchPersistent: (options?: Parameters<BrowserType['launchPersistentContext']>[1]) => Promise<{ context: BrowserContext, page: Page }>;
  startRemoteServer: (options?: RemoteServerOptions) => Promise<RemoteServer>;
  contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
};

const test = baseTest.extend<BrowserTestTestFixtures, BrowserTestWorkerFixtures>({
  browserVersion: [async ({ browser }, run) => {
    await run(browser.version());
  }, { scope: 'worker' } ],

  browserType: [async ({ playwright, browserName }, run) => {
    await run(playwright[browserName]);
  }, { scope: 'worker' } ],

  defaultSameSiteCookieValue: [async ({ browserName, browserMajorVersion }, run) => {
    await run(browserName === 'chromium' || (browserName === 'firefox' && browserMajorVersion >= 96 && browserMajorVersion <= 97) ? 'Lax' : 'None');
  }, { scope: 'worker' } ],

  browserMajorVersion: [async ({ browserVersion }, run) => {
    await run(Number(browserVersion.split('.')[0]));
  }, { scope: 'worker' } ],

  isAndroid: [false, { scope: 'worker' } ],
  isElectron: [false, { scope: 'worker' } ],

  contextFactory: async ({ _contextFactory }: any, run) => {
    await run(_contextFactory);
  },

  createUserDataDir: async ({}, run) => {
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
    let remoteServer: RemoteServer | undefined;
    await run(async options => {
      if (remoteServer)
        throw new Error('can only start one remote server');
      remoteServer = new RemoteServer();
      await remoteServer._start(childProcess, browserType, options);
      return remoteServer;
    });
    if (remoteServer) {
      await remoteServer.close();
      // Give any connected browsers a chance to disconnect to avoid
      // poisoning next test with quasy-alive browsers.
      await new Promise(f => setTimeout(f, 1000));
    }
  },
});

export const playwrightTest = test;
export const browserTest = test;
export const contextTest = test;

export { expect } from '@playwright/test';

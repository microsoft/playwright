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
import { baseTest } from './baseTest';
import { RunServer, RemoteServer } from './remoteServer';
import { removeFolders } from '../../packages/playwright-core/lib/server/utils/fileUtils';
import { parseHar } from '../config/utils';
import { createSkipTestPredicate } from '../bidi/expectationUtil';

import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { RemoteServerOptions, PlaywrightServer } from './remoteServer';
import type { BrowserContext, BrowserContextOptions, BrowserType, Page } from 'playwright-core';
import type { Log } from '../../packages/trace/src/har';
import type { TestInfo } from '@playwright/test';

export type BrowserTestWorkerFixtures = PageWorkerFixtures & {
  browserVersion: string;
  defaultSameSiteCookieValue: string;
  allowsThirdParty: boolean;
  browserMajorVersion: number;
  browserType: BrowserType;
  isAndroid: boolean;
  isElectron: boolean;
  isHeadlessShell: boolean;
  nodeVersion: { major: number, minor: number, patch: number };
  bidiTestSkipPredicate: (info: TestInfo) => boolean;
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
  autoSkipBidiTest: void;
};

const test = baseTest.extend<BrowserTestTestFixtures, BrowserTestWorkerFixtures>({
  browserVersion: [async ({ browser }, run) => {
    await run(browser.version());
  }, { scope: 'worker' }],

  browserType: [async ({ playwright, browserName, mode }, run) => {
    test.skip(mode === 'service2');
    await run(playwright[browserName]);
  }, { scope: 'worker' }],

  allowsThirdParty: [async ({ browserName }, run) => {
    if (browserName === 'firefox' || browserName as any === '_bidiFirefox')
      await run(true);
    else
      await run(false);
  }, { scope: 'worker' }],

  defaultSameSiteCookieValue: [async ({ browserName, platform, macVersion }, run) => {
    if (browserName === 'chromium' || browserName as any === '_bidiChromium')
      await run('Lax');
    else if (browserName === 'webkit' && platform === 'linux')
      await run('Lax');
    else if (browserName === 'webkit')
      await run('None'); // Windows + older macOS
    else if (browserName === 'firefox' || browserName as any === '_bidiFirefox')
      await run('None');
    else
      throw new Error('unknown browser - ' + browserName);
  }, { scope: 'worker' }],

  browserMajorVersion: [async ({ browserVersion }, run) => {
    await run(Number(browserVersion.split('.')[0]));
  }, { scope: 'worker' }],

  nodeVersion: [async ({}, use) => {
    const [major, minor, patch] = process.versions.node.split('.');
    await use({ major: +major, minor: +minor, patch: +patch });
  }, { scope: 'worker' }],

  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isWebView2: [false, { scope: 'worker' }],

  isHeadlessShell: [async ({ browserName, channel, headless }, use) => {
    await use(browserName === 'chromium' && (channel === 'chromium-headless-shell' || channel === 'chromium-tip-of-tree-headless-shell' || (!channel && headless)));
  }, { scope: 'worker' }],

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

  startRemoteServer: async ({ childProcess, browserType, channel }, run) => {
    let server: PlaywrightServer | undefined;
    const fn = async (kind: 'launchServer' | 'run-server', options?: RemoteServerOptions) => {
      if (server)
        throw new Error('can only start one remote server');
      if (kind === 'launchServer') {
        const remoteServer = new RemoteServer();
        await remoteServer._start(childProcess, browserType, channel, options);
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
  },

  bidiTestSkipPredicate: [async ({ }, run) => {
    const filter = await createSkipTestPredicate(test.info().project.name);
    await run(filter);
  }, { scope: 'worker' }],

  autoSkipBidiTest: [async ({ bidiTestSkipPredicate }, run) => {
    test.fixme(bidiTestSkipPredicate(test.info()), 'marked as timeout in bidi expectations');
    await run();
  }, { auto: true, scope: 'test' }],
});

export const playwrightTest = test;
export const browserTest = test;
export const contextTest = test;

export { expect } from '@playwright/test';

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

import type { Fixtures, PlaywrightTestOptions, PlaywrightWorkerOptions } from '@playwright/test';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions, Page } from 'playwright-core';
import { removeFolders } from 'playwright-core/lib/utils/utils';
import { browserOptionsWorkerFixture, browserTypeWorkerFixture, browserWorkerFixture, ReuseBrowserContextStorage } from '../../packages/playwright-test/lib/index';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { RemoteServer, RemoteServerOptions } from './remoteServer';
import { baseTest } from './baseTest';
import { CommonFixtures } from './commonFixtures';
import type { ParsedStackTrace } from 'playwright-core/lib/utils/stackTrace';
import { DefaultTestMode, DriverTestMode, ServiceTestMode } from './testMode';
import { TestModeWorkerFixtures } from './testModeFixtures';

export type PlaywrightWorkerFixtures = {
  playwright: typeof import('playwright-core');
  _browserType: BrowserType;
  _browserOptions: LaunchOptions;
  browserType: BrowserType;
  browser: Browser;
  browserVersion: string;
  _reuseBrowserContext: ReuseBrowserContextStorage;
  toImpl: (rpcObject: any) => any;
};

type PlaywrightTestFixtures = {
  createUserDataDir: () => Promise<string>;
  launchPersistent: (options?: Parameters<BrowserType['launchPersistentContext']>[1]) => Promise<{ context: BrowserContext, page: Page }>;
  startRemoteServer: (options?: RemoteServerOptions) => Promise<RemoteServer>;
  contextOptions: BrowserContextOptions;
  contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
  context: BrowserContext;
  page: Page;
};

export const playwrightFixtures: Fixtures<PlaywrightTestOptions & PlaywrightTestFixtures, PlaywrightWorkerOptions & PlaywrightWorkerFixtures, CommonFixtures, TestModeWorkerFixtures> = {
  hasTouch: undefined,

  playwright: [ async ({ mode }, run) => {
    const testMode = {
      default: new DefaultTestMode(),
      service: new ServiceTestMode(),
      driver: new DriverTestMode(),
    }[mode];
    require('playwright-core/lib/utils/utils').setUnderTest();
    const playwright = await testMode.setup();
    await run(playwright);
    await testMode.teardown();
  }, { scope: 'worker' } ],

  toImpl: [ async ({ playwright }, run) => run((playwright as any)._toImpl), { scope: 'worker' } ],

  _browserType: [browserTypeWorkerFixture, { scope: 'worker' } ],
  _browserOptions: [browserOptionsWorkerFixture, { scope: 'worker' } ],

  launchOptions: [ {}, { scope: 'worker' } ],
  browserType: [async ({ _browserType }, use) => use(_browserType), { scope: 'worker' } ],
  browser: [browserWorkerFixture, { scope: 'worker' } ],

  browserVersion: [async ({ browser }, run) => {
    await run(browser.version());
  }, { scope: 'worker' } ],

  _reuseBrowserContext: [new ReuseBrowserContextStorage(), { scope: 'worker' }],

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
        throw new Error('can only launch one persitent context');
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
    if (remoteServer)
      await remoteServer.close();
  },

  contextOptions: async ({ video, hasTouch }, run, testInfo) => {
    const debugName = path.relative(testInfo.project.outputDir, testInfo.outputDir).replace(/[\/\\]/g, '-');
    const contextOptions = {
      recordVideo: video === 'on' ? { dir: testInfo.outputPath('') } : undefined,
      _debugName: debugName,
      hasTouch,
    } as BrowserContextOptions;
    await run(contextOptions);
  },

  contextFactory: async ({ browser, contextOptions, trace }, run, testInfo) => {
    const contexts = new Map<BrowserContext, { closed: boolean }>();
    await run(async options => {
      const context = await browser.newContext({ ...contextOptions, ...options });
      contexts.set(context, { closed: false });
      context.on('close', () => contexts.get(context).closed = true);
      if (trace === 'on')
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true } as any);
      (context as any)._instrumentation.addListener({
        onApiCallBegin: (apiCall: string, stackTrace: ParsedStackTrace | null, userData: any) => {
          if (apiCall.startsWith('expect.'))
            return { userObject: null };
          const testInfoImpl = testInfo as any;
          const step = testInfoImpl._addStep({
            location: stackTrace?.frames[0],
            category: 'pw:api',
            title: apiCall,
            canHaveChildren: false,
            forceNoParent: false
          });
          userData.userObject = step;
        },
        onApiCallEnd: (userData: any, error?: Error) => {
          const step = userData.userObject;
          step?.complete(error);
        },
      });
      return context;
    });
    await Promise.all([...contexts.keys()].map(async context => {
      const videos = context.pages().map(p => p.video()).filter(Boolean);
      if (trace === 'on' && !contexts.get(context)!.closed) {
        const tracePath = testInfo.outputPath('trace.zip');
        await context.tracing.stop({ path: tracePath });
        testInfo.attachments.push({ name: 'trace', path: tracePath, contentType: 'application/zip' });
      }
      await context.close();
      for (const v of videos) {
        const videoPath = await v.path().catch(() => null);
        if (!videoPath)
          continue;
        const savedPath = testInfo.outputPath(path.basename(videoPath));
        await v.saveAs(savedPath);
        testInfo.attachments.push({ name: 'video', path: savedPath, contentType: 'video/webm' });
      }
    }));
  },

  context: async ({ contextFactory, browser, _reuseBrowserContext, contextOptions }, run) => {
    if (_reuseBrowserContext.isEnabled()) {
      const context = await _reuseBrowserContext.obtainContext(browser, contextOptions);
      await run(context);
      return;
    }
    await run(await contextFactory());
  },

  page: async ({ context, _reuseBrowserContext }, run) => {
    if (_reuseBrowserContext.isEnabled()) {
      await run(await _reuseBrowserContext.obtainPage());
      return;
    }
    await run(await context.newPage());
  },

  browserName: [ 'chromium' , { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  video: [ 'off', { scope: 'worker' } ],
  trace: [ 'off', { scope: 'worker' } ],
};

const test = baseTest.extend<PlaywrightTestOptions & PlaywrightTestFixtures, PlaywrightWorkerOptions & PlaywrightWorkerFixtures>(playwrightFixtures);
export const playwrightTest = test;
export const browserTest = test;
export const contextTest = test;

export { expect } from '@playwright/test';

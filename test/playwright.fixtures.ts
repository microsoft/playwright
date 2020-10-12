/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config, folio as base } from 'folio';
import type { Browser, BrowserContext, BrowserContextOptions, BrowserType, LaunchOptions, Page } from '../index';
import * as path from 'path';

// Parameters ------------------------------------------------------------------
// ... these can be used to run tests in different modes.

type PlaywrightParameters = {
  // Browser type name.
  browserName: 'chromium' | 'firefox' | 'webkit';
  // Whether to run tests headless or headful.
  headful: boolean;
  // Operating system.
  platform: 'win32' | 'linux' | 'darwin';
  // Generate screenshot on failure.
  screenshotOnFailure: boolean;
  // Slows down Playwright operations by the specified amount of milliseconds.
  slowMo: number;
  // Whether to record the execution trace.
  trace: boolean;
};


// Worker fixture declarations -------------------------------------------------
// ... these live as long as the worker process.

type PlaywrightWorkerFixtures = {
  // Playwright library.
  playwright: typeof import('../index');
  // Browser type (Chromium / WebKit / Firefox)
  browserType: BrowserType<Browser>;
  // Default browserType.launch() options.
  defaultBrowserOptions: LaunchOptions;
  // Browser instance, shared for the worker.
  browser: Browser;
  // True iff browserName is Chromium
  isChromium: boolean;
  // True iff browserName is Firefox
  isFirefox: boolean;
  // True iff browserName is WebKit
  isWebKit: boolean;
  // True iff running on Windows.
  isWindows: boolean;
  // True iff running on Mac.
  isMac: boolean;
  // True iff running on Linux.
  isLinux: boolean;
};


// Test fixture definitions, those are created for each test ------------------

type PlaywrightTestFixtures = {
  // Default browser.newContext() options.
  defaultContextOptions: BrowserContextOptions;
  // Factory for creating a context with given additional options.
  contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>;
  // Context instance for test.
  context: BrowserContext;
  // Page instance for test.
  page: Page;
};

const fixtures = base.extend<PlaywrightWorkerFixtures, PlaywrightTestFixtures, PlaywrightParameters>();
fixtures.browserName.initParameter('Browser type name', (process.env.BROWSER || 'chromium') as 'chromium' | 'firefox' | 'webkit');
fixtures.headful.initParameter('Whether to run tests headless or headful', process.env.HEADFUL ? true : false);
fixtures.platform.initParameter('Operating system', process.platform as ('win32' | 'linux' | 'darwin'));
fixtures.screenshotOnFailure.initParameter('Generate screenshot on failure', false);
fixtures.slowMo.initParameter('Slows down Playwright operations by the specified amount of milliseconds', 0);
fixtures.trace.initParameter('Whether to record the execution trace', !!process.env.TRACING);

fixtures.defaultBrowserOptions.initWorker(async ({ headful, slowMo }, run) => {
  await run({
    handleSIGINT: false,
    slowMo,
    headless: !headful,
  });
});

fixtures.playwright.initWorker(async ({ }, run) => {
  const playwright = require('../index');
  await run(playwright);
});

fixtures.browserType.initWorker(async ({ playwright, browserName }, run) => {
  const browserType = (playwright as any)[browserName];
  await run(browserType);
});

fixtures.browser.initWorker(async ({ browserType, defaultBrowserOptions }, run) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  await run(browser);
  await browser.close();
});

fixtures.isChromium.initWorker(async ({ browserName }, run) => {
  await run(browserName === 'chromium');
});

fixtures.isFirefox.initWorker(async ({ browserName }, run) => {
  await run(browserName === 'firefox');
});

fixtures.isWebKit.initWorker(async ({ browserName }, run) => {
  await run(browserName === 'webkit');
});

fixtures.isWindows.initWorker(async ({ platform }, run) => {
  await run(platform === 'win32');
});

fixtures.isMac.initWorker(async ({ platform }, run) => {
  await run(platform === 'darwin');
});

fixtures.isLinux.initWorker(async ({ platform }, run) => {
  await run(platform === 'linux');
});

fixtures.defaultContextOptions.initTest(async ({ trace, testInfo }, run) => {
  if (trace || testInfo.retry) {
    await run({
      _traceResourcesPath: path.join(config.outputDir, 'trace-resources'),
      _tracePath: testInfo.outputPath('playwright.trace'),
      videosPath: testInfo.outputPath(''),
    } as any);
  } else {
    await run({});
  }
});

fixtures.contextFactory.initTest(async ({ browser, defaultContextOptions, testInfo, screenshotOnFailure }, run) => {
  const contexts: BrowserContext[] = [];
  async function contextFactory(options: BrowserContextOptions = {}) {
    const context = await browser.newContext({ ...defaultContextOptions, ...options });
    contexts.push(context);
    return context;
  }
  await run(contextFactory);

  if (screenshotOnFailure && (testInfo.status !== testInfo.expectedStatus)) {
    let ordinal = 0;
    for (const context of contexts) {
      for (const page of context.pages())
        await page.screenshot({ timeout: 5000, path: testInfo.outputPath + `-test-failed-${++ordinal}.png` });
    }
  }
  for (const context of contexts)
    await context.close();
});

fixtures.context.initTest(async ({ contextFactory }, run) => {
  const context = await contextFactory();
  await run(context);
  // Context factory is taking care of closing the context,
  // so that it could capture a screenshot on failure.
});

fixtures.page.initTest(async ({ context }, run) => {
  // Always create page off context so that they matched.
  await run(await context.newPage());
  // Context fixture is taking care of closing the page.
});

fixtures.testParametersPathSegment.overrideTest(async ({ browserName, platform }, run) => {
  await run(browserName + '-' + platform);
});

export const folio = fixtures.build();

// If browser is not specified, we are running tests against all three browsers.
folio.generateParametrizedTests(
    'browserName',
    process.env.BROWSER ? [process.env.BROWSER] as any : ['chromium', 'webkit', 'firefox']);

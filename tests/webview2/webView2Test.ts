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

import { baseTest } from '../config/baseTest';
import * as path from 'path';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
export { expect } from '@playwright/test';
import { TestChildProcess } from '../config/commonFixtures';
import { DEFAULT_ARGS } from '../../packages/playwright-core/lib/server/chromium/chromium';

type WebView2WorkerFixtures = PageWorkerFixtures & {
  webView2CdpPort: number;
};

export const webView2Test = baseTest.extend<TraceViewerFixtures>(traceViewerFixtures).extend<PageTestFixtures, WebView2WorkerFixtures>({
  browserVersion: [process.env.PWTEST_WEBVIEW2_CHROMIUM_VERSION, { scope: 'worker' }],
  browserMajorVersion: [({ browserVersion }, use) => use(Number(browserVersion.split('.')[0])), { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  isWebView2: [true, { scope: 'worker' }],

  webView2CdpPort: [async ({ }, use, testInfo) => {
    const cdpPort = 10000 + testInfo.workerIndex;
    const spawnedProcess = new TestChildProcess({
      command: [path.join(__dirname, 'webview2-app/bin/Debug/net6.0-windows/webview2.exe')],
      shell: true,
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort} ${DEFAULT_ARGS.join(' ')}`,
        WEBVIEW2_USER_DATA_FOLDER: path.join(testInfo.project.outputDir, `webview2-app/user-data-dir-${testInfo.workerIndex}`),
      }
    });
    await new Promise<void>(resolve => spawnedProcess.process.stdout.on('data', data => {
      if (data.toString().includes('WebView2 initialized'))
        resolve();
    }));
    await use(cdpPort);
    await spawnedProcess.close();
  }, { scope: 'worker' }],

  page: async ({ context }, run) => {
    const page = context.pages()[0];
    await page.goto('about:blank');
    await run(page);
  },

  context: async ({ playwright, webView2CdpPort }, run) => {
    const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${webView2CdpPort}`);
    await run(browser.contexts()[0]);
    await browser.close();
  },
});

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
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
export { expect } from '@playwright/test';
import { TestChildProcess } from '../config/commonFixtures';
import { chromiumSwitches } from '../../packages/playwright-core/lib/server/chromium/chromiumSwitches';

export const webView2Test = baseTest.extend<TraceViewerFixtures>(traceViewerFixtures).extend<PageTestFixtures, PageWorkerFixtures>({
  browserVersion: [process.env.PWTEST_WEBVIEW2_CHROMIUM_VERSION, { scope: 'worker' }],
  browserMajorVersion: [({ browserVersion }, use) => use(Number(browserVersion.split('.')[0])), { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isWebView2: [true, { scope: 'worker' }],

  browser: [async ({ playwright }, use, testInfo) => {
    const cdpPort = 10000 + testInfo.workerIndex;
    const spawnedProcess = new TestChildProcess({
      command: [path.join(__dirname, 'webview2-app/bin/Debug/net8.0-windows/webview2.exe')],
      shell: true,
      env: {
        ...process.env,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort} ${chromiumSwitches.join(' ')}`,
        WEBVIEW2_USER_DATA_FOLDER: path.join(fs.realpathSync.native(os.tmpdir()), `playwright-webview2-tests/user-data-dir-${testInfo.workerIndex}`),
      }
    });
    await new Promise<void>(resolve => spawnedProcess.process.stdout.on('data', data => {
      if (data.toString().includes('WebView2 initialized'))
        resolve();
    }));
    const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    await use(browser);
    await browser.close();
    await spawnedProcess.kill('SIGINT');
  }, { scope: 'worker' }],
});

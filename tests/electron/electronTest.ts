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
import type { ElectronApplication, Page, Electron } from '@playwright/test';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
export { expect } from '@playwright/test';

type ElectronTestFixtures = PageTestFixtures & {
  electronApp: ElectronApplication;
  launchElectronApp: (appFile: string, args?: string[], options?: Parameters<Electron['launch']>[0]) => Promise<ElectronApplication>;
  newWindow: () => Promise<Page>;
};

export const electronTest = baseTest.extend<TraceViewerFixtures>(traceViewerFixtures).extend<ElectronTestFixtures, PageWorkerFixtures>({
  browserVersion: [({}, use) => use(process.env.ELECTRON_CHROMIUM_VERSION), { scope: 'worker' }],
  browserMajorVersion: [({}, use) =>  use(Number(process.env.ELECTRON_CHROMIUM_VERSION.split('.')[0])), { scope: 'worker' }],
  electronMajorVersion: [({}, use) => use(parseInt(require('electron/package.json').version.split('.')[0], 10)), { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [true, { scope: 'worker' }],
  isWebView2: [false, { scope: 'worker' }],

  launchElectronApp: async ({ playwright }, use) => {
    // This env prevents 'Electron Security Policy' console message.
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    const apps: ElectronApplication[] = [];
    await use(async (appFile: string, args: string[] = [], options?: Parameters<Electron['launch']>[0]) => {
      const app = await playwright._electron.launch({ ...options, args: [path.join(__dirname, appFile), ...args] });
      apps.push(app);
      return app;
    });
    for (const app of apps)
      await app.close();
  },

  electronApp: async ({ launchElectronApp }, use) => {
    await use(await launchElectronApp('electron-app.js'));
  },

  newWindow: async ({ electronApp }, run) => {
    const windows: Page[] = [];
    await run(async () => {
      const [window] = await Promise.all([
        electronApp.waitForEvent('window'),
        electronApp.evaluate(async electron => {
          // Avoid "Error: Cannot create BrowserWindow before app is ready".
          await electron.app.whenReady();
          const window = new electron.BrowserWindow({
            width: 800,
            height: 600,
            // Sandboxed windows share process with their window.open() children
            // and can script them. We use that heavily in our tests.
            webPreferences: { sandbox: true }
          });
          await window.loadURL('about:blank');
        })
      ]);
      windows.push(window);
      return window;
    });
    for (const window of windows)
      await window.close();
  },

  page: async ({ newWindow }, run) => {
    await run(await newWindow());
  },

  context: async ({ electronApp }, run) => {
    await run(electronApp.context());
  },
});

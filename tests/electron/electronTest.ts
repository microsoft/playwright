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

import { baseTest, CommonWorkerFixtures } from '../config/baseTest';
import { ElectronApplication, Page } from '../../index';
import type { Fixtures } from '../config/test-runner';
import * as path from 'path';
import { PageTestFixtures } from '../page/pageTest';
export { expect } from '../config/test-runner';

type ElectronTestFixtures = PageTestFixtures & {
  electronApp: ElectronApplication;
  newWindow: () => Promise<Page>;
};

const electronVersion = require('electron/package.json').version;
export const electronFixtures: Fixtures<ElectronTestFixtures, {}, {}, CommonWorkerFixtures> = {
  browserVersion: electronVersion,
  browserMajorVersion: Number(electronVersion.split('.')[0]),
  isAndroid: false,
  isElectron: true,

  electronApp: async ({ playwright }, run) => {
    // This env prevents 'Electron Security Policy' console message.
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
    const electronApp = await playwright._electron.launch({
      args: [path.join(__dirname, 'electron-app.js')],
    });
    await run(electronApp);
    await electronApp.close();
  },

  newWindow: async ({ electronApp }, run) => {
    const windows: Page[] = [];
    await run(async () => {
      const [ window ] = await Promise.all([
        electronApp.waitForEvent('window'),
        electronApp.evaluate(electron => {
          const window = new electron.BrowserWindow({
            width: 800,
            height: 600,
            // Sandboxed windows share process with their window.open() children
            // and can script them. We use that heavily in our tests.
            webPreferences: { sandbox: true }
          });
          window.loadURL('about:blank');
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
};

export const electronTest = baseTest.extend<ElectronTestFixtures>(electronFixtures);

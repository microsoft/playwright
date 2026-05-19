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
import path from 'path';
import fs from 'fs';
import os from 'os';
import type { ElectronApplication, Electron, Page } from 'playwright';
import { _electron as electron } from 'playwright';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { inheritAndCleanEnv } from '../config/utils';

export { expect, selectors } from '@playwright/test';

const { removeFolders } = utils;

type LocalFixtures = PageTestFixtures & {
  launchElectronApp: (appFile: string, args?: string[], options?: Parameters<Electron['launch']>[0]) => Promise<ElectronApplication>;
  newWindow: (app: ElectronApplication) => Promise<Page>;
  createUserDataDir: () => Promise<string>;
};

type LocalWorkerFixtures = PageWorkerFixtures & {
  sharedApp: ElectronApplication;
};

export const electronTest = baseTest
    .extend<TraceViewerFixtures>(traceViewerFixtures)
    .extend<LocalFixtures, LocalWorkerFixtures>({
      browserVersion: [({}, use) => use(process.env.ELECTRON_CHROMIUM_VERSION), { scope: 'worker' }],
      browserMajorVersion: [({}, use) =>  use(Number(process.env.ELECTRON_CHROMIUM_VERSION.split('.')[0])), { scope: 'worker' }],
      electronMajorVersion: [({}, use) => use(parseInt(require('electron/package.json').version.split('.')[0], 10)), { scope: 'worker' }],
      isBidi: [false, { scope: 'worker' }],
      isAndroid: [false, { scope: 'worker' }],
      isElectron: [true, { scope: 'worker' }],
      isHeadlessShell: [false, { scope: 'worker' }],
      isFrozenWebkit: [false, { scope: 'worker' }],

      createUserDataDir: async ({}, run) => {
        const dirs: string[] = [];
        // We do not put user data dir in testOutputPath,
        // because we do not want to upload them as test result artifacts.
        await run(async () => {
          const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-'));
          dirs.push(dir);
          return dir;
        });
        await removeFolders(dirs);
      },

      sharedApp: [async ({}, use) => {
        const userDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-'));
        const app = await electron.launch({
          args: [path.join(__dirname, 'electron-app.js')],
          env: inheritAndCleanEnv({
            // Prevents 'Electron Security Policy' console message.
            ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
            PWTEST_ELECTRON_USER_DATA_DIR: userDataDir,
          }),
        });
        await use(app);
        await app.close();
        await removeFolders([userDataDir]);
      }, { scope: 'worker' }],

      newWindow: async ({}, use) => {
        await use(async (app: ElectronApplication) => {
          const [page] = await Promise.all([
            app.waitForEvent('window'),
            app.evaluate(({ BrowserWindow }) => {
              const window = new BrowserWindow({
                width: 800,
                height: 600,
                webPreferences: { sandbox: true },
              });
              void window.loadURL('about:blank');
            }),
          ]);
          return page;
        });
      },

      page: async ({ sharedApp, newWindow }, use) => {
        const page = await newWindow(sharedApp);
        await use(page);
        for (const window of sharedApp.windows())
          await window.close().catch(() => {});
      },

      launchElectronApp: async ({ createUserDataDir }, use) => {
        const apps: ElectronApplication[] = [];
        const userDataDir = await createUserDataDir();
        await use(async (appFile: string, args: string[] = [], options?: Parameters<Electron['launch']>[0]) => {
          const app = await electron.launch({
            ...options,
            args: [path.join(__dirname, appFile), ...args],
            env: inheritAndCleanEnv({
              // Prevents 'Electron Security Policy' console message.
              ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
              ...options?.env,
              PWTEST_ELECTRON_USER_DATA_DIR: userDataDir,
            }),
          });
          apps.push(app);
          return app;
        });
        for (const app of apps)
          await app.close();
      },
    });

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
import type { ElectronApplication, Electron } from '@playwright/electron';
import { mergeTests, electron, test as electronBaseTest } from '@playwright/electron';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
import type { TraceViewerFixtures } from '../config/traceViewerFixtures';
import { traceViewerFixtures } from '../config/traceViewerFixtures';
import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { inheritAndCleanEnv } from '../config/utils';

export { expect, selectors } from '@playwright/electron';

const { removeFolders } = utils;

type LocalFixtures = PageTestFixtures & {
  launchElectronApp: (appFile: string, args?: string[], options?: Parameters<Electron['launch']>[0]) => Promise<ElectronApplication>;
  createUserDataDir: () => Promise<string>;
};

export const electronTest = mergeTests(baseTest, electronBaseTest)
    .extend<TraceViewerFixtures>(traceViewerFixtures)
    .extend<LocalFixtures, PageWorkerFixtures>({
      browserVersion: [({}, use) => use(process.env.ELECTRON_CHROMIUM_VERSION), { scope: 'worker' }],
      browserMajorVersion: [({}, use) =>  use(Number(process.env.ELECTRON_CHROMIUM_VERSION.split('.')[0])), { scope: 'worker' }],
      electronMajorVersion: [({}, use) => use(parseInt(require('electron/package.json').version.split('.')[0], 10)), { scope: 'worker' }],
      isBidi: [false, { scope: 'worker' }],
      isAndroid: [false, { scope: 'worker' }],
      isElectron: [true, { scope: 'worker' }],
      isHeadlessShell: [false, { scope: 'worker' }],
      isFrozenWebkit: [false, { scope: 'worker' }],

      createUserDataDir: async ({ mode }, run) => {
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

      appOptions: async ({ createUserDataDir }, use) => {
        // This env prevents 'Electron Security Policy' console message.
        process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
        const userDataDir = await createUserDataDir();
        await use({
          args: [path.join(__dirname, 'electron-app.js')],
          env: inheritAndCleanEnv({ PWTEST_ELECTRON_USER_DATA_DIR: userDataDir }),
        });
      },

      launchElectronApp: async ({ createUserDataDir }, use) => {
        // This env prevents 'Electron Security Policy' console message.
        process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
        const apps: ElectronApplication[] = [];
        const userDataDir = await createUserDataDir();
        await use(async (appFile: string, args: string[] = [], options?: Parameters<Electron['launch']>[0]) => {
          const app = await electron.launch({
            ...options,
            args: [path.join(__dirname, appFile), ...args],
            env: inheritAndCleanEnv({ ...options?.env, PWTEST_ELECTRON_USER_DATA_DIR: userDataDir }),
          });
          apps.push(app);
          return app;
        });
        for (const app of apps)
          await app.close();
      },
    });

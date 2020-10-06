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

import { fixtures as baseFixtures } from '../fixtures';
import type { ElectronApplication, ElectronLauncher, ElectronPage } from '../../electron-types';
import path from 'path';

const electronName = process.platform === 'win32' ? 'electron.cmd' : 'electron';

type TestState = {
  application: ElectronApplication;
  window: ElectronPage;
};

export const electronFixtures = baseFixtures.defineTestFixtures<TestState>({
  application: async ({ playwright }, test) => {
    const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronName);
    const application = await playwright.electron.launch(electronPath, {
      args: [path.join(__dirname, 'testApp.js')],
    });
    await test(application);
    await application.close();
  },

  window: async ({ application }, test) => {
    const page = await application.newBrowserWindow({ width: 800, height: 600 });
    await test(page);
    await page.close();
  },
});

declare module '../../index' {
  const electron: ElectronLauncher;
}

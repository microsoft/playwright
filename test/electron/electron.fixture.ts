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

import { folio as base } from '../fixtures';
import type { ElectronApplication, ElectronLauncher, ElectronPage } from '../../electron-types';
import path from 'path';

const electronName = process.platform === 'win32' ? 'electron.cmd' : 'electron';

type TestState = {
  application: ElectronApplication;
  window: ElectronPage;
};
const fixtures = base.extend<TestState>();

fixtures.application.init(async ({ playwright }, run) => {
  const electronPath = path.join(__dirname, '..', '..', 'node_modules', '.bin', electronName);
  const application = await playwright.electron.launch(electronPath, {
    args: [path.join(__dirname, 'testApp.js')],
  });
  await run(application);
  await application.close();
});

fixtures.window.init(async ({ application }, run) => {
  const page = await application.newBrowserWindow({ width: 800, height: 600 });
  await run(page);
  await page.close();
});

export const folio = fixtures.build();

declare module '../../index' {
  const electron: ElectronLauncher;
}

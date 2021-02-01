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
import path from 'path';
import { ElectronApplication, Page } from '../..';

type TestState = {
  electronApp: ElectronApplication;
  window: Page;
  newWindow: () => Promise<Page>;
};
const fixtures = base.extend<TestState>();

fixtures.electronApp.init(async ({ playwright }, run) => {
  const application = await playwright._electron.launch({
    args: [path.join(__dirname, 'testApp.js')],
  });
  await run(application);
  await application.close();
});

fixtures.newWindow.init(async ({ electronApp }, run) => {
  const windows = [];
  const newWindow = async () => {
    const [ window ] = await Promise.all([
      electronApp.waitForEvent('window'),
      electronApp.evaluate(electron => {
        const window = new electron.BrowserWindow({ width: 800, height: 600 });
        window.loadURL('data:text/html,<title>Hello World 1</title>');
      })
    ]);
    windows.push(window);
    return window;
  };
  await run(newWindow);
  for (const window of windows)
    await window.close();
});

fixtures.window.init(async ({ newWindow }, run) => {
  await run(await newWindow());
});

export const folio = fixtures.build();

/**
 * Copyright (c) Microsoft Corporation.
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

import { expect, electronTest as test } from './electronTest';

test('should discover WebContentsViews via Playwright electron API', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/39427' },
}, async ({ launchElectronApp, electronMajorVersion }) => {
  test.skip(electronMajorVersion < 30, 'WebContentsView was introduced in Electron 30');
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/39427' });

  const app = await launchElectronApp('electron-webcontentsview-app.js');

  const window = await app.firstWindow();
  expect(await window.title()).toBe('WebContentsView1');

  await expect.poll(() => app.windows().length, { timeout: 10000 }).toBe(3);
  const titles = await Promise.all(app.windows().map(w => w.title()));
  expect(titles.sort()).toEqual(['WebContentsView1', 'WebContentsView2', 'WebContentsView3']);
});

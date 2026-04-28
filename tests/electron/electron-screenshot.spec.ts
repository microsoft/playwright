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

import fs from 'fs';
import { electronTest as test, expect } from './electronTest';

test.use({ screenshot: 'on' });

test.afterEach(async ({}, testInfo) => {
  const screenshots = testInfo.attachments.filter(a => a.name === 'screenshot');
  expect(screenshots).toHaveLength(1);
  expect(fs.existsSync(screenshots[0].path!)).toBe(true);
});

test('should capture screenshot', async ({ launchElectronApp, newWindow }) => {
  const app = await launchElectronApp('electron-app.js');
  const page = await newWindow(app);
  await page.setContent('<h1>Electron</h1>');
});

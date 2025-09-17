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

import { test } from './npmTest';
import fs from 'fs';
test.use({ isolateBrowsers: true });

test('concurrent browser downloads should not clobber each other', async ({ exec }, testInfo) => {
  await exec('npm init -y');
  await exec('npm install playwright');
  const numProcesses = 3;
  await Promise.all(Array.from({ length: numProcesses }, async (_, index) => {
    const browserPath = testInfo.outputPath(`browsers-${index}`);
    await exec('npx playwright install chromium', {
      env: {
        PLAYWRIGHT_BROWSERS_PATH: browserPath,
      }
    });

    // Check that each installation has all required binaries
    const entries = await fs.promises.readdir(browserPath).catch(() => []);
    const installed = new Set(entries.map(entry => entry.split('-')[0].replace(/_/g, '-')).filter(name => !name.startsWith('.')));
    test.expect(installed.has('chromium')).toBeTruthy();
    test.expect(installed.has('chromium-headless-shell')).toBeTruthy();
    test.expect(installed.has('ffmpeg')).toBeTruthy();
  }));
});

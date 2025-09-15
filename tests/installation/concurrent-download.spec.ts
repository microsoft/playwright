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
import path from 'path';
test.use({ isolateBrowsers: true });

test('concurrent browser downloads should not clobber each other', async ({ exec }, testInfo) => {
  await exec('npm init -y');
  await exec('npm install playwright');
  const numProcesses = 3;
  await Promise.all(Array.from({ length: numProcesses }, (_, index) =>
    exec('npx playwright install chromium', {
      env: {
        PLAYWRIGHT_BROWSERS_PATH: testInfo.outputPath(`browsers-${index}`),
      }
    })
  ));
  // Aggregate installed software across individual browser paths and verify expected components exist
  const installed = new Set<string>();
  for (let i = 0; i < numProcesses; i++) {
    const dir = testInfo.outputPath(`browsers-${i}`);
    const entries = await fs.promises.readdir(dir).catch(() => []);
    for (const entry of entries) {
      const name = entry.split('-')[0].replace(/_/g, '-');
      if (!name.startsWith('.'))
        installed.add(name);
    }
  }
  test.expect(installed.has('chromium')).toBeTruthy();
  test.expect(installed.has('chromium-headless-shell')).toBeTruthy();
  test.expect(installed.has('ffmpeg')).toBeTruthy();
});

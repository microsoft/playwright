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
import { test, expect } from './npmTest';

test('codegen should work', async ({ exec, installedSoftwareOnDisk }) => {
  await exec('npm i --foreground-scripts playwright', { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });

  await test.step('playwright install chromium', async () => {
    const result = await exec('npx playwright install chromium');
    expect(result).toHaveLoggedSoftwareDownload(['chromium', 'ffmpeg']);
    expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg']);
  });

  await test.step('playwright install', async () => {
    const result = await exec('npx playwright install');
    expect(result).toHaveLoggedSoftwareDownload(['firefox', 'webkit']);
    expect(await installedSoftwareOnDisk()).toEqual(['chromium', 'ffmpeg', 'firefox', 'webkit']);
  });

  await exec('node sanity.js playwright none', { env: {  PLAYWRIGHT_BROWSERS_PATH: undefined } });
  await exec('node sanity.js playwright');
});

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

test('codegen should work', async ({ exec, installedBrowsers }) => {
  await exec('npm i --foreground-scripts playwright', { env: { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' } });

  await test.step('playwright install chromium', async () => {
    const result = await exec('npx playwright install chromium');
    (expect(result) as any).toHaveDownloaded(['chromium']);
    expect(await installedBrowsers()).toEqual(['chromium']);
    expect(result).toContain('ffmpeg');
  });

  await test.step('playwright install', async () => {
    const result = await exec('npx playwright install');
    (expect(result) as any).toHaveDownloaded(['firefox', 'webkit']);
    expect(await installedBrowsers()).toEqual(['chromium', 'firefox', 'webkit']);
    expect(result).not.toContain('ffmpeg');
  });

  await exec('node sanity.js playwright');
});

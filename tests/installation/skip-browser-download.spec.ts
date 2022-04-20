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

test('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD should skip browser installs', async ({ npm, envOverrides, installedBrowsers }) => {
  envOverrides['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1';
  const result = await npm('i', '--foreground-scripts', 'playwright');
  expect(result).toHaveDownloaded([]);
  expect(await installedBrowsers()).toEqual([]);
  expect(result.combined()).toContain(`Skipping browsers download because`);
});

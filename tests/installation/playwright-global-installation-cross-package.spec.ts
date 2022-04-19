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

test('global installation cross package', async ({ npm, exec, envOverrides }) => {
  const packages = ['playwright-chromium', 'playwright-firefox', 'playwright-webkit'];
  envOverrides['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1';
  for (const pkg of packages) {
    const results = await npm('i', '--foreground-scripts', pkg);
    expect(results.raw.code).toBe(0);
  }

  delete envOverrides['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'];
  const result = await npm('i', '--foreground-scripts', 'playwright');
  expect(result.raw.code).toBe(0);
  expect(result).toHaveDownloaded(['chromium', 'firefox', 'webkit']);

  for (const pkg of packages) {
    const result = await exec('node', ['./sanity.js', pkg, 'all']);
    expect(result.raw.code).toBe(0);
  }
});

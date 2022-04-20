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

test('codegen should work', async ({ npm, npx, exec, envOverrides, installedBrowsers }) => {
  envOverrides['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'] = '1';
  await npm('i', '--foreground-scripts', 'playwright');
  delete envOverrides['PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD'];

  envOverrides['PLAYWRIGHT_BROWSERS_PATH'] = '0';
  await npx('playwright', 'install');
  await exec('node', ['driver-client.js']);
});

/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

import * as path from 'path';
import * as os from 'os';
import type { LaunchOptions } from '../../../types/types';
import type { TestType, PlaywrightWorkerArgs, PlaywrightWorkerOptions } from '../../../types/test';
import { rootTestType } from '../testType';
import { createGuid, removeFolders } from '../../utils/utils';
export const _baseTest: TestType<{}, {}> = rootTestType.test;

export const artifactsFolder = path.join(os.tmpdir(), 'pwt-' + createGuid());

export const test = _baseTest.extend<{}, PlaywrightWorkerArgs & PlaywrightWorkerOptions>({
  defaultBrowserType: [ 'chromium', { scope: 'worker' } ],
  browserName: [ ({ defaultBrowserType }, use) => use(defaultBrowserType), { scope: 'worker' } ],
  playwright: [ require('../../inprocess'), { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  launchOptions: [ {}, { scope: 'worker' } ],

  browser: [ async ({ playwright, browserName, headless, channel, launchOptions }, use) => {
    if (!['chromium', 'firefox', 'webkit'].includes(browserName))
      throw new Error(`Unexpected browserName "${browserName}", must be one of "chromium", "firefox" or "webkit"`);
    const options: LaunchOptions = {
      handleSIGINT: false,
      timeout: 0,
      ...launchOptions,
    };
    if (headless !== undefined)
      options.headless = headless;
    if (channel !== undefined)
      options.channel = channel;
    const browser = await playwright[browserName].launch(options);
    await use(browser);
    await browser.close();
    await removeFolders([artifactsFolder]);
  }, { scope: 'worker' } ],
});
export default test;

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

// @ts-expect-error
import { _utilityTest, _electron as electron } from 'playwright/test';
import { selectors } from 'playwright/test';

export { expect, devices, defineConfig, mergeExpects, mergeTests } from 'playwright/test';
export { electron, selectors };

import type { TestType } from '../index.d.ts';

const baseTest = _utilityTest as TestType<{}, {}>;

export const test = baseTest.extend({
  // @ts-expect-error
  appOptions: [{}, { option: true }],

  app: async ({ appOptions, testIdAttribute }, use) => {
    selectors.setTestIdAttribute(testIdAttribute);
    const app = await electron.launch(appOptions);
    await use(app);
    await app.close();
  },

  page: async ({ app }, use) => {
    await use(await app.firstWindow());
  },

  context: async ({ app }, use) => {
    await use(app.context());
  },
});

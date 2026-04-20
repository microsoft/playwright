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

import { test as baseTest } from 'playwright/test';
import { electron } from './electron';

import type { Fixtures, Browser } from 'playwright/test';
import type { PlaywrightTestArgs, PlaywrightTestOptions, PlaywrightWorkerArgs, PlaywrightWorkerOptions } from '../index.d.ts';

const fixtures: Fixtures<
  PlaywrightTestArgs & PlaywrightTestOptions,
  {},
  PlaywrightTestArgs & Omit<PlaywrightTestOptions, 'appOptions'>,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & { browser: Browser }
> = {
  appOptions: [{}, { option: true }],

  app: async ({ appOptions }, use) => {
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

  browser: [async ({}, use) => {
    throw new Error('The "browser" fixture is not supported in @playwright/electron. Use "app" or "context" instead.');
  }, { scope: 'worker' }],
};

export const test = baseTest.extend(fixtures);
export { expect, devices, defineConfig, selectors, mergeExpects, mergeTests } from 'playwright/test';
export { electron };

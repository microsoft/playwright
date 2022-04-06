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

import { test } from '@playwright/test';
import type { TestModeName } from './testMode';
import { DefaultTestMode, DriverTestMode, ServiceTestMode } from './testMode';

export type TestModeWorkerOptions = {
  mode: TestModeName;
};

export type TestModeWorkerFixtures = {
  playwright: typeof import('@playwright/test');
  toImpl: (rpcObject: any) => any;
};

export const testModeTest = test.extend<{}, TestModeWorkerOptions & TestModeWorkerFixtures>({
  mode: [ 'default', { scope: 'worker', option: true } ],
  playwright: [ async ({ mode }, run) => {
    const testMode = {
      default: new DefaultTestMode(),
      service: new ServiceTestMode(),
      driver: new DriverTestMode(),
      service2: new DefaultTestMode(),
    }[mode];
    require('playwright-core/lib/utils/utils').setUnderTest();
    const playwright = await testMode.setup();
    await run(playwright);
    await testMode.teardown();
  }, { scope: 'worker' } ],

  toImpl: [ async ({ playwright }, run) => run((playwright as any)._toImpl), { scope: 'worker' } ],
});

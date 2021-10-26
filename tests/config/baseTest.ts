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

import { Fixtures, VideoMode, _baseTest } from '@playwright/test';
import type { LaunchOptions, ViewportSize } from 'playwright-core';
import { commonFixtures, CommonFixtures, serverFixtures, ServerFixtures, ServerOptions } from './commonFixtures';
import { coverageFixtures, CoverageWorkerOptions } from './coverageFixtures';
import { platformFixtures, PlatformWorkerFixtures } from './platformFixtures';
import { DefaultTestMode, DriverTestMode, ServiceTestMode, TestModeName } from './testMode';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';
export type BaseWorkerOptions = ServerOptions & CoverageWorkerOptions & {
  mode: TestModeName;
  browserName: BrowserName;
  channel: LaunchOptions['channel'];
  video: VideoMode | { mode: VideoMode, size: ViewportSize };
  trace: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry' | /** deprecated */ 'retry-with-trace';
  headless: boolean | undefined;
};

export type BaseWorkerFixtures = {
  playwright: typeof import('playwright-core');
  toImpl: (rpcObject: any) => any;
};

const baseFixtures: Fixtures<{}, BaseWorkerOptions & BaseWorkerFixtures> = {
  mode: [ 'default', { scope: 'worker' } ],
  browserName: [ 'chromium' , { scope: 'worker' } ],
  channel: [ undefined, { scope: 'worker' } ],
  video: [ undefined, { scope: 'worker' } ],
  trace: [ undefined, { scope: 'worker' } ],
  headless: [ undefined, { scope: 'worker' } ],
  playwright: [ async ({ mode }, run) => {
    const testMode = {
      default: new DefaultTestMode(),
      service: new ServiceTestMode(),
      driver: new DriverTestMode(),
    }[mode];
    require('playwright-core/lib/utils/utils').setUnderTest();
    const playwright = await testMode.setup();
    await run(playwright);
    await testMode.teardown();
  }, { scope: 'worker' } ],
  toImpl: [ async ({ playwright }, run) => run((playwright as any)._toImpl), { scope: 'worker' } ],
};

export const baseTest = _baseTest
    .extend<{}, CoverageWorkerOptions>(coverageFixtures)
    .extend<{}, PlatformWorkerFixtures>(platformFixtures)
    .extend<{}, BaseWorkerOptions & BaseWorkerFixtures>(baseFixtures)
    .extend<CommonFixtures>(commonFixtures)
    .extend<ServerFixtures>(serverFixtures as any);

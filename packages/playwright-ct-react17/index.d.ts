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

import type { Locator } from 'playwright/test';
import type { TestType as BaseTestType } from '@playwright/experimental-ct-core';

export interface MountOptions<HooksConfig> {
  hooksConfig?: HooksConfig;
}

export interface MountResult extends Locator {
  unmount(): Promise<void>;
  update(component: JSX.Element): Promise<void>;
}

export type TestType<TestHooksConfig = Record<string, any>> = BaseTestType<{
  mount<HooksConfig extends TestHooksConfig>(
    component: JSX.Element,
    options?: MountOptions<HooksConfig>
  ): Promise<MountResult>;
}>;

export const test: TestType;

export { defineConfig, type PlaywrightTestConfig } from '@playwright/experimental-ct-core';
export { expect, devices } from 'playwright/test';

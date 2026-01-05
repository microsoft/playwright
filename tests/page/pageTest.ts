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

import type { TestType } from '@playwright/test';
import type { PlatformWorkerFixtures } from '../config/platformFixtures';
import type { TestModeTestFixtures, TestModeWorkerFixtures, TestModeWorkerOptions } from '../config/testModeFixtures';
import { androidTest } from '../android/androidTest';
import { browserTest } from '../config/browserTest';
import { electronTest } from '../electron/electronTest';
import type { PageTestFixtures, PageWorkerFixtures } from './pageTestApi';
import type { ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';
import { expect as baseExpect } from '@playwright/test';
export { rafraf } from '../config/utils';

let impl: TestType<PageTestFixtures & ServerFixtures & TestModeTestFixtures, PageWorkerFixtures & PlatformWorkerFixtures & TestModeWorkerFixtures & TestModeWorkerOptions & ServerWorkerOptions> = browserTest;

if (process.env.PWPAGE_IMPL === 'android')
  impl = androidTest;
if (process.env.PWPAGE_IMPL === 'electron')
  impl = electronTest;

export const test = impl;

export const expect = baseExpect.extend({
  toContainYaml(received: string, expected: string) {
    const trimmed = expected.split('\n').filter(a => !!a.trim());
    const maxPrefixLength = Math.min(...trimmed.map(line => line.match(/^\s*/)[0].length));
    const trimmedExpected = trimmed.map(line => line.substring(maxPrefixLength)).join('\n');
    try {
      if (this.isNot)
        expect(received).not.toContain(trimmedExpected);
      else
        expect(received).toContain(trimmedExpected);
      return {
        pass: !this.isNot,
        message: () => '',
      };
    } catch (e) {
      return {
        pass: this.isNot,
        message: () => e.message,
      };
    }
  }
});

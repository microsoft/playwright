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

import { TestType } from '@playwright/test';
import { PlatformWorkerFixtures } from '../config/platformFixtures';
import { TestModeWorkerFixtures, TestModeWorkerOptions } from '../config/testModeFixtures';
import { androidTest } from '../android/androidTest';
import { browserTest } from '../config/browserTest';
import { electronTest } from '../electron/electronTest';
import { PageTestFixtures, PageWorkerFixtures } from './pageTestApi';
import { ServerFixtures, ServerWorkerOptions } from '../config/serverFixtures';
export { expect } from '@playwright/test';

let impl: TestType<PageTestFixtures & ServerFixtures, PageWorkerFixtures & PlatformWorkerFixtures & TestModeWorkerFixtures & TestModeWorkerOptions & ServerWorkerOptions> = browserTest;

if (process.env.PWPAGE_IMPL === 'android')
  impl = androidTest;
if (process.env.PWPAGE_IMPL === 'electron')
  impl = electronTest;

export const test = impl;

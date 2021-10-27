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
import { commonFixtures, CommonFixtures } from './commonFixtures';
import { serverFixtures, ServerFixtures, ServerWorkerOptions } from './serverFixtures';
import { coverageFixtures, CoverageWorkerOptions } from './coverageFixtures';
import { platformFixtures, PlatformWorkerFixtures } from './platformFixtures';
import { testModeFixtures, TestModeWorkerFixtures } from './testModeFixtures';


export type BaseTestWorkerFixtures = {
  _snapshotSuffix: string;
};

export const baseTest = test
    .extend<{}, CoverageWorkerOptions>(coverageFixtures as any)
    .extend<{}, PlatformWorkerFixtures>(platformFixtures)
    .extend<{}, TestModeWorkerFixtures>(testModeFixtures as any)
    .extend<CommonFixtures>(commonFixtures)
    .extend<ServerFixtures, ServerWorkerOptions>(serverFixtures as any)
    .extend<{}, BaseTestWorkerFixtures>({
      _snapshotSuffix: ['', { scope: 'worker' }],
    });

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
import { serverFixtures, ServerFixtures, serverOptions, ServerWorkerOptions } from './serverFixtures';
import { coverageFixtures, coverageOptions, CoverageWorkerOptions } from './coverageFixtures';
import { platformFixtures, PlatformWorkerFixtures } from './platformFixtures';
import { testModeFixtures, testModeOptions, TestModeWorkerOptions, TestModeWorkerFixtures } from './testModeFixtures';


type BaseTestWorkerParams = {
  _snapshotSuffix: string;
};

export const baseTest = test
    .declare<{}, CoverageWorkerOptions>(coverageOptions)
    .extend(coverageFixtures)
    .extend<{}, PlatformWorkerFixtures>(platformFixtures)
    .declare<{}, TestModeWorkerOptions>(testModeOptions)
    .extend<{}, TestModeWorkerFixtures>(testModeFixtures as any)
    .extend<CommonFixtures>(commonFixtures)
    .declare<{}, ServerWorkerOptions>(serverOptions)
    .extend<ServerFixtures>(serverFixtures as any)
    .declare<{}, BaseTestWorkerParams>({
      _snapshotSuffix: ['', { scope: 'worker' }],
    });

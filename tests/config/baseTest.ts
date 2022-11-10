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

import type { TestType, Fixtures } from '@playwright/test';
import { test } from '@playwright/test';
import type { CommonFixtures, CommonWorkerFixtures } from './commonFixtures';
import { commonFixtures } from './commonFixtures';
import type { ServerFixtures, ServerWorkerOptions } from './serverFixtures';
import { serverFixtures } from './serverFixtures';
import { coverageTest } from './coverageFixtures';
import { platformTest } from './platformFixtures';
import { testModeTest } from './testModeFixtures';

interface TestTypeEx<TestArgs, WorkerArgs> extends TestType<TestArgs, WorkerArgs> {
  extend<T, W = {}>(fixtures: Fixtures<T, W, TestArgs, WorkerArgs>): TestTypeEx<TestArgs & T, WorkerArgs & W>;
  _extendTest<T, W>(other: TestType<T, W>): TestTypeEx<TestArgs & T, WorkerArgs & W>;
}
type BaseT = (typeof test) extends TestType<infer T, infer W> ? T : never; // eslint-disable-line
type BaseW = (typeof test) extends TestType<infer T, infer W> ? W : never; // eslint-disable-line
export const base = test as TestTypeEx<BaseT, BaseW>;

export const baseTest = base
    ._extendTest(coverageTest)
    ._extendTest(platformTest)
    ._extendTest(testModeTest)
    .extend<CommonFixtures, CommonWorkerFixtures>(commonFixtures)
    .extend<ServerFixtures, ServerWorkerOptions>(serverFixtures);

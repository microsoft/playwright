/**
 * Copyright 2019 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import './builtin.fixtures';
import './expect';
import { registerFixture as registerFixtureT, registerWorkerFixture as registerWorkerFixtureT } from './fixtures';
import { RunnerConfig } from './runnerConfig';
import { Test } from './test';
export { parameters, registerParameter } from './fixtures';

export function registerFixture<T extends keyof TestState>(name: T, fn: (params: FixtureParameters & WorkerState & TestState, runTest: (arg: TestState[T]) => Promise<void>, config: RunnerConfig, test: Test) => Promise<void>) {
  registerFixtureT<RunnerConfig, T>(name, fn);
};

export function registerWorkerFixture<T extends keyof (WorkerState & FixtureParameters)>(name: T, fn: (params: FixtureParameters & WorkerState, runTest: (arg: (WorkerState & FixtureParameters)[T]) => Promise<void>, config: RunnerConfig) => Promise<void>) {
  registerWorkerFixtureT<RunnerConfig, T>(name, fn);
};

/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import os from 'os';
import path from 'path';
import {promisify} from 'util';
import fs from 'fs';
import rimraf from 'rimraf';
import {registerFixture} from './fixtures';


declare global {
  type DescribeFunction = ((name: string, inner: () => void) => void) & {
    fail(condition: boolean): DescribeFunction;
    skip(condition: boolean): DescribeFunction;
    slow(): DescribeFunction;
    repeat(n: number): DescribeFunction;
  };

  type ItFunction<STATE> = ((name: string, inner: (state: STATE) => (void|Promise<void>)) => void) & {
    fail(condition: boolean): ItFunction<STATE>;
    skip(condition: boolean): ItFunction<STATE>;
    slow(): ItFunction<STATE>;
    repeat(n: number): ItFunction<STATE>;
  };

  const describe: DescribeFunction;
  const fdescribe: DescribeFunction;
  const xdescribe: DescribeFunction;
  const it: ItFunction<TestState & WorkerState & FixtureParameters>;
  const fit: ItFunction<TestState & WorkerState & FixtureParameters>;
  const dit: ItFunction<TestState & WorkerState & FixtureParameters>;
  const xit: ItFunction<TestState & WorkerState & FixtureParameters>;

  const beforeEach: (inner: (state: TestState & WorkerState & FixtureParameters) => (void|Promise<void>)) => void;
  const afterEach: (inner: (state: TestState & WorkerState & FixtureParameters) => (void|Promise<void>)) => void;
  const beforeAll: (inner: (state: WorkerState & FixtureParameters) => (void|Promise<void>)) => void;
  const afterAll: (inner: (state: WorkerState & FixtureParameters) => (void|Promise<void>)) => void;
}

const mkdtempAsync = promisify(fs.mkdtemp);
const removeFolderAsync = promisify(rimraf);

declare global {
  interface FixtureParameters {
    parallelIndex: number;
  }
  interface TestState {
    tmpDir: string;
  }
}

export {parameters, registerFixture, registerWorkerFixture, registerParameter} from './fixtures';

registerFixture('tmpDir', async ({}, test) => {
  const tmpDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  await test(tmpDir);
  await removeFolderAsync(tmpDir).catch(e => {});
});

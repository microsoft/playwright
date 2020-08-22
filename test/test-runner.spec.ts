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

import './test-runner-helper';
import { registerFixture } from '../test-runner';

type TestInfo = {
  file: string;
  title: string;
  timeout: number;
  outputDir: string;
  testDir: string;
};
declare global {
  interface TestState {
    a: string;
    b: string;
    ab: string;
    zero: number;
    tear: string;
    info1: TestInfo;
    info2: TestInfo;
  }
}

let zero = 0;
registerFixture('zero', async ({}, test) => {
  await test(zero++);
});

registerFixture('a', async ({zero}, test) => {
  await test('a' + zero);
});

registerFixture('b', async ({zero}, test) => {
  await test('b' + zero);
});

registerFixture('ab', async ({a, b}, test) => {
  await test(a + b);
});

it('should eval fixture once', async ({ab}) => {
  expect(ab).toBe('a0b0');
});

let beforeEachInfo1;
beforeEach(async ({info1}) => {
  beforeEachInfo1 = info1;
});

registerFixture('info1', async ({}, test, info) => {
  await test(info);
});
registerFixture('info2', async ({}, test, info) => {
  await test(info);
});

it('should get info', async ({info2}) => {
  function expectInfo(info) {
    expect(info.file).toContain('test-runner.spec');
    expect(typeof info.timeout).toBe('number');
    expect(typeof info.outputDir).toBe('string');
    expect(info.title).toBe('should get info');
  }

  // Info passed directly to the fixture.
  expectInfo(info2);

  // Info passed to fixture invoked from beforeEach.
  expectInfo(beforeEachInfo1);
});

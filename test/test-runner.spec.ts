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

declare global {
  interface TestState {
    a: string;
    b: string;
    ab: string;
    zero: number;
    tear: string;
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

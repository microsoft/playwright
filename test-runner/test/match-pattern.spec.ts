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
import "../lib"
import { runTest } from "./runTest";

it('should run all three tests', async() => {
  const result = runTest('three-tests');
  expect(result.passing).toBe(3);
  expect(result.exitCode).toBe(0);
});

it('should ignore a test', async() => {
  const result = runTest('three-tests', '--test-ignore=b.spec.js');
  expect(result.passing).toBe(2);
  expect(result.exitCode).toBe(0);
});

it('should filter tests', async() => {
  expect(runTest('three-tests', 'c.test').passing).toBe(1);
  expect(runTest('three-tests', 'c.test', 'b.spec').passing).toBe(2);
});

fit('should use a different test match', async() => {
  const result = runTest('three-tests', '--test-match=*.ts');
  expect(result.passing).toBe(2);
  expect(result.exitCode).toBe(0);
});
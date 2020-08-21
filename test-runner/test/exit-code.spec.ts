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
import { spawnSync } from "child_process";
import path from 'path';

it('should fail', async() => {
  const result = runTest('one-failure.js');
  expect(result.exitCode).toBe(1);
  expect(result.passing).toBe(0);
  expect(result.failing).toBe(1);
});

it('should succeed', async() => {
  const result = runTest('one-success.js');
  expect(result.exitCode).toBe(0);
  expect(result.passing).toBe(1);
  expect(result.failing).toBe(0);
});

function runTest(filePath: string) {
  const {output, status} = spawnSync('node', [path.join(__dirname, '..', 'cli.js'), path.join(__dirname, 'assets', filePath)]);
  const passing = (/  (\d+) passing/.exec(output.toString()) || [])[1];
  const failing = (/  (\d+) failing/.exec(output.toString()) || [])[1];
  return {
    exitCode: status,
    output,
    passing: parseInt(passing),
    failing: parseInt(failing || '0')
  }
}
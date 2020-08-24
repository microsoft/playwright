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

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import rimraf from 'rimraf';
import { promisify } from 'util';
import '../lib';

const removeFolderAsync = promisify(rimraf);

it('should fail', async() => {
  const result = await runTest('one-failure.js');
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
});

it('should succeed', async() => {
  const result = await runTest('one-success.js');
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
});

it('should access error in fixture', async() => {
  const result = await runTest('test-error-visible-in-fixture.js');
  expect(result.exitCode).toBe(1);
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-results', 'test-error-visible-in-fixture.txt')).toString());
  expect(data.message).toContain('Object.is equality');
});

async function runTest(filePath: string) {
  const outputDir = path.join(__dirname, 'test-results')
  await removeFolderAsync(outputDir).catch(e => {});

  const { output, status } = spawnSync('node', [
    path.join(__dirname, '..', 'cli.js'),
    path.join(__dirname, 'assets', filePath),
    '--output=' + outputDir
  ]);
  const passed = (/(\d+) passed/.exec(output.toString()) || [])[1];
  const failed = (/(\d+) failed/.exec(output.toString()) || [])[1];
  return {
    exitCode: status,
    output,
    passed: parseInt(passed),
    failed: parseInt(failed || '0')
  }
}

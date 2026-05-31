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

import path from 'path';

import { test, expect } from './playwright-test-fixtures';

test('preforked worker can be initialized later and run a test', async ({ childProcess }, testInfo) => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const script = path.join(repoRoot, 'utils', 'endform', 'prefork-worker-smoke.js');
  const proc = childProcess({
    command: ['node', script, '--playwright-root', repoRoot],
    cwd: testInfo.outputPath(),
  });
  const { exitCode } = await proc.exited;
  expect(proc.output).toContain('PREFORK_WORKER_SMOKE_OK');
  expect(exitCode).toBe(0);
});

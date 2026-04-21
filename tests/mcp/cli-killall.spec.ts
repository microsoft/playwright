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

import { test, expect } from './cli-fixtures';

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('kill-all kills only filtered pid', async ({ cli, server }) => {
  const { pid } = await cli('open', server.HELLO_WORLD);
  expect(pid).toBeDefined();
  expect(isAlive(pid!)).toBe(true);

  const { output } = await cli('kill-all', {
    env: { PLAYWRIGHT_KILL_ALL_PID_FILTER_FOR_TEST: String(pid) },
  });
  expect(output).toContain(`Killed daemon process ${pid}`);
  expect(output).toContain('Killed 1 daemon process.');

  await expect.poll(() => isAlive(pid!)).toBe(false);
});

test('kill-all kills filtered dashboard pid', async ({ cli }) => {
  const { pid } = await cli('show', { env: { PLAYWRIGHT_PRINT_DASHBOARD_PID_FOR_TEST: '1' } });
  expect(pid).toBeDefined();
  await expect.poll(() => isAlive(pid!)).toBe(true);

  const { output } = await cli('kill-all', {
    env: { PLAYWRIGHT_KILL_ALL_PID_FILTER_FOR_TEST: String(pid) },
  });
  expect(output).toContain(`Killed daemon process ${pid}`);
  expect(output).toContain('Killed 1 daemon process.');

  await expect.poll(() => isAlive(pid!)).toBe(false);
});

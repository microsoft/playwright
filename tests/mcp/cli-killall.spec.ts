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
  const { daemonPid } = await cli('open', server.HELLO_WORLD);
  expect(daemonPid).toBeDefined();
  expect(isAlive(daemonPid)).toBe(true);

  const { output } = await cli('kill-all', {
    env: { PWTEST_KILL_ALL_PID_FILTER_FOR_TEST: String(daemonPid) },
  });
  expect(output).toContain(`Killed daemon process ${daemonPid}`);
  expect(output).toContain('Killed 1 daemon process.');

  await expect.poll(() => isAlive(daemonPid)).toBe(false);
});

test('kill-all kills filtered dashboard pid', async ({ cli }) => {
  const { dashboardPid } = await cli('show');
  expect(dashboardPid).toBeDefined();
  await expect.poll(() => isAlive(dashboardPid)).toBe(true);

  const { output } = await cli('kill-all', {
    env: { PWTEST_KILL_ALL_PID_FILTER_FOR_TEST: String(dashboardPid) },
  });
  expect(output).toContain(`Killed daemon process ${dashboardPid}`);
  expect(output).toContain('Killed 1 daemon process.');

  await expect.poll(() => isAlive(dashboardPid)).toBe(false);
});

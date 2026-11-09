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
import { writeFiles } from './fixtures';

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test('kill-all kills only filtered pid', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-cli/issues/525' } }, async ({ cli, server }, testInfo) => {
  const { daemonPid } = await cli('open', server.HELLO_WORLD);
  expect(daemonPid).toBeDefined();
  expect(isAlive(daemonPid)).toBe(true);

  const env: Record<string, string> = { PWTEST_KILL_ALL_PID_FILTER_FOR_TEST: String(daemonPid) };
  if (process.platform === 'win32') {
    // Restrict enumeration to our daemon and its enumerators. The PID filter
    // would otherwise hide the PowerShell/cmd self-match.
    const prefix = `
      $self = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + $PID);
      $processes = Get-CimInstance Win32_Process | Where-Object {
        $_.ProcessId -eq ${daemonPid} -or $_.ProcessId -eq $PID -or
        ($_.ProcessId -eq $self.ParentProcessId -and $_.Name -eq 'cmd.exe')
      };
      function Get-CimInstance { $processes };
    `.replace(/\s+/g, ' ');
    await writeFiles({
      'enumerate.cjs': `
        const cp = require('child_process');
        const prefix = ${JSON.stringify(prefix)};
        const { execSync, execFileSync } = cp;
        cp.execSync = (command, options) => {
          if (!command.startsWith('powershell -NoProfile -NonInteractive -Command "'))
            throw new Error('Unexpected enumeration command');
          return execSync(command.replace('-Command "', '-Command "' + prefix), options);
        };
        cp.execFileSync = (file, args, options) => {
          if (file !== 'powershell' || !args.includes('-Command'))
            throw new Error('Unexpected enumeration command');
          return execFileSync(file, args.map((arg, i) => args[i - 1] === '-Command' ? prefix + arg : arg), options);
        };
      `,
    });
    delete env.PWTEST_KILL_ALL_PID_FILTER_FOR_TEST;
    env.NODE_OPTIONS = `--require ${JSON.stringify(testInfo.outputPath('enumerate.cjs'))}`;
  }
  const { output } = await cli('kill-all', { env });
  expect(output).toContain(`Killed daemon process ${daemonPid}`);
  expect(output).toContain('Killed 1 daemon process.');

  await expect.poll(() => isAlive(daemonPid)).toBe(false);
});

test('kill-all kills filtered dashboard pid', async ({ cli }) => {
  const { dashboardPid } = await cli('show');
  expect(dashboardPid).toBeDefined();
  await expect.poll(() => isAlive(dashboardPid)).toBe(true);

  // kill-all discovers daemons via `execSync('ps auxww')` and treats any failure
  // (including a swallowed spawn error under load) as "no processes found", so a
  // single call can miss a live daemon. Retry until it observes and kills it.
  await expect(async () => {
    const { output } = await cli('kill-all', {
      env: { PWTEST_KILL_ALL_PID_FILTER_FOR_TEST: String(dashboardPid) },
    });
    expect(output).toContain(`Killed daemon process ${dashboardPid}`);
    expect(output).toContain('Killed 1 daemon process.');
  }).toPass();

  await expect.poll(() => isAlive(dashboardPid)).toBe(false);
});

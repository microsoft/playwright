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

import childProcess from 'child_process';
import fs from 'fs';

import { registry } from 'playwright-core/lib/server/registry/index';

export function getBrowserExecPath(channelOrName: string): string | undefined {
  return registry.findExecutable(channelOrName)?.executablePath('javascript');
}

type CmdlinePredicate = (line: string) => boolean;

export function findBrowserProcess(execPath: string, arg: string): string | undefined {
  const predicate = (line: string) => line.includes(execPath) && line.includes(arg) && !line.includes('--type');
  try {
    switch (process.platform) {
      case 'darwin':
        return findProcessMacos(predicate);
      case 'linux':
        return findProcessLinux(predicate);
      case 'win32':
        return findProcessWindows(execPath, arg, predicate);
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function findProcessLinux(predicate: CmdlinePredicate): string | undefined {
  // /bin/ps is missing in slim docker images, so we read /proc fs directly.
  const procDirs = fs.readdirSync('/proc').filter(name => /^\d+$/.test(name));
  for (const pid of procDirs) {
    try {
      const cmdlineBuffer = fs.readFileSync(`/proc/${pid}/cmdline`);
      // Convert 0-separated arguments to space-separated string
      const cmdline = cmdlineBuffer.toString().replace(/\0/g, ' ').trim();
      if (predicate(cmdline))
        return `${pid} ${cmdline}`;
    } catch {
      // Skip processes we can't read (permission denied, process died, etc.)
      continue;
    }
  }
  return undefined;
}

function findProcessMacos(predicate: CmdlinePredicate): string | undefined {
  const result = childProcess.spawnSync('/bin/ps', ['-axo', 'pid=,command=']);
  if (result.status !== 0 || !result.stdout)
    return undefined;
  return findMatchingLine(result.stdout.toString(), predicate);
}

function findProcessWindows(execPath: string, arg: string, predicate: CmdlinePredicate): string | undefined {
  const psEscape = (path: string) => `'${path.replaceAll("'", "''")}'`;
  const filter = `$_.ExecutablePath -eq ${psEscape(execPath)} -and $_.CommandLine.Contains(${psEscape(arg)}) -and $_.CommandLine -notmatch '--type'`;
  const ps = childProcess.spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process | Where-Object { ${filter} } | Select-Object -Property ProcessId,CommandLine | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`
      ],
      { encoding: 'utf8' }
  );

  if (ps.status !== 0 || !ps.stdout)
    return undefined;

  return findMatchingLine(ps.stdout.toString(), predicate);
}

function findMatchingLine(psOutput: string, predicate: CmdlinePredicate): string | undefined {
  const lines = psOutput.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.find(predicate);
}

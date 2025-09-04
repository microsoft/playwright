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

import { registry } from 'playwright-core/lib/server/registry/index';

// TODO: make browserType.executablePath() return it.
export function getBrowserExecPath(channelOrName: string): string | undefined {
  return registry.findExecutable(channelOrName)?.executablePath('javascript');
}

export function findBrowserProcess(execPath: string, arg: string): string | null {
  switch (process.platform) {
    case 'darwin':
      return findProcessMacos(execPath, arg);
    case 'linux':
      return findProcessLinux(execPath, arg);
    case 'win32':
      return findProcessWindows(execPath, arg);
    default:
      return null;
  }
}

function findProcessLinux(execPath: string, arg: string): string | null {
  const psResult = childProcess.spawnSync('ps', ['-eo', 'pid=,args=']);
  return findMatchingLine(psResult.stdout.toString(), execPath, arg);
}

function findProcessMacos(execPath: string, arg: string): string | null {
  const psResult = childProcess.spawnSync('ps', ['-axo', 'pid=,command=']);
  return findMatchingLine(psResult.stdout.toString(), execPath, arg);
}

function findProcessWindows(execPath: string, arg: string): string | null {
  const filter = `$_.ExecutablePath -eq '${execPath}' -and $_.CommandLine.Contains('${arg}') -and $_.CommandLine -notmatch '--type'`;
  const ps = childProcess.spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process | Where-Object { ${filter} } | Select-Object -Property ProcessId,CommandLine | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`
      ],
      { encoding: 'utf8' }
  );

  if (ps.status !== 0)
    return null;

  return findMatchingLine(ps.stdout.toString(), execPath, arg);
}

function findMatchingLine(psOutput: string, execPath: string, arg: string): string | null {
  const lines = psOutput.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Chrome child process have --type argument, we only return the browser process.
    if (line.includes(execPath) && line.includes(arg) && !line.includes('--type'))
      return line;
  }
  return null;
}

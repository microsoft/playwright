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
import type { SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import debugLogger from 'debug';

const debugExec = debugLogger('itest:exec');
const debugExecStdout = debugLogger('itest:exec:stdout');
const debugExecStderr = debugLogger('itest:exec:stderr');

export function spawnAsync(cmd: string, args: string[], options: SpawnOptions = {}): Promise<{stdout: string, stderr: string, code: number | null, error?: Error}> {
  // debugExec(`CWD: ${options.cwd || process.cwd()}`);
  // debugExec(`ENV: ${Object.entries(options.env || {}).map(([key, value]) => `${key}=${value}`).join(' ')}`);
  debugExec([cmd, ...args].join(' '));
  const p = spawn(cmd, args, Object.assign({ windowsHide: true }, options));

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (p.stdout) {
      p.stdout.on('data', data => {
        debugExecStdout(data.toString());
        stdout += data;
      });
    }
    if (p.stderr) {
      p.stderr.on('data', data => {
        debugExecStderr(data.toString());
        stderr += data;
      });
    }
    p.on('close', code => resolve({ stdout, stderr, code }));
    p.on('error', error => resolve({ stdout, stderr, code: 0, error }));
  });
}

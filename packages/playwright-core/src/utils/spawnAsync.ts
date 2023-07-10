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

export function spawnAsync(cmd: string, args: string[], options: SpawnOptions = {}): Promise<{stdout: string, stderr: string, code: number | null, error?: Error}> {
  if (process.env.PW_CRX) throw new Error(`Operation not allowed in CRX mode`);

  const proc = spawn(cmd, args, Object.assign({ windowsHide: true }, options));

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (proc.stdout)
      proc.stdout.on('data', data => stdout += data);
    if (proc.stderr)
      proc.stderr.on('data', data => stderr += data);
    proc.on('close', code => resolve({ stdout, stderr, code }));
    proc.on('error', error => resolve({ stdout, stderr, code: 0, error }));
  });
}

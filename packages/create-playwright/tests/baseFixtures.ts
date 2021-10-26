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

import { test as base } from '@playwright/test';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PromptOptions } from '../src/generator';

type TestFixtures = {
  packageManager: 'npm' | 'yarn';
  run: (parameters: string[], options: PromptOptions) => Promise<RunResult>,
};

type RunResult = {
  exitCode: number | null,
  dir: string,
  stdout: string,
  exec: typeof spawnAsync
};

function spawnAsync(cmd: string, args: string[], options?: SpawnOptionsWithoutStdio): Promise<{stdout: string, stderr: string, code: number | null, error?: Error}> {
  const p = spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.env.CR_PW_DEBUG) {
      p.stdout.on('data', chunk => process.stdout.write(chunk));
      p.stderr.on('data', chunk => process.stderr.write(chunk));
    }
    if (p.stdout)
      p.stdout.on('data', data => stdout += data);
    if (p.stderr)
      p.stderr.on('data', data => stderr += data);
    p.on('close', code => resolve({ stdout, stderr, code }));
    p.on('error', error => resolve({ stdout, stderr, code: 0, error }));
  });
}

export const test = base.extend<TestFixtures>({
  packageManager: 'npm',
  run: async ({ packageManager }, use, testInfo) => {
    await use(async (parameters: string[], options: PromptOptions): Promise<RunResult> => {
      fs.mkdirSync(testInfo.outputDir, { recursive: true });
      const env = packageManager === 'yarn' ? {
        'npm_config_user_agent': 'yarn'
      } : undefined;
      const result = await spawnAsync('node', [path.join(__dirname, '..'), ...parameters], {
        shell: true,
        cwd: testInfo.outputDir,
        env: {
          ...process.env,
          ...env,
          'TEST_OPTIONS': JSON.stringify(options),
        }
      });
      const execWrapper = (cmd: string, args: string[], options?: SpawnOptionsWithoutStdio): ReturnType<typeof spawnAsync> => {
        return spawnAsync(cmd, args, {
          ...options,
          cwd: testInfo.outputDir,
        });
      };
      return {
        exitCode: result.code,
        dir: testInfo.outputDir,
        stdout: result.stdout,
        exec: execWrapper,
      };
    });
  },
});

export const expect = test.expect;

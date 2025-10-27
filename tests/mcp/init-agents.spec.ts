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

import { test, expect, writeFiles } from './fixtures';
import { spawnAsync } from '../../packages/playwright-core/lib/server/utils/spawnAsync';

import path from 'path';
import fs from 'fs';

async function runInitAgents(options?: { args?: string[], cwd?: string }): Promise<{stdout: string, stderr: string, code: number | null, error?: Error}> {
  const result = await spawnAsync('npx', [
    'playwright', 'init-agents',
    ...(options?.args || []),
  ], {
    cwd: options?.cwd,
    shell: true,
  });
  return result;
}

test('create seed file default', async ({  }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = {};
    `,
  });

  await runInitAgents({
    cwd: baseDir,
    args: ['--loop', 'claude'],
  });
  expect(fs.existsSync(path.join(baseDir, 'seed.spec.ts'))).toBe(true);
});

test('create seed file with --project', async ({  }) => {
  const baseDir = await writeFiles({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo', testDir: 'foo/e2e' }, { name: 'bar', testDir: 'bar/e2e' }, ] };
    `,
  });

  await runInitAgents({
    cwd: baseDir,
    args: ['--loop', 'vscode', '--project', 'bar'],
  });
  expect(fs.existsSync(path.join(baseDir, 'bar', 'e2e', 'seed.spec.ts'))).toBe(true);
});

test('create seed file with --config', async ({  }) => {
  const baseDir = await writeFiles({
    'custom/playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo', testDir: 'foo/e2e' }, { name: 'bar', testDir: 'bar/e2e' }, ] };
    `,
  });

  await runInitAgents({
    cwd: baseDir,
    args: ['--loop', 'vscode', '--config', 'custom/playwright.config.ts', '--project', 'bar'],
  });
  expect(fs.existsSync(path.join(baseDir, 'custom', 'bar', 'e2e', 'seed.spec.ts'))).toBe(true);
});

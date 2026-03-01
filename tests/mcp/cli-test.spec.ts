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

import path from 'path';
import { test, expect } from './cli-fixtures';
import { writeFiles } from './fixtures';

const testEntrypoint = path.join(__dirname, '../../packages/playwright-test/cli.js');

test('debug test and snapshot', async ({ cliEnv, cli, childProcess }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
    `,
  });

  const cwd = test.info().outputDir;

  const testProcess = childProcess({
    command: [process.argv[0], testEntrypoint, 'test'],
    cwd,
    env: { PWPAUSE: 'cli', ...cliEnv },
  });

  await testProcess.waitForOutput('playwright-cli --session=test-worker');

  const listResult1 = await cli('list', { cwd });
  expect(listResult1.exitCode).toBe(0);
  expect(listResult1.output).toContain('test-worker');

  const match = testProcess.output.match(/--session=([a-zA-Z0-9-_]+)/);
  const sessionName = match[1];

  const snapshotResult = await cli(`--session=${sessionName}`, 'snapshot', { cwd });
  expect(snapshotResult.exitCode).toBe(0);
  expect(snapshotResult.snapshot).toContain('button "Submit"');

  await testProcess.kill('SIGINT');

  const listResult2 = await cli('list', { cwd });
  expect(listResult2.exitCode).toBe(0);
  expect(listResult2.output).toContain('(no browsers)');
});

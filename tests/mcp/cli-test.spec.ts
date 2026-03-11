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
    'subdir/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example test', async ({ page }) => {
        await page.setContent('<title>My Page</title><body><button>Submit</button></body>');
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
    `,
  });

  const testProcess = childProcess({
    command: [process.argv[0], testEntrypoint, 'test'],
    cwd: test.info().outputPath('subdir'),
    env: { PWPAUSE: 'cli', ...cliEnv },
  });

  await testProcess.waitForOutput('playwright-cli --session=<name> open --attach=test-worker');

  const match = testProcess.output.match(/--attach=([a-zA-Z0-9-_]+)/);
  const browserName = match[1];

  const { output: openOutput } = await cli('open', `--session=test-session`, `--attach=${browserName}`);
  expect(openOutput).toContain('My Page');

  const listResult1 = await cli('list', '--all');
  expect(listResult1.exitCode).toBe(0);
  expect(listResult1.output).toContain('test-session');
  expect(listResult1.output).toContain('subdir');
  expect(listResult1.output).toContain(`browser "${browserName}"`);

  const snapshotResult = await cli(`--session=test-session`, 'snapshot');
  expect(snapshotResult.exitCode).toBe(0);
  expect(snapshotResult.snapshot).toContain('button "Submit"');

  await testProcess.kill('SIGINT');

  const listResult2 = await cli('list');
  expect(listResult2.exitCode).toBe(0);
  expect(listResult2.output).toContain('(no browsers)');
});

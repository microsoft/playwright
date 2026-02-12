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

test.only('debug test and attach', async ({ cli, childProcess }) => {
  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.getByRole('button', { name: 'Missing' })).toBeVisible({ timeout: 1000 });
      });
    `,
  });

  const testProcess = childProcess({
    command: [testEntrypoint, 'test', '--debug=cli'],
    cwd: test.info().outputDir,
  });

  await testProcess.waitForOutput('playwright-cli --session <name> attach');
  const match = testProcess.output.match(/attach '([^']+)'/);
  const socketPath = match[1];

  const attachResult = await cli('--session=test', 'attach', socketPath);
  expect(attachResult.exitCode).toBe(0);

  const snapshotResult = await cli('--session=test', 'snapshot');
  expect(snapshotResult.exitCode).toBe(0);
  expect(snapshotResult.snapshot).toContain('button "Submit"');

  const closeResult = await cli('--session=test', 'close');
  expect(closeResult.exitCode).toBe(0);

  const listResult = await cli('list');
  expect(listResult.exitCode).toBe(0);
  expect(listResult.output).toContain('(no browsers)');

  await testProcess.kill('SIGINT');
});

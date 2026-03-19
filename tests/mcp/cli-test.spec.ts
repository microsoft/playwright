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
        await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
        await page.setContent('<title>My Page</title><body><button>Close</button></body>');
        await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
      });
    `,
  });

  const testProcess = childProcess({
    command: [process.argv[0], testEntrypoint, 'test', '--debug=cli'],
    cwd: test.info().outputPath('subdir'),
    env: cliEnv,
  });

  await testProcess.waitForOutput('playwright-cli attach');

  const match = testProcess.output.match(/attach ([a-zA-Z0-9-_]+)/);
  const session = match[1];

  const { output: listOutput1 } = await cli('list', '--all');
  expect(listOutput1).toContain('subdir');
  expect(listOutput1).toContain(`browser "${session}"`);

  const { output: attachOutput } = await cli('attach', session);
  expect(attachOutput).toContain('### Paused');
  expect(attachOutput).toContain(`- Set content at subdir${path.sep}a.test.ts:4`);

  const { output: listOutput2 } = await cli('list', '--all');
  expect(listOutput2).toContain('/');
  expect(listOutput2).toContain(`- ${session}`);

  const { output: stepOutput } = await cli(`--session=${session}`, 'step-over');
  expect(stepOutput).toContain('### Paused');
  expect(stepOutput).toContain(`- Expect "toBeVisible" at subdir${path.sep}a.test.ts:5`);

  const snapshotResult = await cli(`--session=${session}`, 'snapshot');
  expect(snapshotResult.inlineSnapshot).toContain('button "Submit"');

  const { output: pauseAtOutput } = await cli(`--session=${session}`, 'pause-at', 'a.test.ts:7');
  expect(pauseAtOutput).toContain('### Paused');
  expect(pauseAtOutput).toContain(`- Expect "toBeVisible" at subdir${path.sep}a.test.ts:7`);

  await cli(`--session=${session}`, 'resume');

  const { output: listOutput3 } = await cli('list');
  expect(listOutput3).toContain('(no browsers)');
});

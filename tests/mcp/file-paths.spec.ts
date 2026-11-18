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

import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { test, expect, parseResponse } from './fixtures';

test('--file-paths=absolute', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');
  const { client } = await startClient({
    args: ['--file-paths=absolute'],
    config: { outputDir },
  });
  server.setContent('/', `<script>console.error('hello')</script>`, 'text/html');

  const navigate = parseResponse(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  }));
  expect(navigate.events).toContain(`New console entries: ${path.join(outputDir, 'console-')}`);

  expect(await client.callTool({
    name: 'browser_take_screenshot',
  })).toHaveResponse({
    result: expect.stringContaining(`[Screenshot of viewport](${path.join(outputDir, 'page-')}`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { filename: 'screenshot.png' },
  })).toHaveResponse({
    result: expect.stringContaining(`[Screenshot of viewport](${testInfo.outputPath('screenshot.png')})`),
  });
});

test('explicit filenames fall back from an unwritable workspace', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44138' },
}, async ({ startClient, server }, testInfo) => {
  const cwd = testInfo.outputPath('readonly');
  const outputDir = testInfo.outputPath('output');
  await fs.promises.mkdir(cwd);
  if (process.platform === 'win32')
    execFileSync('icacls', [cwd, '/deny', '*S-1-1-0:(WD,AD)']);
  else
    await fs.promises.chmod(cwd, 0o555);
  let canWrite = false;
  try {
    await fs.promises.writeFile(path.join(cwd, 'probe'), '');
    canWrite = true;
  } catch (e) {
    if (e.code !== 'EPERM' && e.code !== 'EACCES')
      throw e;
  }
  test.skip(canWrite, 'The current account can bypass directory permissions.');

  const { client } = await startClient({
    cwd,
    args: ['--file-paths=absolute', `--output-dir=${outputDir}`],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { filename: 'sub/screenshot.png' },
  })).toHaveResponse({
    result: expect.stringContaining(`[Screenshot of viewport](${path.join(outputDir, 'sub', 'screenshot.png')})`),
  });
  expect(fs.existsSync(path.join(outputDir, 'sub', 'screenshot.png'))).toBe(true);
});

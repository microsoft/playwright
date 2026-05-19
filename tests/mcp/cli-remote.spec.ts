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

import fs from 'fs';
import { test, expect } from './cli-fixtures';

test.skip(({ mcpBrowser }) => mcpBrowser !== 'chromium', 'Run only on the chromium project; the remote server connection is browser-agnostic.');

test('attach to run-server endpoint with remoteHeaders from config', async ({ cli, runServerEndpoint, server }, testInfo) => {
  const configPath = testInfo.outputPath('config.json');
  await fs.promises.writeFile(configPath, JSON.stringify({
    browser: {
      remoteEndpoint: runServerEndpoint,
      remoteHeaders: { 'x-playwright-browser': 'chromium' },
      isolated: true,
    },
  }, null, 2));

  const { exitCode } = await cli('attach', runServerEndpoint, '-s=remote', `--config=${configPath}`);
  expect(exitCode).toBe(0);

  await cli('-s=remote', 'goto', server.HELLO_WORLD);
  const { inlineSnapshot } = await cli('-s=remote', 'snapshot');
  expect(inlineSnapshot).toContain('Hello, world!');
});

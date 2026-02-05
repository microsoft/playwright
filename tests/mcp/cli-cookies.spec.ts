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

// Cookie tests

test('cookie-list shows no cookies when empty', async ({ cli, server, mcpBrowser }, testInfo) => {
  test.skip(mcpBrowser === 'msedge', 'Edge is leaking some internal cookies');
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  const { output } = await cli('cookie-list');
  expect(output).toContain('No cookies found');
});

test('cookie-set and cookie-get', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);

  // Set a cookie
  await cli('cookie-set', 'testCookie', 'testValue');

  // Get the cookie
  const { output: getOutput } = await cli('cookie-get', 'testCookie');
  expect(getOutput).toContain('testCookie=testValue');
});

test('cookie-list shows cookies', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('cookie-set', 'cookie1', 'value1');
  await cli('cookie-set', 'cookie2', 'value2');

  const { output } = await cli('cookie-list');
  expect(output).toContain('cookie1=value1');
  expect(output).toContain('cookie2=value2');
});

test('cookie-delete removes cookie', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('cookie-set', 'testCookie', 'testValue');

  // Delete the cookie
  await cli('cookie-delete', 'testCookie');

  // Verify it's gone
  const { output: getOutput } = await cli('cookie-get', 'testCookie');
  expect(getOutput).toContain('not found');
});

test('cookie-clear removes all cookies', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('.playwright', 'cli.config.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('cookie-set', 'cookie1', 'value1');
  await cli('cookie-set', 'cookie2', 'value2');

  // Clear all cookies
  await cli('cookie-clear');

  // Verify they're gone
  const { output: listOutput } = await cli('cookie-list');
  expect(listOutput).toContain('No cookies found');
});

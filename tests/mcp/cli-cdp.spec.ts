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
import { test, expect, daemonFolder } from './cli-fixtures';

test.describe.configure({
  retries: 1,
});

test('connect by channel name error', async ({ cli }) => {
  const { error } = await cli('attach', '--cdp=chrome-canary');
  expect(error).toContain('Could not connect to chrome-canary');
  expect(error).toContain('chrome://inspect/#remote-debugging');
});

test('attach --cdp=<channel> defaults session name to the channel', async ({ cli }) => {
  // Connection fails, but the daemon writes its err log under the resolved session name.
  await cli('attach', '--cdp=chrome-canary');
  const folder = await daemonFolder();
  expect(folder).toBeTruthy();
  const files = await fs.promises.readdir(folder!);
  expect(files).toContain('chrome-canary.err');
  expect(files).not.toContain('default.err');
});

test('explicit --session wins over --cdp=<channel>', async ({ cli }) => {
  await cli('attach', '--cdp=chrome-canary', '-s=explicit');
  const folder = await daemonFolder();
  expect(folder).toBeTruthy();
  const files = await fs.promises.readdir(folder!);
  expect(files).toContain('explicit.err');
  expect(files).not.toContain('chrome-canary.err');
});

test('attach via cdp URL keeps the default session', async ({ cdpServer, cli, server }) => {
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.HELLO_WORLD);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  const { output: listOutput } = await cli('list');
  expect(listOutput).toContain('- default:');
  expect(listOutput).toContain('(attached)');
});

test('detach tears down an attached session', async ({ cdpServer, cli }) => {
  await cdpServer.start();

  await cli('attach', `--cdp=${cdpServer.endpoint}`, '-s=mine');
  const { output: listBefore } = await cli('list');
  expect(listBefore).toContain('- mine:');
  expect(listBefore).toContain('(attached)');

  const { output: detachOutput } = await cli('-s=mine', 'detach');
  expect(detachOutput).toContain(`Browser 'mine' detached`);

  const { output: listAfter } = await cli('list');
  expect(listAfter).not.toContain('- mine:');
});

test('detach rejects sessions opened via open', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { error, exitCode } = await cli('detach');
  expect(exitCode).toBe(1);
  expect(error).toContain(`session 'default' was not attached`);
  expect(error).toContain('close');
});

test('detach on unknown session reports not attached', async ({ cli }) => {
  const { output } = await cli('-s=nobody', 'detach');
  expect(output).toContain(`Browser 'nobody' is not attached.`);
});

test('cdp server', async ({ cdpServer, cli, server }) => {
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.HELLO_WORLD);

  const configPath = test.info().outputPath('config.ini');
  await fs.promises.writeFile(configPath, `
browser.isolated=false
`);
  await cli('attach', `--cdp=${cdpServer.endpoint}`, `--config=${configPath}`);
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain(`- generic [active] [ref=e1]: Hello, world!`);
});

test('attach via cdp', async ({ cdpServer, cli, server }) => {
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  await page.goto(server.HELLO_WORLD);

  await cli('attach', `--cdp=${cdpServer.endpoint}`);
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain(`- generic [active] [ref=e1]: Hello, world!`);
});

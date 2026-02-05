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
import path from 'path';
import { test, expect, daemonFolder } from './cli-fixtures';

test('session-list', async ({ cli, server }) => {
  const { output: emptyOutput } = await cli('session-list');
  expect(emptyOutput).toContain('Sessions:');
  expect(emptyOutput).toContain('  (no sessions)');

  await cli('open', server.HELLO_WORLD);

  const { output: listOutput } = await cli('session-list');
  expect(listOutput).toContain('Sessions:');
  expect(listOutput).toContain('  default');
});

test('close', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output } = await cli('close');
  expect(output).toContain(`Session 'default' stopped.`);

  const { output: listOutput } = await cli('session-list');
  expect(listOutput).toContain('(no sessions)');
});

test('close named session', async ({ cli, server }) => {
  await cli('--session=mysession', 'open', server.HELLO_WORLD);

  const { output } = await cli('--session=mysession', 'close');
  expect(output).toContain(`Session 'mysession' stopped.`);
});

test('close non-running session', async ({ cli }) => {
  const { output } = await cli('--session=nonexistent', 'close');
  expect(output).toContain(`Session 'nonexistent' is not running.`);
});

test('session-close-all', async ({ cli, server }) => {
  await cli('--session=session1', 'open', server.HELLO_WORLD);
  await cli('--session=session2', 'open', server.HELLO_WORLD);

  const { output: listBefore } = await cli('session-list');
  expect(listBefore).toContain('session1');
  expect(listBefore).toContain('session2');

  await cli('session-close-all');

  const { output: listAfter } = await cli('session-list');
  expect(listAfter).not.toContain('session1');
});

test('delete-data', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', server.HELLO_WORLD, '--persistent');

  const dataDir = path.resolve(await daemonFolder(), 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('delete-data');
  expect(output).toContain(`Deleted user data for session 'default'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('delete-data named session', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('--session=mysession', 'open', server.HELLO_WORLD, '--persistent');

  const dataDir = path.resolve(await daemonFolder(), 'ud-mysession-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('--session=mysession', 'delete-data');
  expect(output).toContain(`Deleted user data for session 'mysession'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('delete-data non-existent session', async ({ cli }) => {
  const { output } = await cli('--session=nonexistent', 'delete-data');
  expect(output).toContain(`No user data found for session 'nonexistent'.`);
});

test('session stops when browser exits', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output: listBefore } = await cli('session-list');
  expect(listBefore).toContain('default');

  // Close the browser - this will cause the daemon to exit so the command may fail
  await cli('run-code', '() => page.context().browser().close()').catch(() => {});

  await expect.poll(() => cli('session-list').then(r => r.output)).toContain('default is stale, removing');
  await cli('close');
  const { output: listAfter } = await cli('session-list');
  expect(listAfter).toContain('(no sessions)');
});

test('session reopen with different config', async ({ cli, server }, testInfo) => {
  const config = { browser: { contextOptions: { viewport: { width: 700, height: 500 } } } };
  const configPath = testInfo.outputPath('config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
  {
    await cli('open', server.HELLO_WORLD, '--config=' + configPath);
    const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(output).toContain('700x500');
  }
  {
    // Reopen without config should use default viewport
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(output).toContain('1280x720');
  }
});

test('session start should print session options', async ({ cli, server }, testInfo) => {
  const configPath = testInfo.outputPath('my-config.json');
  await fs.promises.writeFile(configPath, JSON.stringify({}, null, 2));

  const { output } = await cli('open', '--headed', '--config=' + configPath, server.HELLO_WORLD);
  expect(output).toContain('Session options:');
  expect(output).toContain('--headed');
  expect(output).toContain('--config=my-config.json');
});

test('workspace isolation - sessions in different workspaces are isolated', async ({ cli, server }, testInfo) => {
  // Create two separate workspaces with their own daemon dirs
  const workspace1 = testInfo.outputPath('workspace1');
  const workspace2 = testInfo.outputPath('workspace2');
  await fs.promises.mkdir(workspace1, { recursive: true });
  await fs.promises.mkdir(workspace2, { recursive: true });

  await cli('install', { cwd: workspace1 });
  await cli('install', { cwd: workspace2 });

  expect(fs.existsSync(path.join(workspace1, '.playwright'))).toBe(true);
  expect(fs.existsSync(path.join(workspace2, '.playwright'))).toBe(true);

  // Open sessions in both workspaces
  await cli('open', server.HELLO_WORLD, { cwd: workspace1 });
  await cli('open', server.HELLO_WORLD, { cwd: workspace2 });

  const { output: list1 } = await cli('session-list', { cwd: workspace1 });
  expect(list1).toContain('default');
  const { output: list2 } = await cli('session-list', { cwd: workspace2 });
  expect(list2).toContain('default');

  await cli('close', { cwd: workspace1 });

  const { output: list1After } = await cli('session-list', { cwd: workspace1 });
  expect(list1After).toContain('(no sessions)');
  const { output: list2After } = await cli('session-list', { cwd: workspace2 });
  expect(list2After).toContain('default');

  await cli('close', { cwd: workspace2 });
});

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

test('list', async ({ cli, server }) => {
  const { output: emptyOutput } = await cli('list');
  expect(emptyOutput).toContain('### Browsers');
  expect(emptyOutput).toContain('  (no browsers)');

  await cli('open', server.HELLO_WORLD);

  const { output: listOutput } = await cli('list');
  expect(listOutput).toContain('### Browsers');
  expect(listOutput).toContain('- default:');
});

test('close', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output } = await cli('close');
  expect(output).toContain(`Browser 'default' closed`);

  const { output: listOutput } = await cli('list');
  expect(listOutput).toContain('(no browsers)');
});

test('close named session', async ({ cli, server }) => {
  await cli('-s', 'mysession', 'open', server.HELLO_WORLD);

  const { output } = await cli('-s', 'mysession', 'close');
  expect(output).toContain(`Browser 'mysession' closed`);
});

test('close non-running session', async ({ cli }) => {
  const { output } = await cli('-s', 'nonexistent', 'close');
  expect(output).toContain(`Browser 'nonexistent' is not open.`);
});

test('persistent session shows in list after close', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD, '--persistent');

  const { output: listBefore } = await cli('list');
  expect(listBefore).toContain('- default:');
  expect(listBefore).not.toContain('<in-memory>');

  await cli('close');

  const { output: listAfter } = await cli('list');
  expect(listAfter).toContain('- default:');
});

test('close-all', async ({ cli, server }) => {
  await cli('-s', 'session1', 'open', server.HELLO_WORLD);
  await cli('-s', 'session2', 'open', server.HELLO_WORLD);

  const { output: listBefore } = await cli('list');
  expect(listBefore).toContain('session1');
  expect(listBefore).toContain('session2');

  await cli('close-all');

  const { output: listAfter } = await cli('list');
  expect(listAfter).not.toContain('session1');
});

test('delete-data', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', server.HELLO_WORLD, '--persistent');

  const dataDir = path.resolve(await daemonFolder(), 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('delete-data');
  expect(output).toContain(`Deleted user data for browser 'default'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('delete-data named session', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('-s', 'mysession', 'open', server.HELLO_WORLD, '--persistent');

  const dataDir = path.resolve(await daemonFolder(), 'ud-mysession-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('-s', 'mysession', 'delete-data');
  expect(output).toContain(`Deleted user data for browser 'mysession'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('delete-data non-existent session', async ({ cli }) => {
  const { output } = await cli('-s', 'nonexistent', 'delete-data');
  expect(output).toContain(`No user data found for browser 'nonexistent'.`);
});

test('session stops when browser exits', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output: listBefore } = await cli('list');
  expect(listBefore).toContain('default');

  // Close the browser - this will cause the daemon to exit so the command may fail
  await cli('run-code', '() => page.context().browser().close()').catch(() => {});

  await cli('close');
  const { output: listAfter } = await cli('list');
  expect(listAfter).toContain('(no browsers)');
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

test('session start should print browser config', async ({ cli, server }, testInfo) => {
  const configPath = testInfo.outputPath('my-config.json');
  await fs.promises.writeFile(configPath, JSON.stringify({}, null, 2));

  const { output } = await cli('open', '--headed', '--config=' + configPath, server.HELLO_WORLD);
  expect(output).toContain('### Browser `default` opened');
  expect(output).toContain('- default:');
  expect(output).toContain('- headed:');
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

  const { output: list1 } = await cli('list', { cwd: workspace1 });
  expect(list1).toContain('default');
  const { output: list2 } = await cli('list', { cwd: workspace2 });
  expect(list2).toContain(' default');

  await cli('close', { cwd: workspace1 });

  const { output: list1After } = await cli('list', { cwd: workspace1 });
  expect(list1After).toContain('(no browsers)');
  const { output: list2After } = await cli('list', { cwd: workspace2 });
  expect(list2After).toContain('default');

  await cli('close', { cwd: workspace2 });
});

test('list --all lists sessions from all workspaces', async ({ cli, server }, testInfo) => {
  // Create two separate workspaces with their own daemon dirs
  const workspace1 = testInfo.outputPath('workspace1');
  const workspace2 = testInfo.outputPath('workspace2');
  await fs.promises.mkdir(workspace1, { recursive: true });
  await fs.promises.mkdir(workspace2, { recursive: true });

  await cli('install', { cwd: workspace1 });
  await cli('install', { cwd: workspace2 });

  // Open sessions in both workspaces
  await cli('-s', 'session1', 'open', server.HELLO_WORLD, { cwd: workspace1 });
  await cli('-s', 'session2', 'open', server.HELLO_WORLD, { cwd: workspace2 });

  // List all sessions from workspace1
  const { output: allList } = await cli('list', '--all', { cwd: workspace1 });

  // Should include both workspace folders and sessions
  expect(allList).toContain(workspace1);
  expect(allList).toContain(workspace2);
  expect(allList).toContain('session1');
  expect(allList).toContain('session2');

  await cli('-s', 'session1', 'close', { cwd: workspace1 });
  await cli('-s', 'session2', 'close', { cwd: workspace2 });
});

test('incompatible version - command fails with version mismatch error', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output, error, exitCode } = await cli('eval', '1+1', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '9.9.9' } });
  expect(exitCode).not.toBe(0);
  const fullOutput = output + error;
  expect(fullOutput).toContain('Client is v9.9.9');
  expect(fullOutput).toContain('playwright-cli open');
  expect(fullOutput).toContain('to restart the browser session');
});

test('incompatible version - named session includes session name in error', async ({ cli, server }) => {
  await cli('-s', 'mysession', 'open', server.HELLO_WORLD);

  const { output, error, exitCode } = await cli('-s', 'mysession', 'eval', '1+1', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '9.9.9' } });
  expect(exitCode).not.toBe(0);
  const fullOutput = output + error;
  expect(fullOutput).toContain('Client is v9.9.9');
  expect(fullOutput).toContain(`session 'mysession'`);
  expect(fullOutput).toContain('playwright-cli -s=mysession open');
});

test('incompatible version - list shows incompatible warning', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output } = await cli('list', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '9.9.9' } });
  expect(output).toContain('### Browsers');
  expect(output).toContain('- default:');
  expect(output).toContain('[incompatible please re-open]');
});

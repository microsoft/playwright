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

test('session-list', async ({ cli, server }) => {
  const { output: emptyOutput } = await cli('session-list');
  expect(emptyOutput).toContain('Sessions:');
  expect(emptyOutput).toContain('  (no sessions)');

  await cli('open', server.HELLO_WORLD);

  const { output: listOutput } = await cli('session-list');
  expect(listOutput).toContain('Sessions:');
  expect(listOutput).toContain('  [running] default');
});

test('session-stop', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output } = await cli('session-stop');
  expect(output).toContain(`Session 'default' stopped.`);

  const { output: listOutput } = await cli('session-list');
  expect(listOutput).toContain('[stopped] default');
});

test('session-stop named session', async ({ cli, server }) => {
  await cli('open', '--session=mysession', server.HELLO_WORLD);

  const { output } = await cli('session-stop', 'mysession');
  expect(output).toContain(`Session 'mysession' stopped.`);
});

test('session-stop non-running session', async ({ cli }) => {
  const { output } = await cli('session-stop', 'nonexistent');
  expect(output).toContain(`Session 'nonexistent' is not running.`);
});

test('session-stop-all', async ({ cli, server }) => {
  await cli('open', '--session=session1', server.HELLO_WORLD);
  await cli('open', '--session=session2', server.HELLO_WORLD);

  const { output: listBefore } = await cli('session-list');
  expect(listBefore).toContain('[running] session1');
  expect(listBefore).toContain('[running] session2');

  await cli('session-stop-all');

  const { output: listAfter } = await cli('session-list');
  expect(listAfter).not.toContain('[running]');
});

test('kill-all', async ({ cli, server }) => {
  await cli('open', '--session=killsession1', server.HELLO_WORLD);
  await cli('open', '--session=killsession2', server.HELLO_WORLD);

  const { output: listBefore } = await cli('session-list');
  expect(listBefore).toContain('[running] killsession1');
  expect(listBefore).toContain('[running] killsession2');

  const { output } = await cli('kill-all');
  expect(output).toContain('Killed daemon process');

  await expect.poll(() => cli('session-list').then(r => r.output)).not.toContain('[running]');
});

test('session-delete', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', server.HELLO_WORLD);

  const dataDir = testInfo.outputPath('daemon', 'ud-default-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('session-delete');
  expect(output).toContain(`Deleted user data for session 'default'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('session-delete named session', async ({ cli, server, mcpBrowser }, testInfo) => {
  await cli('open', '--session=mysession', server.HELLO_WORLD);

  const dataDir = testInfo.outputPath('daemon', 'ud-mysession-' + mcpBrowser);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('session-delete', 'mysession');
  expect(output).toContain(`Deleted user data for session 'mysession'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('session-delete non-existent session', async ({ cli }) => {
  const { output } = await cli('session-delete', 'nonexistent');
  expect(output).toContain(`No user data found for session 'nonexistent'.`);
});

test('session stops when browser exits', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output: listBefore } = await cli('session-list');
  expect(listBefore).toContain('[running] default');

  // Close the browser - this will cause the daemon to exit so the command may fail
  await cli('run-code', '() => page.context().browser().close()').catch(() => {});

  await expect.poll(() => cli('session-list').then(r => r.output)).toContain('[stopped]');
});

test('session restart', async ({ cli, server }, testInfo) => {
  const config = { browser: { contextOptions: { viewport: { width: 700, height: 500 } } } };
  const configPath = testInfo.outputPath('config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
  {
    await cli('open', server.HELLO_WORLD, '--config=' + configPath);
    const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(output).toContain('700x500');
    await cli('close');
  }
  {
    await cli('open', server.HELLO_WORLD);
    const { output } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
    expect(output).toContain('700x500');
  }
});

test('config should work', async ({ cli, server }, testInfo) => {
  // Start a session with default config
  await cli('open', server.PREFIX);
  const { output: beforeOutput } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
  expect(beforeOutput).toContain('1280x720');

  const config = {
    browser: {
      contextOptions: {
        viewport: { width: 700, height: 500 },
      },
    },
  };
  const configPath = testInfo.outputPath('session-config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

  const { output: configureOutput } = await cli('config', '--config=' + configPath);
  expect(configureOutput).toContain(`--config=`);

  await cli('open', server.PREFIX);
  const { output: afterOutput } = await cli('eval', 'window.innerWidth + "x" + window.innerHeight');
  expect(afterOutput).toContain('700x500');
});

test('session start should print session options', async ({ cli, server }, testInfo) => {
  const configPath = testInfo.outputPath('my-config.json');
  await fs.promises.writeFile(configPath, JSON.stringify({}, null, 2));

  const { output } = await cli('open', '--headed', '--config=' + configPath, server.HELLO_WORLD);
  expect(output).toContain('Session options:');
  expect(output).toContain('--headed');
  expect(output).toContain('--config=my-config.json');
});

test('session mismatch should report error for default session', async ({ cli, server }) => {
  // Start a default session
  await cli('open', server.HELLO_WORLD);

  // Try to pass global options to the already running session
  const { output, exitCode } = await cli('snapshot', '--headed');
  expect(exitCode).toBe(1);
  expect(output).toContain('The session is already configured.');
  expect(output).toContain('playwright-cli config --headed');
});

test('session mismatch should report error for named session', async ({ cli, server }) => {
  // Start a named session
  await cli('open', '--session=mismatch-named', server.HELLO_WORLD);

  // Try to pass global options to the already running session
  const { output, exitCode } = await cli('snapshot', '--session=mismatch-named', '--headed');
  expect(exitCode).toBe(1);
  expect(output).toContain('The session is already configured.');
  expect(output).toContain('playwright-cli --session=mismatch-named config --headed');
});

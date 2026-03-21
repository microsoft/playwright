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
import { killProcessGroup } from '../config/commonFixtures';
import playwright from '../../packages/playwright-core';

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

test('close terminates daemon process', async ({ cli, server }) => {
  const { pid } = await cli('open', server.HELLO_WORLD);
  expect(pid).toBeTruthy();
  const daemonPid = pid!;

  // Verify the daemon process is running.
  expect(() => process.kill(daemonPid, 0)).not.toThrow();

  await cli('close');

  // The daemon process (and its child browser process) should be gone.
  await expect.poll(() => {
    try {
      process.kill(daemonPid, 0);
      return false;
    } catch {
      return true;
    }
  }, { timeout: 10_000 }).toBe(true);
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

test('delete-data', async ({ cli, server, mcpBrowserNormalized }) => {
  await cli('open', server.HELLO_WORLD, '--persistent');

  const dataDir = path.resolve(await daemonFolder(), 'ud-default-' + mcpBrowserNormalized);
  expect(fs.existsSync(dataDir)).toBe(true);

  const { output } = await cli('delete-data');
  expect(output).toContain(`Deleted user data for browser 'default'.`);

  expect(fs.existsSync(dataDir)).toBe(false);
});

test('delete-data named session', async ({ cli, server, mcpBrowserNormalized }) => {
  await cli('-s', 'mysession', 'open', server.HELLO_WORLD, '--persistent');

  const dataDir = path.resolve(await daemonFolder(), 'ud-mysession-' + mcpBrowserNormalized);
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
  const workspace3 = testInfo.outputPath('workspace3');
  await fs.promises.mkdir(workspace1, { recursive: true });
  await fs.promises.mkdir(workspace2, { recursive: true });
  await fs.promises.mkdir(workspace3, { recursive: true });

  await cli('install', { cwd: workspace1 });
  await cli('install', { cwd: workspace2 });
  await cli('install', { cwd: workspace3 });

  await cli('-s', 'session1', 'open', server.HELLO_WORLD, { cwd: workspace1 });
  await cli('-s', 'session2', 'open', server.HELLO_WORLD, { cwd: workspace2 });
  const session3 = await cli('-s', 'session3', 'open', server.HELLO_WORLD, { cwd: workspace3 });

  // List all sessions from workspace1
  const { output: allList } = await cli('list', '--all', { cwd: workspace1 });

  // Should include both workspace folders and sessions
  expect(allList).toContain('/:');
  expect(allList).toContain('session1');
  expect(allList).toContain('..' + path.sep + 'workspace2:');
  expect(allList).toContain('session2');
  expect(allList).toContain('..' + path.sep + 'workspace3:');
  expect(allList).toContain('session3');

  const rootDir = test.info().outputPath('daemon');
  const dirs = await fs.promises.readdir(rootDir);
  const getSessionFiles = async () => (await Promise.all(dirs.map(dir => fs.promises.readdir(path.join(rootDir, dir))))).flat();

  const sessionFilesBefore = await getSessionFiles();
  expect(sessionFilesBefore).toContain('session1.session');
  expect(sessionFilesBefore).toContain('session2.session');
  expect(sessionFilesBefore).toContain('session3.session');

  await cli('-s', 'session1', 'close', { cwd: workspace1 });

  const { output: listTwo } = await cli('list', '--all', { cwd: workspace2 });
  expect(listTwo).not.toContain('workspace1');
  expect(listTwo).not.toContain('session1');
  expect(listTwo).toContain('/:');
  expect(listTwo).toContain('session2');
  expect(listTwo).toContain('workspace3');
  expect(listTwo).toContain('session3');

  const sessionFilesAfterClose = await getSessionFiles();
  expect(sessionFilesAfterClose).not.toContain('session1.session');
  expect(sessionFilesAfterClose).toContain('session2.session');
  expect(sessionFilesAfterClose).toContain('session3.session');

  killProcessGroup(session3.pid);

  const { output: listOne } = await cli('list', '--all', { cwd: workspace2 });
  expect(listOne).not.toContain('workspace1');
  expect(listOne).not.toContain('session1');
  expect(listOne).toContain('/:');
  expect(listOne).toContain('session2');
  expect(listOne).not.toContain('workspace3');
  expect(listOne).not.toContain('session3');

  const sessionFilesAfterList = await getSessionFiles();
  expect(sessionFilesAfterList).not.toContain('session1.session');
  expect(sessionFilesAfterList).toContain('session2.session');
  expect(sessionFilesAfterList).not.toContain('session3.session');
});

test('newer client with older daemon is compatible', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { exitCode } = await cli('eval', '1+1', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '9.9.9' } });
  expect(exitCode).toBe(0);
});

test('older client with newer daemon fails with version mismatch error', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output, error, exitCode } = await cli('eval', '1+1', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '0.0.1' } });
  expect(exitCode).not.toBe(0);
  const fullOutput = output + error;
  expect(fullOutput).toContain('Client is v0.0.1');
  expect(fullOutput).toContain('playwright-cli open');
  expect(fullOutput).toContain('to restart the browser session');
});

test('older client with newer daemon - named session includes session name in error', async ({ cli, server }) => {
  await cli('-s', 'mysession', 'open', server.HELLO_WORLD);

  const { output, error, exitCode } = await cli('-s', 'mysession', 'eval', '1+1', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '0.0.1' } });
  expect(exitCode).not.toBe(0);
  const fullOutput = output + error;
  expect(fullOutput).toContain('Client is v0.0.1');
  expect(fullOutput).toContain(`session 'mysession'`);
  expect(fullOutput).toContain('playwright-cli -s=mysession open');
});

test('older client with newer daemon - list shows incompatible warning', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);

  const { output } = await cli('list', { env: { PLAYWRIGHT_CLI_VERSION_FOR_TEST: '0.0.1' } });
  expect(output).toContain('### Browsers');
  expect(output).toContain('- default:');
  expect(output).toContain('[incompatible please re-open]');
});

test.describe('browser server', () => {
  test.beforeEach(async ({ mcpBrowser }, testInfo) => {
    test.skip(!['chrome', 'chromium', 'webkit', 'firefox'].includes(mcpBrowser));
    process.env.PLAYWRIGHT_SERVER_REGISTRY = testInfo.outputPath('registry');
  });

  test('list browser servers', async ({ cli, mcpBrowser }) => {
    const browserName = mcpBrowser.replace('chrome', 'chromium');
    await using browser = await playwright[browserName].launch({ headless: true });
    await (browser as any)._register('foobar', { workspaceDir: 'workspace1' });
    const { output } = await cli('list', '--all');
    expect(output).toBe(`### Browser servers available for attach
workspace1:
- browser "foobar":
  - browser: ${/* FIX browser._options */ mcpBrowser.replace('chrome', 'chromium')}
  - version: ${version}
  - run \`playwright-cli attach "foobar"\` to attach`);
  });

  test('attach to browser server', async ({ cli, mcpBrowser }) => {
    const browserName = mcpBrowser.replace('chrome', 'chromium');
    await using browser = await playwright[browserName].launch({ headless: true });
    await (browser as any)._register('foobar', { workspaceDir: 'workspace1' });
    const page = await browser.newPage();
    await page.setContent('<title>My Page</title>');
    const { output: openOutput } = await cli('attach', 'foobar');
    expect(openOutput).toContain('### Session `foobar` created, attached to `foobar`.');
    expect(openOutput).toContain('Run commands with: playwright-cli --session=foobar <command>');
    const { output: listOutput } = await cli('list', '--all');
    expect(listOutput).toBe(`### Browsers
/:
- foobar:
  - status: open
  - browser-type: ${/* FIX browser._options */ mcpBrowser.replace('chrome', 'chromium')}
  - user-data-dir: <in-memory>
  - headed: false`);
  });

  test('fail to attach to browser server without contexts', async ({ cli, mcpBrowser }) => {
    const browserName = mcpBrowser.replace('chrome', 'chromium');
    await using browser = await playwright[browserName].launch({ headless: true });
    await (browser as any)._register('foobar', { workspaceDir: 'workspace1' });
    const { error } = await cli('attach', 'foobar');
    expect(error).toContain('Error: unable to connect to a browser that does not have any contexts');
  });

  test('attach via PLAYWRIGHT_CLI_SESSION env', async ({ cli, mcpBrowser }) => {
    const browserName = mcpBrowser.replace('chrome', 'chromium');
    await using browser = await playwright[browserName].launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<title>Env Page</title><h1>Hello from env</h1>');
    await (browser as any)._register('foobar', { workspaceDir: 'workspace1' });
    const { output: openOutput, snapshot } = await cli('open', { env: { PLAYWRIGHT_CLI_SESSION: 'foobar' } });
    expect(openOutput).toContain('### Browser `foobar` opened with pid');
    expect(openOutput).toContain('Env Page');
    expect(snapshot).toContain('Hello from env');
    const { output: listOutput } = await cli('list', '--all');
    expect(listOutput).toBe(`### Browsers
/:
- foobar:
  - status: open
  - browser-type: ${mcpBrowser.replace('chrome', 'chromium')}
  - user-data-dir: <in-memory>
  - headed: false`);
  });

  test('attach with session alias', async ({ cli, mcpBrowser }) => {
    const browserName = mcpBrowser.replace('chrome', 'chromium');
    await using browser = await playwright[browserName].launch({ headless: true });
    await (browser as any)._register('foobar', { workspaceDir: 'workspace1' });
    const page = await browser.newPage();
    await page.setContent('<title>Alias Page</title>');
    const { output: openOutput } = await cli('attach', 'foobar', '--session=mybrowser');
    expect(openOutput).toContain('### Session `mybrowser` created, attached to `foobar`.');
    expect(openOutput).toContain('Run commands with: playwright-cli --session=mybrowser <command>');
    await cli('-s', 'mybrowser', 'close');
  });

  test('detach from browser server', async ({ cli, mcpBrowser }) => {
    const browserName = mcpBrowser.replace('chrome', 'chromium');
    await using browser = await playwright[browserName].launch({ headless: true });
    await browser.newPage();
    await (browser as any)._register('foobar', { workspaceDir: 'workspace1' });
    const { output: openOutput } = await cli('attach', 'foobar');
    expect(openOutput).toContain('Session `foobar` created, attached to `foobar`');
    await cli('-s', 'foobar', 'close');
    const { output: listOutput } = await cli('list', '--all');
    expect(listOutput).toBe(`### Browser servers available for attach
workspace1:
- browser \"foobar\":
  - browser: ${/* FIX browser._options */ mcpBrowser.replace('chrome', 'chromium')}
  - version: ${version}
  - run \`playwright-cli attach \"foobar\"\` to attach`);
  });
});

const version = 'v' + require('../../packages/playwright-core/package.json').version;

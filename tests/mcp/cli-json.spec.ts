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

import { test, expect } from './cli-fixtures';

const SNAPSHOT_FILE = expect.stringMatching(/^\.playwright-cli[\\/]page-[\dTZ:.-]+\.yml$/);

test('output is pretty-printed', async ({ cli }) => {
  const { output } = await cli('--json', 'list');
  expect(output).toBe(`{
  "browsers": []
}`);
});

test('version command returns JSON', async ({ cli }) => {
  const { output } = await cli('--json', '--version');
  const parsed = JSON.parse(output);
  expect(parsed).toEqual({ version: expect.any(String) });
});

test('unknown command returns JSON error with exit 1', async ({ cli }) => {
  const { output, exitCode } = await cli('--json', 'nope');
  expect(JSON.parse(output)).toEqual({ isError: true, error: 'Unknown command: nope' });
  expect(exitCode).toBe(1);
});

test('unknown flag returns JSON error with exit 1', async ({ cli }) => {
  const { output, exitCode } = await cli('--json', 'list', '--bogus');
  expect(JSON.parse(output)).toEqual({ isError: true, error: 'Unknown option: --bogus' });
  expect(exitCode).toBe(1);
});

test('running tool command without open browser returns JSON error', async ({ cli }) => {
  const { output, exitCode } = await cli('--json', 'goto', 'about:blank');
  expect(JSON.parse(output)).toEqual({
    isError: true,
    error: `The browser 'default' is not open, please run open first`,
  });
  expect(exitCode).toBe(1);
});

test('list returns empty browsers before open', async ({ cli }) => {
  const { output } = await cli('--json', 'list');
  expect(JSON.parse(output)).toEqual({ browsers: [] });
});

test('close returns not-open status when nothing is running', async ({ cli }) => {
  const { output } = await cli('--json', 'close');
  expect(JSON.parse(output)).toEqual({ session: 'default', status: 'not-open' });
});

test('delete-data returns not-deleted when there is no session', async ({ cli }) => {
  const { output } = await cli('--json', 'delete-data');
  expect(JSON.parse(output)).toEqual({ session: 'default', deleted: false });
});

test('kill-all returns zero killed when filter matches nothing', async ({ cli }) => {
  const { output } = await cli('--json', 'kill-all', { env: { PLAYWRIGHT_KILL_ALL_PID_FILTER_FOR_TEST: '0' } });
  expect(JSON.parse(output)).toEqual({ killed: 0, pids: [] });
});

test('open returns envelope with session, pid and snapshot file', async ({ cli, server }) => {
  const { output } = await cli('--json', 'open', server.HELLO_WORLD);
  expect(JSON.parse(output)).toEqual({
    session: 'default',
    pid: expect.any(Number),
    result: { snapshot: { file: SNAPSHOT_FILE } },
  });
});

test('list after open returns one browser entry', async ({ cli, server, mcpBrowserNormalized }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'list');
  expect(JSON.parse(output)).toEqual({
    browsers: [{
      name: 'default',
      workspace: expect.any(String),
      status: 'open',
      browserType: mcpBrowserNormalized,
      userDataDir: null,
      headed: false,
      persistent: false,
      attached: false,
      compatible: true,
      version: expect.any(String),
    }],
  });
});

test('goto returns snapshot file envelope', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'goto', server.HELLO_WORLD);
  expect(JSON.parse(output)).toEqual({ snapshot: { file: SNAPSHOT_FILE } });
});

test('eval returns result string', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'eval', '() => 1 + 2');
  expect(JSON.parse(output)).toEqual({ result: '3' });
});

test('eval with error surfaces isError JSON', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'eval', '() => { throw new Error("boom"); }');
  const parsed = JSON.parse(output);
  expect(parsed.isError).toBe(true);
  expect(parsed.error).toContain('boom');
});

test('tab-new creates a new tab and returns tab list', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'tab-new');
  const parsed = JSON.parse(output);
  expect(parsed.result.split('\n')).toEqual([
    `- 0: [Title](${server.HELLO_WORLD})`,
    '- 1: (current) [](about:blank)',
  ]);
});

test('tab-list lists all tabs', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('tab-new');
  const { output } = await cli('--json', 'tab-list');
  const parsed = JSON.parse(output);
  expect(parsed.result.split('\n')).toEqual([
    `- 0: [Title](${server.HELLO_WORLD})`,
    '- 1: (current) [](about:blank)',
  ]);
});

test('tab-close closes a tab and returns remaining tabs', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('tab-new');
  const { output } = await cli('--json', 'tab-close');
  const parsed = JSON.parse(output);
  expect(parsed.result.split('\n')).toEqual([
    `- 0: (current) [Title](${server.HELLO_WORLD})`,
  ]);
});

test('snapshot returns inline snapshot yaml', async ({ cli, server }) => {
  server.setContent('/', '<h1>Hi</h1>', 'text/html');
  await cli('open', server.PREFIX);
  const { output } = await cli('--json', 'snapshot');
  const parsed = JSON.parse(output);
  expect(typeof parsed.snapshot).toBe('string');
  expect(parsed.snapshot).toContain('heading "Hi"');
});

test('tool error on bad navigation returns JSON error', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'goto', 'https://not-a-real-domain.example.invalid');
  const parsed = JSON.parse(output);
  expect(parsed.isError).toBe(true);
  expect(typeof parsed.error).toBe('string');
});

test('close after open returns closed status', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'close');
  expect(JSON.parse(output)).toEqual({ session: 'default', status: 'closed' });
});

test('close-all after open returns closed sessions', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('--json', 'close-all');
  expect(JSON.parse(output)).toEqual({ closed: ['default'] });
});

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

import { test, expect, eventsPage } from './cli-fixtures';

test('unknown option', async ({ cli, server }) => {
  const { error, exitCode } = await cli('open', '--some-option', 'value', 'about:blank');
  expect(exitCode).toBe(1);
  expect(error).toContain(`Unknown option: --some-option`);
});

test('unknown option typo', async ({ cli }) => {
  const { error, exitCode } = await cli('install', '--skill');
  expect(exitCode).toBe(1);
  expect(error).toContain(`Unknown option: --skill`);
});

test('too many arguments', async ({ cli, server }) => {
  const { error, exitCode } = await cli('open', 'foo', 'bar');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: too many arguments: expected 1, received 2`);
});

test('wrong option type', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const boolean = await cli('type', 'foo', '--submit=bar');
  expect(boolean.exitCode).toBe(1);
  expect(boolean.error).toContain(`boolean option '--submit' should not be passed with '=value', use '--submit' or '--no-submit' instead`);
  const status = await cli('route', '.', '--status=OK');
  expect(status.exitCode).toBe(1);
  expect(status.error).toContain(`error: '--status' option: expected number, received 'OK'`);
});

test('arg after boolean option', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const boolean = await cli('type', '--submit', 'foo');
  expect(boolean.exitCode).toBe(0);
});

test('missing argument', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { error, exitCode } = await cli('keyup');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: 'key' argument: expected string, received undefined`);
});

test('missing variadic argument', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42047' } }, async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { error, exitCode } = await cli('upload');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: 'files' argument: expected string, received undefined`);
});

test('wrong argument type', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { error, exitCode } = await cli('mousemove', '12', 'foo');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: 'y' argument: expected number, received 'foo'`);
  const press = await cli('press', '5');
  expect(press.exitCode).toBe(0);
});

test('should accept negative number arguments', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42321' } }, async ({ cli, server }) => {
  server.setContent('/', eventsPage, 'text/html');
  await cli('open', server.PREFIX);
  await cli('mousemove', '50', '50');
  await cli('mousedown');
  await cli('mouseup');

  const { exitCode } = await cli('mousewheel', '0', '-100');
  expect(exitCode).toBe(0);

  await expect.poll(() => cli('snapshot').then(result => result.inlineSnapshot)).toContain('wheel 0 -100');
});

test('should preserve leading zeros in string arguments', async ({ cli, server }) => {
  server.setContent('/', `<input type=text>`, 'text/html');
  await cli('open', server.PREFIX);
  await cli('click', 'e2');
  await cli('type', '0812345679');
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain(`0812345679`);
});

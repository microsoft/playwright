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

test('unknown option', async ({ cli, server }) => {
  const { error, exitCode } = await cli('open', '--some-option', 'value', 'about:blank');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: unknown '--some-option' option`);
});

test('too many arguments', async ({ cli, server }) => {
  const { error, exitCode } = await cli('open', 'foo', 'bar');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: too many arguments: expected 1, received 2`);
});

test('wrong option type', async ({ cli, server }) => {
  const { error, exitCode } = await cli('type', 'foo', '--submit=bar');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: '--submit' option: expected boolean, received string`);
});

test('missing argument', async ({ cli, server }) => {
  const { error, exitCode } = await cli('keyup');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: 'key' argument: expected string, received undefined`);
});

test('wrong argument type', async ({ cli, server }) => {
  const { error, exitCode } = await cli('mousemove', '12', 'foo');
  expect(exitCode).toBe(1);
  expect(error).toContain(`error: 'y' argument: expected number, received string`);
});

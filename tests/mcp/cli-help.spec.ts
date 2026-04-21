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

test('prints help', async ({ cli }) => {
  const { output } = await cli('--help');
  expect(output).toContain('Usage: playwright-cli <command>');
});

test('prints help by default', async ({ cli }) => {
  const { output } = await cli();
  expect(output).toContain('Usage: playwright-cli <command>');
});

test('prints command help', async ({ cli }) => {
  const { output } = await cli('click', '--help');
  expect(output).toContain('playwright-cli click <target> [button]');
});

test('prints agent skill path when running under a coding agent', async ({ cli }) => {
  const { output } = await cli('--help', { env: { CLAUDECODE: '1' } });
  expect(output).toContain('Agent skill:');
});

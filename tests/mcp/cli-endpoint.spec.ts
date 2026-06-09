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

test('attach --endpoint keeps the default session', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41154' } }, async ({ wsEndpoint, cli, server }) => {
  const { exitCode, error } = await cli('attach', `--endpoint=${wsEndpoint}`);
  expect(error).not.toContain('no target specified');
  expect(exitCode).toBe(0);

  const { output: listOutput } = await cli('list');
  expect(listOutput).toContain('- default:');
  expect(listOutput).toContain('(attached)');

  await cli('goto', server.HELLO_WORLD);
  const { inlineSnapshot } = await cli('snapshot');
  expect(inlineSnapshot).toContain('Hello, world!');
});

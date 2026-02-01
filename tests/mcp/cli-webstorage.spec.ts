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

test('localstorage-list shows no items when empty', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  const { output } = await cli('localstorage-list');
  expect(output).toContain('No localStorage items found');
});

test('localstorage-set and localstorage-get', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);

  // Set an item
  await cli('localstorage-set', 'testKey', 'testValue');

  // Get the item
  const { output: getOutput } = await cli('localstorage-get', 'testKey');
  expect(getOutput).toContain('testKey=testValue');
});

test('localstorage-list shows items', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('localstorage-set', 'key1', 'value1');
  await cli('localstorage-set', 'key2', 'value2');

  const { output } = await cli('localstorage-list');
  expect(output).toContain('key1=value1');
  expect(output).toContain('key2=value2');
});

test('localstorage-delete removes item', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('localstorage-set', 'testKey', 'testValue');

  // Delete the item
  await cli('localstorage-delete', 'testKey');

  // Verify it's gone
  const { output: getOutput } = await cli('localstorage-get', 'testKey');
  expect(getOutput).toContain('not found');
});

test('localstorage-clear removes all items', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('localstorage-set', 'key1', 'value1');
  await cli('localstorage-set', 'key2', 'value2');

  // Clear all items
  await cli('localstorage-clear');

  // Verify they're gone
  const { output: listOutput } = await cli('localstorage-list');
  expect(listOutput).toContain('No localStorage items found');
});

test('sessionstorage-list shows no items when empty', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  const { output } = await cli('sessionstorage-list');
  expect(output).toContain('No sessionStorage items found');
});

test('sessionstorage-set and sessionstorage-get', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);

  // Set an item
  await cli('sessionstorage-set', 'testKey', 'testValue');

  // Get the item
  const { output: getOutput } = await cli('sessionstorage-get', 'testKey');
  expect(getOutput).toContain('testKey=testValue');
});

test('sessionstorage-list shows items', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('sessionstorage-set', 'key1', 'value1');
  await cli('sessionstorage-set', 'key2', 'value2');

  const { output } = await cli('sessionstorage-list');
  expect(output).toContain('key1=value1');
  expect(output).toContain('key2=value2');
});

test('sessionstorage-delete removes item', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('sessionstorage-set', 'testKey', 'testValue');

  // Delete the item
  await cli('sessionstorage-delete', 'testKey');

  // Verify it's gone
  const { output: getOutput } = await cli('sessionstorage-get', 'testKey');
  expect(getOutput).toContain('not found');
});

test('sessionstorage-clear removes all items', async ({ cli, server }, testInfo) => {
  const config = { capabilities: ['storage'] };
  await fs.promises.writeFile(testInfo.outputPath('playwright-cli.json'), JSON.stringify(config, null, 2));

  await cli('open', server.EMPTY_PAGE);
  await cli('sessionstorage-set', 'key1', 'value1');
  await cli('sessionstorage-set', 'key2', 'value2');

  // Clear all items
  await cli('sessionstorage-clear');

  // Verify they're gone
  const { output: listOutput } = await cli('sessionstorage-list');
  expect(listOutput).toContain('No sessionStorage items found');
});

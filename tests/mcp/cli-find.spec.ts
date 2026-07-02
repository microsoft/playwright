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

const listPage = `
  <h1>Groceries</h1>
  <ul>
    <li>Apples</li>
    <li>Bananas</li>
    <li>Cherries</li>
  </ul>
`;

test('find by text', async ({ cli, server }) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('find', 'Bananas');
  expect(output).toContain('Found 1 match for "Bananas":');
  expect(output).toContain('Apples');
  expect(output).toContain('Cherries');
});

test('find by regex', async ({ cli, server }) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('find', '--regex=Bananas|Cherries');
  expect(output).toContain('Found 2 matches for /Bananas|Cherries/:');
});

test('find by regex with /i flag', async ({ cli, server }) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('find', '--regex=/apples/i');
  expect(output).toContain('Found 1 match for /apples/i:');
});

test('find reports no matches', async ({ cli, server }) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('find', 'Pineapples');
  expect(output).toContain('No matches found for "Pineapples".');
});

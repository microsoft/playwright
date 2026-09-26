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

test('find --filename', async ({ cli, server }, testInfo) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('find', 'Bananas', '--filename=find.md');
  expect(output).toContain('[Find results](./find.md)');
  expect(output).not.toContain('Apples');

  const content = fs.readFileSync(testInfo.outputPath('find.md'), 'utf-8');
  expect(content).toContain('Found 1 match for "Bananas":');
  expect(content).toContain('Apples');
});

test('find --max-results truncates output', async ({ cli, server }) => {
  server.setContent('/', `
    <section aria-label="First Section">
      <ul>
        <li>Fruit: Apples</li>
        <li>Fruit: Bananas</li>
        <li>Spacer 1</li>
        <li>Spacer 2</li>
        <li>Spacer 3</li>
        <li>Spacer 4</li>
      </ul>
    </section>
    <section aria-label="Second Section">
      <ul>
        <li>Fruit: Cherries</li>
      </ul>
    </section>
  `, 'text/html');
  await cli('open', server.PREFIX);

  // With 3 matches and --max-results=2: header shows truncation notice,
  // output contains first 2 matches and their ancestor, and omits the 3rd match and its ancestor.
  const { output } = await cli('find', '--regex=Fruit', '--max-results=2');
  expect(output).toContain('Found 3 matches for /Fruit/ (showing first 2):');
  expect(output).toContain('Apples');
  expect(output).toContain('Bananas');
  expect(output).toContain('First Section');
  expect(output).not.toContain('Cherries');
  expect(output).not.toContain('Second Section');
});

test('find --max-results exceeding match count shows all results', async ({ cli, server }) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  // With --max-results exceeding the total match count, no truncation suffix appears.
  const { output } = await cli('find', 'Bananas', '--max-results=10');
  expect(output).toContain('Found 1 match for "Bananas":');
  expect(output).not.toContain('(showing first');
});

test('find --max-results=0 is rejected', async ({ cli, server }) => {
  server.setContent('/', listPage, 'text/html');
  await cli('open', server.PREFIX);

  const { output } = await cli('find', 'Apples', '--max-results=0');
  expect(output).toContain('"maxResults" must be a positive integer.');
});

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

test('run-code inline', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="document.title = 'clicked'">Submit</button>
  `, 'text/html');
  await cli('open', server.PREFIX);
  const { output } = await cli('run-code', 'async (page) => { await page.getByRole("button", { name: "Submit" }).click(); return await page.title(); }');
  expect(output).toContain('clicked');
});

test('run-code from file', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="document.title = 'from-file'">Submit</button>
  `, 'text/html');
  await cli('open', server.PREFIX);

  const code = 'async (page) => { await page.getByRole("button", { name: "Submit" }).click(); return await page.title(); }';
  await fs.promises.writeFile(test.info().outputPath('script.js'), code);

  const { output } = await cli('run-code', '--filename=script.js');
  expect(output).toContain('from-file');
});

test('run-code from file with template literals', async ({ cli, server }) => {
  server.setContent('/', `
    <button onclick="document.title = 'templated'">Submit</button>
  `, 'text/html');
  await cli('open', server.PREFIX);

  const code = [
    'async (page) => {',
    '  await page.getByRole("button", { name: "Submit" }).click();',
    '  const title = await page.title();',
    '  return `result: ${title}`;',
    '}',
  ].join('\n');
  await fs.promises.writeFile(test.info().outputPath('template-script.js'), code);

  const { output } = await cli('run-code', '--filename=template-script.js');
  expect(output).toContain('result: templated');
});

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

import path from 'path';
import { test, expect } from './fixtures';

test('terminal mode', async ({ startClient, server }) => {
  server.setContent('/', formHtml, 'text/html');
  const outputDir = test.info().outputPath('output');

  const { client } = await startClient({
    args: ['--codegen=none', '--output-mode=file', '--snapshot-mode=full', '--output-dir=' + outputDir],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveTextResponse(`### Page
- Page URL: ${server.PREFIX}/

### Snapshot
- File: output${path.sep}snapshot-1.yml
`);

  expect(await client.callTool({
    name: 'browser_type',
    arguments: {
      ref: 'e4',
      element: 'Name textbox',
      text: 'John Doe',
    },
  })).toHaveTextResponse('');

  expect(await client.callTool({
    name: 'browser_type',
    arguments: {
      ref: 'e6',
      element: 'Email textbox',
      text: 'john.doe@example.com',
    },
  })).toHaveTextResponse('');

  expect(await client.callTool({
    name: 'browser_type',
    arguments: {
      ref: 'e8',
      element: 'Age textbox',
      text: '25',
    },
  })).toHaveTextResponse('');

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      ref: 'e10',
      element: 'Country select',
      values: ['United States'],
    },
  })).toHaveTextResponse(`### Snapshot
- File: output${path.sep}snapshot-5.yml
`);

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      ref: 'e12',
      element: 'Subscribe checkbox',
    },
  })).toHaveTextResponse(`### Snapshot
- File: output${path.sep}snapshot-6.yml
`);
});


const formHtml = `
  <!DOCTYPE html>
  <html>
    <body>
      <form>
        <label>
          <input type="text" id="name" name="name" />
          Name
        </label>
        <label>
          <input type="email" id="email" name="email" />
          Email
        </label>
        <label>
          <input type="range" id="age" name="age" min="18" max="100" />
          Age
        </label>
        <label>
          <select id="country" name="country">
            <option value="">Choose a country</option>
            <option value="us">United States</option>
            <option value="uk">United Kingdom</option>
          </select>
          Country
        </label>
        <label>
          <input type="checkbox" name="subscribe" value="newsletter" />
          Subscribe to newsletter
        </label>
      </form>
    </body>
  </html>`;

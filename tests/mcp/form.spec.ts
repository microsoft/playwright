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

import { test, expect } from './fixtures';

test('browser_fill_form (textbox)', async ({ client, server }) => {
  server.setContent('/', `
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
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_fill_form',
    arguments: {
      fields: [
        {
          name: 'Name textbox',
          type: 'textbox',
          ref: 'e4',
          value: 'John Doe'
        },
        {
          name: 'Email textbox',
          type: 'textbox',
          ref: 'e6',
          value: 'john.doe@example.com'
        },
        {
          name: 'Age textbox',
          type: 'slider',
          ref: 'e8',
          value: '25'
        },
        {
          name: 'Country select',
          type: 'combobox',
          ref: 'e10',
          value: 'United States'
        },
        {
          name: 'Subscribe checkbox',
          type: 'checkbox',
          ref: 'e12',
          value: 'true'
        },
      ]
    },
  })).toHaveResponse({
    code: `await page.getByRole('textbox', { name: 'Name' }).fill('John Doe');
await page.getByRole('textbox', { name: 'Email' }).fill('john.doe@example.com');
await page.getByRole('slider', { name: 'Age' }).fill('25');
await page.getByLabel('Choose a country United').selectOption('United States');
await page.getByRole('checkbox', { name: 'Subscribe to newsletter' }).setChecked(true);`,
  });

  const response = await client.callTool({
    name: 'browser_snapshot',
    arguments: {
    },
  });
  expect.soft(response).toHaveResponse({
    pageState: expect.stringMatching(/textbox "Name".*John Doe/),
  });
  expect.soft(response).toHaveResponse({
    pageState: expect.stringMatching(/textbox "Email".*john.doe@example.com/),
  });
  expect.soft(response).toHaveResponse({
    pageState: expect.stringMatching(/slider "Age".*"25"/),
  });
  expect.soft(response).toHaveResponse({
    pageState: expect.stringContaining('option \"United States\" [selected]'),
  });
  expect.soft(response).toHaveResponse({
    pageState: expect.stringContaining('checkbox \"Subscribe to newsletter\" [checked]'),
  });
});

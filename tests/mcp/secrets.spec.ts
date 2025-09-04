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

import fs from 'node:fs';

import { test, expect } from './fixtures';

test('browser_type', async ({ startClient, server }) => {
  const secretsFile = test.info().outputPath('secrets.env');
  await fs.promises.writeFile(secretsFile, 'X-PASSWORD=password123');

  const { client } = await startClient({
    args: ['--secrets', secretsFile],
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <input type='keypress' onkeypress="console.log('Key pressed:', event.key, ', Text:', event.target.value)"></input>
    </html>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  {
    const response = await client.callTool({
      name: 'browser_type',
      arguments: {
        element: 'textbox',
        ref: 'e2',
        text: 'X-PASSWORD',
        submit: true,
      },
    });
    expect(response).toHaveResponse({
      code: `await page.getByRole('textbox').fill(process.env['X-PASSWORD']);
await page.getByRole('textbox').press('Enter');`,
      pageState: expect.stringContaining(`- textbox`),
    });
  }

  expect(await client.callTool({
    name: 'browser_console_messages',
  })).toHaveResponse({
    result: expect.stringContaining(`[LOG] Key pressed: Enter , Text: <secret>X-PASSWORD</secret>`),
  });
});


test('browser_fill_form', async ({ startClient, server }) => {
  const secretsFile = test.info().outputPath('secrets.env');
  await fs.promises.writeFile(secretsFile, 'X-PASSWORD=password123');

  const { client } = await startClient({
    args: ['--secrets', secretsFile],
  });

  server.setContent('/', `
    <!DOCTYPE html>
    <html>
      <body>
        <form>
          <label>
            <input type="email" id="email" name="email" />
            Email
          </label>
          <label>
            <input type="password" id="name" name="password" />
            Password
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
          name: 'Email textbox',
          type: 'textbox',
          ref: 'e4',
          value: 'John Doe'
        },
        {
          name: 'Password textbox',
          type: 'textbox',
          ref: 'e6',
          value: 'X-PASSWORD'
        },
      ]
    },
  })).toHaveResponse({
    code: `await page.getByRole('textbox', { name: 'Email' }).fill('John Doe');
await page.getByRole('textbox', { name: 'Password' }).fill(process.env['X-PASSWORD']);`,
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveResponse({
    pageState: expect.stringContaining(`- textbox \"Password\" [active] [ref=e6]: <secret>X-PASSWORD</secret>`),
  });
});

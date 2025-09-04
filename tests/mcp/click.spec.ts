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

test('browser_click', async ({ client, server, mcpBrowser }) => {
  server.setContent('/', `
    <title>Title</title>
    <button>Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- button "Submit" ${mcpBrowser !== 'webkit' || process.platform === 'linux' ? '[active] ' : ''}[ref=e2]`),
  });
});

test('browser_click (double)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <script>
      function handle() {
        document.querySelector('h1').textContent = 'Double clicked';
      }
    </script>
    <h1 ondblclick="handle()">Click me</h1>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
      doubleClick: true,
    },
  })).toHaveResponse({
    code: `await page.getByRole('heading', { name: 'Click me' }).dblclick();`,
    pageState: expect.stringContaining(`- heading "Double clicked" [level=1] [ref=e3]`),
  });
});

test('browser_click (right)', async ({ client, server }) => {
  server.setContent('/', `
    <button oncontextmenu="handle">Menu</button>
    <script>
      document.addEventListener('contextmenu', event => {
        event.preventDefault();
        document.querySelector('button').textContent = 'Right clicked';
      });
    </script>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Menu',
      ref: 'e2',
      button: 'right',
    },
  });
  expect(result).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Menu' }).click({ button: 'right' });`,
    pageState: expect.stringContaining(`- button "Right clicked"`),
  });
});

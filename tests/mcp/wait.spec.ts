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

test('browser_wait_for(text)', async ({ client, server }) => {
  server.setContent('/', `
    <script>
      function update() {
        setTimeout(() => {
          document.querySelector('div').textContent = 'Text to appear';
        }, 1000);
      }
    </script>
    <body>
      <button onclick="update()">Click me</button>
      <div>Text to disappear</div>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
    },
  });

  expect(await client.callTool({
    name: 'browser_wait_for',
    arguments: { text: 'Text to appear' },
    code: `await page.getByText("Text to appear").first().waitFor({ state: 'visible' });`,
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [ref=e3]: Text to appear`),
  });
});

test('browser_wait_for(textGone)', async ({ client, server }) => {
  server.setContent('/', `
    <script>
      function update() {
        setTimeout(() => {
          document.querySelector('div').textContent = 'Text to appear';
        }, 1000);
      }
    </script>
    <body>
      <button onclick="update()">Click me</button>
      <div>Text to disappear</div>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Click me',
      ref: 'e2',
    },
  });

  expect(await client.callTool({
    name: 'browser_wait_for',
    arguments: { textGone: 'Text to disappear' },
    code: `await page.getByText("Text to disappear").first().waitFor({ state: 'hidden' });`,
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [ref=e3]: Text to appear`),
  });
});

test('browser_wait_for(time)', async ({ client, server }) => {
  server.setContent('/', `<body><div>Hello World</div></body>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_wait_for',
    arguments: { time: 1 },
  })).toHaveResponse({
    code: `await new Promise(f => setTimeout(f, 1 * 1000));`,
  });
});

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

test('should respect --snapshot-mode=full', async ({ startClient, server }) => {
  server.setContent('/', `<button>Button 1</button>`, 'text/html');

  const { client } = await startClient({
    args: ['--snapshot-mode=full'],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
- button "Button 1" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        const button2 = document.createElement('button');
        button2.textContent = 'Button 2';
        document.body.appendChild(button2);
      }`,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
  - button "Button 1" [ref=e2]
  - button "Button 2" [ref=e3]`),
  });
});

test('should respect --snapshot-mode=incremental', async ({ startClient, server }) => {
  server.setContent('/', `<button>Button 1</button>`, 'text/html');

  const { client } = await startClient({
    args: ['--snapshot-mode=incremental'],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
- button "Button 1" [ref=e2]`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `async () => {
        const button2 = document.createElement('button');
        button2.textContent = 'Button 2';
        document.body.appendChild(button2);
      }`,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`
- <changed> generic [active] [ref=e1]:
  - ref=e2 [unchanged]
  - button \"Button 2\" [ref=e3]`),
  });
});

test('should respect --snapshot-mode=none', async ({ startClient, server }) => {
  server.setContent('/', `<button>Button 1</button>`, 'text/html');

  const { client } = await startClient({
    args: ['--snapshot-mode=none'],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    pageState: undefined
  });
});

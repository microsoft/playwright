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

const listPage = `
  <h1>Groceries</h1>
  <ul>
    <li>Apples</li>
    <li>Bananas</li>
    <li>Cherries</li>
  </ul>
  <button>Add to cart</button>
`;

test('browser_find by text', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({
    name: 'browser_find',
    arguments: { text: 'Bananas' },
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining(`Found 1 match for "Bananas":`),
  });
  // The 3-line context window includes the neighbouring list items.
  expect(response).toHaveResponse({
    result: expect.stringContaining('Apples'),
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining('Cherries'),
  });
});

const nestedPage = `
  <main>
    <section aria-label="Sidebar">
      <nav aria-label="Primary">
        <ul>
          <li><a href="/home">Home</a></li>
          <li><a href="/products">Products</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
          <li><a href="/careers">Careers</a></li>
          <li><a href="/target">Deep Target Link</a></li>
        </ul>
      </nav>
    </section>
  </main>
`;

test('browser_find shows the path from the root to the match', async ({ client, server }) => {
  server.setContent('/', nestedPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  const response = await client.callTool({
    name: 'browser_find',
    arguments: { text: 'Deep Target Link' },
  });

  // The ancestor path is prepended even though it is far above the 3-line
  // context window, so the matched node is shown in its place in the tree. The
  // jump from the path down to the context window is implied, so it is not
  // marked with an ellipsis.
  expect(response).toHaveResponse({
    result: expect.stringContaining(`Found 1 match for "Deep Target Link":

- main [ref=e2]:
  - region "Sidebar" [ref=e3]:
    - navigation "Primary" [ref=e4]:
      - list [ref=e5]:
        - listitem [ref=e14]:`),
  });
  expect(response).toHaveResponse({
    result: expect.stringContaining(`        - listitem [ref=e16]:
          - link "Deep Target Link" [ref=e17]`),
  });
  // The preceding sibling still appears as surrounding context.
  expect(response).toHaveResponse({
    result: expect.stringContaining('Careers'),
  });
});

const toolbarPage = `
  <main>
    <div role="group" aria-label="Toolbar">
      <button>One</button>
      <button>Two</button>
      <button>Three</button>
      <button>Four</button>
    </div>
    <div role="group" aria-label="Content">
      <button>Target Button</button>
    </div>
  </main>
`;

test('browser_find marks gaps within off-path context with an ellipsis', async ({ client, server }) => {
  server.setContent('/', toolbarPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  // The match sits under "Content"; the "Toolbar" group is off-path context
  // whose truncated buttons are marked with an ellipsis, while the path down to
  // the match stays unmarked.
  expect(await client.callTool({
    name: 'browser_find',
    arguments: { text: 'Target Button' },
  })).toHaveResponse({
    result: expect.stringContaining(`Found 1 match for "Target Button":

- main [ref=e2]:
  - group "Toolbar" [ref=e3]:
    ...
    - button "Three" [ref=e6]
    - button "Four" [ref=e7]
  - group "Content" [ref=e8]:
    - button "Target Button" [ref=e9]`),
  });
});

test('browser_find is case-insensitive for text', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { text: 'apples' },
  })).toHaveResponse({
    result: expect.stringContaining('Apples'),
  });
});

test('browser_find by regex', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { regex: 'Bananas|Cherries' },
  })).toHaveResponse({
    result: expect.stringContaining(`Found 2 matches for /Bananas|Cherries/:`),
  });
});

test('browser_find regex is case-sensitive by default', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { regex: 'apples' },
  })).toHaveResponse({
    result: `No matches found for /apples/.`,
  });
});

test('browser_find regex honors /i flag', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { regex: '/apples/i' },
  })).toHaveResponse({
    result: expect.stringContaining(`Found 1 match for /apples/i:`),
  });
});

test('browser_find reports no matches', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { text: 'Pineapples' },
  })).toHaveResponse({
    result: `No matches found for "Pineapples".`,
  });
});

test('browser_find requires text or regex', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: {},
  })).toHaveResponse({
    error: expect.stringContaining('Provide either "text" or "regex" to search for.'),
    isError: true,
  });
});

test('browser_find rejects both text and regex', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { text: 'Apples', regex: 'Apples' },
  })).toHaveResponse({
    error: expect.stringContaining('Provide only one of "text" or "regex", not both.'),
    isError: true,
  });
});

test('browser_find rejects invalid regex', async ({ client, server }) => {
  server.setContent('/', listPage, 'text/html');
  await client.callTool({ name: 'browser_navigate', arguments: { url: server.PREFIX } });

  expect(await client.callTool({
    name: 'browser_find',
    arguments: { regex: '(' },
  })).toHaveResponse({
    isError: true,
  });
});

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

import { test, expect } from './fixtures';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function createTab(client: Client, title: string, body: string) {
  await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'new',
    },
  });
  return await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `data:text/html,<title>${title}</title><body>${body}</body>`,
    },
  });
}

test('list initial tabs', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'list',
    },
  })).toHaveResponse({
    result: `- 0: (current) [](about:blank)`,
  });
});

test('list first tab', async ({ client }) => {
  await createTab(client, 'Tab one', 'Body one');
  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'list',
    },
  })).toHaveResponse({
    result: `- 0: [](about:blank)
- 1: (current) [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)`,
  });
});

test('create new tab', async ({ client }) => {
  expect(await createTab(client, 'Tab one', 'Body one')).toHaveResponse({
    tabs: `- 0: [](about:blank)
- 1: (current) [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)`,
    snapshot: `- generic [active] [ref=e1]: Body one`,
  });

  expect(await createTab(client, 'Tab two', 'Body two')).toHaveResponse({
    tabs: `- 0: [](about:blank)
- 1: [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)
- 2: (current) [Tab two](data:text/html,<title>Tab two</title><body>Body two</body>)`,
    snapshot: `- generic [active] [ref=e1]: Body two`,
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {},
  })).toHaveResponse({
    page: expect.stringContaining('Page URL: data:text/html,<title>Tab two</title><body>Body two</body>'),
  });
});

test('create new tab with url', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'new',
      url: `data:text/html,<title>Tab one</title><body>Body one</body>`,
    },
  })).toHaveResponse({
    result: `- 0: [](about:blank)
- 1: (current) [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)`,
  });
});

test('select tab', async ({ client }) => {
  await createTab(client, 'Tab one', 'Body one');
  await createTab(client, 'Tab two', 'Body two');

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'select',
      index: 1,
    },
  })).toHaveResponse({
    result: `- 0: [](about:blank)
- 1: (current) [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)
- 2: [Tab two](data:text/html,<title>Tab two</title><body>Body two</body>)`,
  });

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'select',
      index: 0,
    },
  })).toHaveResponse({
    result: `- 0: (current) [](about:blank)
- 1: [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)
- 2: [Tab two](data:text/html,<title>Tab two</title><body>Body two</body>)`,
  });
});

test('close tab', async ({ client }) => {
  await createTab(client, 'Tab one', 'Body one');
  await createTab(client, 'Tab two', 'Body two');

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'close',
      index: 2,
    },
  })).toHaveResponse({
    result: `- 0: [](about:blank)
- 1: (current) [Tab one](data:text/html,<title>Tab one</title><body>Body one</body>)`,
  });
});

test('reuse first tab when navigating', async ({ startClient, cdpServer, server }) => {
  const browserContext = await cdpServer.start();
  const pages = browserContext.pages();

  const { client } = await startClient({ args: [`--cdp-endpoint=${cdpServer.endpoint}`] });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(pages.length).toBe(1);
  expect(await pages[0].title()).toBe('Title');
});

test('create new tab in isolated context', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44199' },
}, async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: {
      browser: {
        contextOptions: { recordHar: { path: testInfo.outputPath('network.har') } },
      },
    },
  });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });
  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'new',
      url: server.HELLO_WORLD,
      isolatedContext: 'alice',
    },
  })).toHaveResponse({
    result: `- 0: [](${server.EMPTY_PAGE})
- 1: (current) [Title](${server.HELLO_WORLD}) [isolatedContext: alice]`,
    page: expect.stringContaining('- Isolated context: alice'),
  });

  await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX, isolatedContext: 'bob' },
  });
  expect(await client.callTool({ name: 'browser_close' })).toHaveResponse({
    result: 'No open tabs. Navigate to a URL to create one.',
  });

  for (const [file, url] of [
    ['network.har', server.EMPTY_PAGE],
    ['network-alice.har', server.HELLO_WORLD],
    ['network-bob.har', server.PREFIX + '/'],
  ]) {
    const har = JSON.parse(await fs.promises.readFile(testInfo.outputPath(file), 'utf-8'));
    expect(har.log.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ request: expect.objectContaining({ url }) }),
    ]));
  }
});

test('tabs in the same isolated context share storage', async ({ client, server }) => {
  const newTab = (isolatedContext?: string) => client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.EMPTY_PAGE, isolatedContext },
  });
  const selectTab = (index: number) => client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'select', index },
  });
  const setCookie = (value: string) => client.callTool({
    name: 'browser_evaluate',
    arguments: { function: `() => document.cookie = 'user=${value}'` },
  });
  const getCookie = () => client.callTool({
    name: 'browser_evaluate',
    arguments: { function: '() => document.cookie' },
  });

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.EMPTY_PAGE },
  });
  await setCookie('default');
  await newTab('alice');
  await setCookie('alice');
  await newTab('bob');
  await setCookie('bob');
  await newTab('alice');

  expect(await getCookie()).toHaveResponse({ result: `"user=alice"` });
  await selectTab(0);
  expect(await getCookie()).toHaveResponse({ result: `"user=default"` });
  await selectTab(2);
  expect(await getCookie()).toHaveResponse({ result: `"user=bob"` });
  await newTab('default');
  expect(await getCookie()).toHaveResponse({ result: `"user=default"` });
});

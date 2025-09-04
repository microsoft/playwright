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
    tabs: `- 0: (current) [] (about:blank)`,
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
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)`,
  });
});

test('create new tab', async ({ client }) => {
  expect(await createTab(client, 'Tab one', 'Body one')).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)`,
    pageState: expect.stringContaining(`- Page URL: data:text/html,<title>Tab one</title><body>Body one</body>
- Page Title: Tab one
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body one
\`\`\``),
  });

  expect(await createTab(client, 'Tab two', 'Body two')).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)
- 2: (current) [Tab two] (data:text/html,<title>Tab two</title><body>Body two</body>)`,
    pageState: expect.stringContaining(`- Page URL: data:text/html,<title>Tab two</title><body>Body two</body>
- Page Title: Tab two
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body two
\`\`\``),
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
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)
- 2: [Tab two] (data:text/html,<title>Tab two</title><body>Body two</body>)`,
    pageState: expect.stringContaining(`- Page URL: data:text/html,<title>Tab one</title><body>Body one</body>
- Page Title: Tab one
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body one
\`\`\``),
  });

  expect(await client.callTool({
    name: 'browser_tabs',
    arguments: {
      action: 'select',
      index: 0,
    },
  })).toHaveResponse({
    tabs: `- 0: (current) [] (about:blank)
- 1: [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)
- 2: [Tab two] (data:text/html,<title>Tab two</title><body>Body two</body>)`,
    pageState: expect.stringContaining(`- Page URL: about:blank`),
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
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (data:text/html,<title>Tab one</title><body>Body one</body>)`,
    pageState: expect.stringContaining(`- Page URL: data:text/html,<title>Tab one</title><body>Body one</body>
- Page Title: Tab one
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body one
\`\`\``),
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

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

import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { test, expect } from './fixtures';

test('browser_navigate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: `await page.goto('${server.HELLO_WORLD}');`,
    page: `- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`,
    snapshot: `- generic [active] [ref=e1]: Hello, world!`,
  });
});

test('browser_navigate blocks file:// URLs by default', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: 'file:///etc/passwd' },
  })).toHaveResponse({
    error: expect.stringContaining('Error: Access to "file:" protocol is blocked. Attempted URL: "file:///etc/passwd"'),
    isError: true,
  });
});

test('browser_navigate allows about:, data: and javascript: protocols', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: 'about:blank' },
  })).toHaveResponse({
    code: `await page.goto('about:blank');`,
    page: `- Page URL: about:blank`,
    snapshot: ``,
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: 'data:text/html,<h1>Hello</h1>' },
  })).toHaveResponse({
    code: `await page.goto('data:text/html,<h1>Hello</h1>');`,
    page: expect.stringContaining(`- Page URL: data:text/html,<h1>Hello</h1>`),
    snapshot: `- heading \"Hello\" [level=1] [ref=e2]`,
  });
});

test('browser_navigate can navigate to file:// URLs allowUnrestrictedFileAccess is true', async ({ startClient }, testInfo) => {
  const rootDir = testInfo.outputPath();
  const fileOutsideRoot = testInfo.outputPath('test.txt');
  await fs.writeFile(fileOutsideRoot, 'Test file content');
  const { client } = await startClient({
    config: {
      allowUnrestrictedFileAccess: true,
    },
    roots: [
      {
        name: 'workspace',
        uri: pathToFileURL(rootDir).href,
      }
    ],
  });

  const url = pathToFileURL(fileOutsideRoot).href;
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url },
  })).toHaveResponse({
    page: expect.stringContaining(`- Page URL: ${url}`),
    snapshot: `- generic [ref=e2]: Test file content`,
  });
});

test('browser_select_option', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <select>
      <option value="foo">Foo</option>
      <option value="bar">Bar</option>
    </select>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      target: 'e2',
      values: ['bar'],
    },
  })).toHaveResponse({
    snapshot: `- combobox [ref=e2]:
  - option "Foo"
  - option "Bar" [selected]`,
  });
});

test('browser_select_option (multiple)', async ({ client, server }) => {
  server.setContent('/', `
    <title>Title</title>
    <select multiple>
      <option value="foo">Foo</option>
      <option value="bar">Bar</option>
      <option value="baz">Baz</option>
    </select>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_select_option',
    arguments: {
      element: 'Select',
      target: 'e2',
      values: ['bar', 'baz'],
    },
  })).toHaveResponse({
    code: `await page.getByRole('listbox').selectOption(['bar', 'baz']);`,
    snapshot: `- listbox [ref=e2]:
  - option "Foo" [ref=e3]
  - option "Bar" [selected] [ref=e4]
  - option "Baz" [selected] [ref=e5]`,
  });
});

test('browser_resize', async ({ client, server }) => {
  server.setContent('/', `
    <title>Resize Test</title>
    <body>
      <div id="size">Waiting for resize...</div>
      <script>new ResizeObserver(() => { document.getElementById("size").textContent = \`Window size: \${window.innerWidth}x\${window.innerHeight}\`; }).observe(document.body);
      </script>
    </body>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const response = await client.callTool({
    name: 'browser_resize',
    arguments: {
      width: 390,
      height: 780,
    },
  });
  expect(response).toHaveResponse({
    code: `await page.setViewportSize({ width: 390, height: 780 });`,
  });
  await expect.poll(() => client.callTool({ name: 'browser_snapshot' })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Window size: 390x780`),
  });
});

test('old locator error message', async ({ client, server }) => {
  server.setContent('/', `
    <button>Button 1</button>
    <button>Button 2</button>
    <script>
      document.querySelector('button').addEventListener('click', () => {
        document.querySelectorAll('button')[1].remove();
      });
    </script>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`
  - button "Button 1" [ref=e2]
  - button "Button 2" [ref=e3]`),
  });

  await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 1',
      target: 'e2',
    },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Button 2',
      target: 'e3',
    },
  })).toHaveResponse({
    error: expect.stringContaining(`Ref e3 not found in the current page snapshot. Try capturing new snapshot.`),
    isError: true,
  });
});

test('visibility: hidden > visible should be shown', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/535' } }, async ({ client, server }) => {
  server.setContent('/', `
    <div style="visibility: hidden;">
      <div style="visibility: visible;">
        <button>Button</button>
      </div>
    </div>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_snapshot'
  })).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`- button "Button"`),
  });
});

test('snapshot depth', async ({ client, server }) => {
  server.setContent('/', `
    <ul>
      <li>text</li>
      <li>
        <button>Button</button>
      </li>
    </ul>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      depth: 1,
    }
  })).toHaveResponse({
    inlineSnapshot: `- list [ref=e2]:
  - listitem [ref=e3]: text
  - listitem [ref=e4]`,
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      depth: 2,
    }
  })).toHaveResponse({
    inlineSnapshot: `- list [ref=e2]:
  - listitem [ref=e3]: text
  - listitem [ref=e4]:
    - button "Button" [ref=e5]`,
  });
});

test('snapshot by ref', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-cli/issues/347' } }, async ({ client, server }) => {
  server.setContent('/', `
    <ul>
      <li>text</li>
      <li>
        <button>Button</button>
      </li>
    </ul>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      target: 'e2',
    }
  })).toHaveResponse({
    inlineSnapshot: `- list [ref=e2]:
  - listitem [ref=e3]: text
  - listitem [ref=e4]:
    - button "Button" [ref=e5]`,
  });

  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      target: 'e999',
    }
  })).toHaveResponse({
    error: expect.stringContaining(`Ref e999 not found in the current page snapshot. Try capturing new snapshot.`),
    isError: true,
  });
});

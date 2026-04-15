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

test('browser_evaluate', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    page: expect.stringContaining(`- Page Title: Title`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => document.title',
    },
  })).toHaveResponse({
    result: `"Title"`,
    code: `await page.evaluate('() => document.title');`,
  });
});

test('browser_evaluate (element)', async ({ client, server }) => {
  server.setContent('/', `
    <body style="background-color: red">Hello, world!</body>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: 'element => element.style.backgroundColor',
      element: 'body',
      target: 'e1',
    },
  })).toHaveResponse({
    result: `"red"`,
    code: `await page.getByText('Hello, world!').evaluate('element => element.style.backgroundColor');`,
  });
});

test('browser_evaluate object', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    page: expect.stringContaining(`- Page Title: Title`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => ({ title: document.title, url: document.URL })',
    },
  })).toHaveResponse({
    result: JSON.stringify({ title: 'Title', url: server.HELLO_WORLD }, null, 2),
    code: `await page.evaluate('() => ({ title: document.title, url: document.URL })');`,
  });
});

test('browser_evaluate expression', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    page: expect.stringContaining(`- Page Title: Title`),
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '(1+1)',
    },
  })).toHaveResponse({
    result: `2`,
    code: `await page.evaluate('() => ((1+1))');`,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '[1,2,3].map(x => x*2)',
    },
  })).toHaveResponse({
    result: `[\n  2,\n  4,\n  6\n]`,
    code: `await page.evaluate('() => ([1,2,3].map(x => x*2))');`,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: 'function foo() { return 1; }',
    },
  })).toHaveResponse({
    result: `1`,
    code: `await page.evaluate('function foo() { return 1; }');`,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: 'async () => 42',
    },
  })).toHaveResponse({
    result: `42`,
    code: `await page.evaluate('async () => 42');`,
  });

  expect(await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: 'Promise.resolve(42)',
    },
  })).toHaveResponse({
    result: `42`,
    code: `await page.evaluate('() => (Promise.resolve(42))');`,
  });
});

test('browser_evaluate (error)', async ({ client, server }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    page: expect.stringContaining(`- Page Title: Title`),
  });

  const result = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: '() => nonExistentVariable',
    },
  });

  expect(result.isError).toBe(true);
  expect(result.content?.[0]?.text).toContain('nonExistentVariable');
  // Check for common error patterns across browsers
  const errorText = result.content?.[0]?.text || '';
  expect(errorText).toMatch(/not defined|Can't find variable/);
});

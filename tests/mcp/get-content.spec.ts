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

test('browser_get_content basic', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Hello World</h1>
        <p>This is a test page</p>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {},
  });

  expect(result.content?.[0]?.text).toContain('Hello World');
  expect(result.content?.[0]?.text).toContain('This is a test page');
});

test('browser_get_content with selector', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div id="main">
          <h1>Main Content</h1>
        </div>
        <div id="sidebar">
          <h1>Sidebar</h1>
        </div>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      selector: '#main',
    },
  });

  expect(result.content?.[0]?.text).toContain('Main Content');
  expect(result.content?.[0]?.text).not.toContain('Sidebar');
});

test('browser_get_content with links', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <p>Check out <a href="https://example.com">Example</a> for more info.</p>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'markdown',
    },
  });

  expect(result.content?.[0]?.text).toContain('[Example](https://example.com)');
});

test('browser_get_content without links', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <p>Check out <a href="https://example.com">Example</a> for more info.</p>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'markdown',
      includeLinks: false,
    },
  });

  expect(result.content?.[0]?.text).not.toContain('[Example]');
  expect(result.content?.[0]?.text).toContain('Example');
});

test('browser_get_content text format', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Title</h1>
        <p>Paragraph 1</p>
        <p>Paragraph 2</p>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'text',
    },
  });

  expect(result.content?.[0]?.text).toContain('Title');
  expect(result.content?.[0]?.text).toContain('Paragraph 1');
  expect(result.content?.[0]?.text).toContain('Paragraph 2');
});

test('browser_get_content html format', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div class="content">
          <p>HTML content</p>
        </div>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'html',
    },
  });

  expect(result.content?.[0]?.text).toContain('<div class="content">');
  expect(result.content?.[0]?.text).toContain('<p>HTML content</p>');
});

test('browser_get_content invalid selector', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Hello</h1>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      selector: '#nonexistent',
    },
  });

  expect(result.isError).toBe(true);
  expect(result.content?.[0]?.text).toContain('No element found matching selector');
});

test('browser_get_content with list items', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'markdown',
    },
  });

  expect(result.content?.[0]?.text).toContain('Item 1');
  expect(result.content?.[0]?.text).toContain('Item 2');
  expect(result.content?.[0]?.text).toContain('Item 3');
});

test('browser_get_content with headings', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <h1>Main Title</h1>
        <h2>Subtitle</h2>
        <p>Content</p>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'markdown',
    },
  });

  expect(result.content?.[0]?.text).toContain('# Main Title');
  expect(result.content?.[0]?.text).toContain('## Subtitle');
});

test('browser_get_content skip scripts and styles', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <head>
        <style>.hidden { display: none; }</style>
      </head>
      <body>
        <h1>Visible Content</h1>
        <script>console.log('hidden');</script>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {},
  });

  expect(result.content?.[0]?.text).toContain('Visible Content');
  expect(result.content?.[0]?.text).not.toContain('display: none');
  expect(result.content?.[0]?.text).not.toContain('console.log');
});

test('browser_get_content empty page', async ({ client, server }) => {
  server.setContent('/', `<html><body></body></html>`, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {},
  });

  // Should not error, just return empty content
  expect(result.isError).toBe(false);
});

test('browser_get_content multiple links', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <p>Visit <a href="/page1">Page 1</a> or <a href="/page2">Page 2</a></p>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'markdown',
    },
  });

  expect(result.content?.[0]?.text).toContain('[Page 1](/page1)');
  expect(result.content?.[0]?.text).toContain('[Page 2](/page2)');
});

test('browser_get_content with nested elements', async ({ client, server }) => {
  server.setContent('/', `
    <html>
      <body>
        <div>
          <p>Nested <strong>bold</strong> text</p>
        </div>
      </body>
    </html>
  `, 'text/html');
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_get_content',
    arguments: {
      format: 'text',
    },
  });

  expect(result.content?.[0]?.text).toContain('Nested bold text');
});

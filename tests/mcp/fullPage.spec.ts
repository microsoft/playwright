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

test('browser_full_page (basic)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `
    <title>Test Page</title>
    <body>
      <h1>Welcome</h1>
      <p>This is a <strong>test</strong> page.</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    </body>
  `, 'text/html');

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('${server.PREFIX}')`),
  });

  const result = await client.callTool({
    name: 'browser_full_page',
    arguments: {},
  });

  // Should contain markdown formatted content
  expect(result.content?.[0]?.text).toContain('# Welcome');
  expect(result.content?.[0]?.text).toContain('**test**');
  expect(result.content?.[0]?.text).toContain('- Item 1');
  expect(result.content?.[0]?.text).toContain('- Item 2');

  // Should contain Playwright code for scrolling
  expect(result.content?.[0]?.text).toContain('await page.waitForLoadState');
  expect(result.content?.[0]?.text).toContain('window.scrollTo');
  expect(result.content?.[0]?.text).toContain('await page.content()');

  // Should NOT contain aria snapshot refs
  expect(result.content?.[0]?.text).not.toContain('[ref=');
});

test('browser_full_page (long page with scrolling)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  // Create a page with enough content to require scrolling
  const longContent = Array.from({ length: 50 }, (_, i) =>
    `<div style="height: 100px; background: ${i % 2 === 0 ? '#f0f0f0' : '#e0e0e0'}">Item ${i + 1}</div>`
  ).join('');

  server.setContent('/', `
    <title>Long Page</title>
    <body>
      <h1>Long Content</h1>
      ${longContent}
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_full_page',
    arguments: {},
  });

  // Should contain all items
  for (let i = 1; i <= 50; i++) {
    expect(result.content?.[0]?.text).toContain(`Item ${i}`);
  }

  // Should contain the scrolling code
  expect(result.content?.[0]?.text).toContain('scrolled');
});

test('browser_full_page (empty page)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `<html><head><title>Empty</title></head><body></body></html>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_full_page',
    arguments: {},
  });

  // Should still work with empty content
  expect(result.content?.[0]?.text).toBeTruthy();
  expect(result.content?.[0]?.text).toContain('Empty');
  expect(result.content?.[0]?.text).toContain('await page.waitForLoadState');
});

test('browser_full_page (with images and links)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `
    <title>Rich Content</title>
    <body>
      <h1>Rich Page</h1>
      <p>Here is an <a href="/other">link</a>.</p>
      <img src="image.png" alt="An image" />
      <p>Some text with <em>emphasis</em>.</p>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_full_page',
    arguments: {},
  });

  // Should contain markdown for links and images
  expect(result.content?.[0]?.text).toContain('[link]');
  expect(result.content?.[0]?.text).toContain('![');
  expect(result.content?.[0]?.text).toContain('*emphasis*');
});

test('browser_full_page (nested elements)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `
    <title>Nested</title>
    <body>
      <div>
        <section>
          <h2>Section 1</h2>
          <div>
            <p>Paragraph in nested div</p>
          </div>
        </section>
        <article>
          <h3>Article</h3>
          <ul>
            <li><strong>Bold</strong> item</li>
          </ul>
        </article>
      </div>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_full_page',
    arguments: {},
  });

  // Should preserve structure
  expect(result.content?.[0]?.text).toContain('## Section 1');
  expect(result.content?.[0]?.text).toContain('### Article');
  expect(result.content?.[0]?.text).toContain('**Bold**');
  expect(result.content?.[0]?.text).toContain('Paragraph in nested div');
});

test('browser_full_page (code block in response)', async ({ startClient, server }, testInfo) => {
  const { client } = await startClient({
    config: { outputDir: testInfo.outputPath('output') },
  });

  server.setContent('/', `
    <title>Code Test</title>
    <body><p>Simple page</p></body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_full_page',
    arguments: {},
  });

  // The response should contain the markdown content
  const text = result.content?.[0]?.text ?? '';

  // Should have the page content
  expect(text).toContain('Simple page');

  // Should have the Playwright code for scrolling
  expect(text).toContain('await page.waitForLoadState');
  expect(text).toContain('window.scrollTo');
  expect(text).toContain('await page.content()');
});

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

test.describe('unicode serialization', () => {
  // Use --no-sandbox for running as root in CI environments
  test.use({ mcpArgs: ['--no-sandbox'] });

  test('handles lone high surrogate in page content', async ({ client, server }) => {
  // Create a page with a lone high surrogate (0xD800)
  // This would normally cause JSON serialization to fail
    await server.setRoute('/malformed.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<html><body>Text with ${String.fromCharCode(0xD800)} lone surrogate</body></html>`);
    });

    // The key test: this should not throw a JSON serialization error
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + '/malformed.html' },
    });

    // Should have successfully navigated without JSON serialization error
    expect(result.content[0].text).toContain('Page URL:');
    expect(result.content[0].text).toContain('lone surrogate');
  });

  test('handles lone low surrogate in page content', async ({ client, server }) => {
  // Create a page with a lone low surrogate (0xDC00)
    await server.setRoute('/malformed2.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<html><body>Text with ${String.fromCharCode(0xDC00)} lone low surrogate</body></html>`);
    });

    // Should not throw JSON serialization error
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + '/malformed2.html' },
    });

    expect(result.content[0].text).toContain('Page URL:');
    expect(result.content[0].text).toContain('lone low');
  });

  test('preserves valid surrogate pairs (emoji)', async ({ client, server }) => {
  // Test with valid emoji: 💀 (U+1F480) = high surrogate 0xD83D + low surrogate 0xDC80
    await server.setRoute('/valid.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<html><body>Valid emoji: 💀 skull</body></html>`);
    });

    // Should not throw JSON serialization error and preserve emoji content
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + '/valid.html' },
    });

    expect(result.content[0].text).toContain('Page URL:');
    expect(result.content[0].text).toContain('emoji');
    expect(result.content[0].text).toContain('skull');
  });

  test('handles CJK mixed content with malformed unicode', async ({ client, server }) => {
  // Test with mixed CJK content and a lone surrogate
    await server.setRoute('/mixed.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      const html = `<html><body>
      <h1>日本語</h1>
      <p>中文 ${String.fromCharCode(0xD800)} mixed</p>
      <p>한국어</p>
      <p>Emoji: 😀</p>
    </body></html>`;
      res.end(html);
    });

    // Should not throw JSON serialization error with mixed content
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + '/mixed.html' },
    });

    const text = result.content[0].text;
    // Should successfully handle mixed CJK content without JSON serialization error
    expect(text).toContain('Page URL:');
    expect(text).toContain('mixed');
  });

  test('handles multiple consecutive lone surrogates', async ({ client, server }) => {
  // Test with multiple consecutive lone surrogates
    await server.setRoute('/multiple.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<html><body>Before ${String.fromCharCode(0xD800)}${String.fromCharCode(0xDC00)} middle</body></html>`);
    });

    // Should not throw JSON serialization error
    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + '/multiple.html' },
    });

    const text = result.content[0].text;
    expect(text).toContain('Page URL:');
    expect(text).toContain('Before');
    expect(text).toContain('middle');
  });

  test('handles lone surrogates in console messages', async ({ startClient, server }) => {
  // Test that console messages with lone surrogates are also sanitized
    await server.setRoute('/console.html', (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<html><body><script>console.log('Message with ${String.fromCharCode(0xD800)} surrogate');</script></body></html>`);
    });

    const { client } = await startClient({
      args: ['--console-level=debug'],
    });

    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX + '/console.html' },
    });

    // Console messages should also be sanitized
    const text = result.content[0].text;
    // Should not throw JSON serialization error
    expect(text).toBeDefined();
  });
});

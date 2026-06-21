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

// Generate HTML with N identical list items.
function repeatedListHtml(count: number): string {
  const items = Array.from({ length: count }, (_, i) => `<li>Item ${i + 1}</li>`).join('');
  return `<ul>${items}</ul>`;
}

test('compress: true collapses repeated list items', async ({ client, server }) => {
  server.setContent('/', repeatedListHtml(150), 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_snapshot',
    arguments: { compress: true },
  });

  expect(result).toHaveResponse({
    // First KEEP_N items are present.
    inlineSnapshot: expect.stringContaining('Item 1'),
  });
  expect(result).toHaveResponse({
    inlineSnapshot: expect.stringContaining('Item 10'),
  });

  // Items beyond KEEP_N are collapsed.
  expect(result).not.toHaveResponse({
    inlineSnapshot: expect.stringContaining('Item 50'),
  });
  expect(result).not.toHaveResponse({
    inlineSnapshot: expect.stringContaining('Item 150'),
  });

  // Compression note is emitted.
  expect(result).toHaveResponse({
    inlineSnapshot: expect.stringContaining('playwright-compress:'),
  });
});

test('compress: false returns full snapshot', async ({ client, server }) => {
  server.setContent('/', repeatedListHtml(150), 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_snapshot',
    arguments: { compress: false },
  });

  // All items present when compression is off.
  expect(result).toHaveResponse({
    inlineSnapshot: expect.stringContaining('Item 150'),
  });
  expect(result).not.toHaveResponse({
    inlineSnapshot: expect.stringContaining('playwright-compress:'),
  });
});

test('compress: true does not fire on small lists', async ({ client, server }) => {
  // 50 items — below the FIRE_THRESHOLD of 100.
  server.setContent('/', repeatedListHtml(50), 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_snapshot',
    arguments: { compress: true },
  });

  // All 50 items visible — safety gate prevents over-compression.
  expect(result).toHaveResponse({
    inlineSnapshot: expect.stringContaining('Item 50'),
  });
  expect(result).not.toHaveResponse({
    inlineSnapshot: expect.stringContaining('playwright-compress:'),
  });
});

test('compress: true keeps interactive elements', async ({ client, server }) => {
  // 150 buttons — they carry distinct interactive meaning and are always kept.
  const buttons = Array.from({ length: 150 }, (_, i) => `<button>Action ${i + 1}</button>`).join('');
  server.setContent('/', `<main>${buttons}</main>`, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const result = await client.callTool({
    name: 'browser_snapshot',
    arguments: { compress: true },
  });

  // Buttons are interactive — even repeated ones are preserved.
  expect(result).toHaveResponse({
    inlineSnapshot: expect.stringContaining('Action 150'),
  });
  expect(result).not.toHaveResponse({
    inlineSnapshot: expect.stringContaining('playwright-compress:'),
  });
});

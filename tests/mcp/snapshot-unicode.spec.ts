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

test('should handle lone high surrogate in snapshot', async ({ client, server }) => {
  server.setContent('/', `
    <div id="container"></div>
    <script>
      const container = document.getElementById('container');
      // Insert lone high surrogate (U+D800)
      container.textContent = 'before' + String.fromCharCode(0xD800) + 'after';
    </script>
  `, 'text/html');

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  expect(response).toHaveResponse({
    snapshot: expect.any(String),
  });

  // Lone surrogates should be replaced with U+FFFD (replacement character)
  expect(response.content[0].text).toContain('\uFFFD');
});

test('should handle lone low surrogate in snapshot', async ({ client, server }) => {
  server.setContent('/', `
    <div id="container"></div>
    <script>
      const container = document.getElementById('container');
      // Insert lone low surrogate (U+DC00)
      container.textContent = 'before' + String.fromCharCode(0xDC00) + 'after';
    </script>
  `, 'text/html');

  const response = await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  });

  expect(response).toHaveResponse({
    snapshot: expect.any(String),
  });

  // Lone surrogates should be replaced with U+FFFD
  expect(response.content[0].text).toContain('\uFFFD');
});

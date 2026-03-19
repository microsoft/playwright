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
  test.use({ mcpArgs: ['--no-sandbox'] });

  test('handles lone surrogates in page content', async ({ client, server }) => {
    server.setContent('/', `Text with ${String.fromCharCode(0xD800)} lone surrogate`, 'text/html');

    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    expect(result.content[0].text).toContain('Page URL:');
  });

  test('handles console messages with lone surrogates', async ({ startClient, server }) => {
    server.setContent('/', `<script>console.log('msg ${String.fromCharCode(0xD800)} surrog')</script>`, 'text/html');

    const { client } = await startClient({ args: ['--console-level=debug'] });

    const result = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.PREFIX },
    });

    expect(result.content[0].text).toBeDefined();
  });
});

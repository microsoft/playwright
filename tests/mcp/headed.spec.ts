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

for (const mcpHeadless of [false, true]) {
  test.describe(`mcpHeadless: ${mcpHeadless}`, () => {
    test.use({ mcpHeadless });
    test.skip(process.platform === 'linux', 'Auto-detection wont let this test run on linux');

    test('browser', async ({ client, server, mcpBrowser }) => {
      test.skip(!['chrome', 'msedge', 'chromium'].includes(mcpBrowser ?? ''), 'Only chrome is supported for this test');
      server.setRoute('/', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <body></body>
          <script>
            document.body.textContent = navigator.userAgent;
          </script>
        `);
      });

      const response = await client.callTool({
        name: 'browser_navigate',
        arguments: {
          url: server.PREFIX,
        },
      });

      expect(response).toHaveResponse({
        snapshot: (mcpHeadless ? expect : expect.not).stringContaining(`HeadlessChrome`),
      });
    });
  });
}

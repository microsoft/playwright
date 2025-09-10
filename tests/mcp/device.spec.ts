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

test('--device should work', async ({ startClient, server }) => {
  const { client } = await startClient({
    args: ['--device', 'iPhone 15'],
  });

  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
      </head>
      <body></body>
      <script>
        document.body.textContent = window.innerWidth + "x" + window.innerHeight;
      </script>
    `);
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`393x659`),
  });
});

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

const viewportProbe = `
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body></body>
  <script>
    document.body.textContent = window.innerWidth + "x" + window.innerHeight;
  </script>
`;

test('--device should work', async ({ startClient, server }) => {
  const { client } = await startClient({
    args: ['--device', 'iPhone 15'],
  });

  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(viewportProbe);
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`393x659`),
  });
});

test('--mobile emulates a mobile viewport', async ({ startClient, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'firefox', '--mobile is not supported with Firefox.');

  const { client } = await startClient({
    args: ['--mobile'],
  });

  server.setRoute('/', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(viewportProbe);
  });

  // Pixel 10 for Chromium, iPhone 17 for WebKit — both are narrow mobile
  // viewports, so assert the width rather than an exact model dimension.
  const width = mcpBrowser === 'webkit' ? '402x' : '360x';
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: server.PREFIX,
    },
  })).toHaveResponse({
    snapshot: expect.stringContaining(width),
  });
});

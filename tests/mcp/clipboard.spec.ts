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

test('clipboard write without permission dialog', async ({ startClient, server, mcpBrowser }) => {
  test.skip(mcpBrowser === 'firefox' || mcpBrowser === 'webkit', 'Clipboard permissions are fully supported only in Chromium');
  const { client } = await startClient({
    args: [`--grant-permissions=clipboard-read,clipboard-write`]
  });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  const writeResult = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => navigator.clipboard.writeText('Hello from Playwright!').then(
          () => 'Write successful',
          e => 'Write failed: ' + e.message)`,
    },
  });
  expect(writeResult).toHaveResponse({
    result: '"Write successful"',
  });
  const readResult = await client.callTool({
    name: 'browser_evaluate',
    arguments: {
      function: `() => navigator.clipboard.readText()`,
    },
  });
  expect(readResult).toHaveResponse({
    result: '"Hello from Playwright!"',
  });
});

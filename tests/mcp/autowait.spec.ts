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

test('racy navigation destroys context', async ({ client, server, mcpBrowser }) => {
  server.setContent('/', `
    <button onclick='setTimeout(() => window.location = "about:blank", 100)'>Submit</button>
  `, 'text/html');

  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'Submit button',
      ref: 'e2',
    },
  })).toHaveResponse({
    code: `await page.getByRole('button', { name: 'Submit' }).click();`,
    pageState: expect.stringContaining(`- Page URL: about:blank`),
  });
});

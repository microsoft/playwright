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

test('stitched aria frames', async ({ client }) => {
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: {
      url: `data:text/html,<h1>Hello</h1><iframe src="data:text/html,<button>World</button><main><iframe src='data:text/html,<p>Nested</p>'></iframe></main>"></iframe><iframe src="data:text/html,<h1>Should be invisible</h1>" style="display: none;"></iframe>`,
    },
  })).toHaveResponse({
    pageState: expect.stringContaining(`- generic [active] [ref=e1]:
  - heading "Hello" [level=1] [ref=e2]
  - iframe [ref=e3]:
    - generic [active] [ref=f1e1]:
      - button "World" [ref=f1e2]
      - main [ref=f1e3]:
        - iframe [ref=f1e4]:
          - paragraph [ref=f2e2]: Nested
\`\`\``),
  });

  expect(await client.callTool({
    name: 'browser_click',
    arguments: {
      element: 'World',
      ref: 'f1e2',
    },
  })).toHaveResponse({
    code: `await page.locator('iframe').first().contentFrame().getByRole('button', { name: 'World' }).click();`,
  });
});

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

import { test, expect, writeFiles } from './fixtures';

test.use({ mcpServerType: 'test-mcp' });

test('test_list', async ({ startClient }) => {
  await writeFiles({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo' }, {}] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  });

  const { client } = await startClient();
  expect(await client.callTool({
    name: 'test_list',
    arguments: {},
  })).toHaveTextResponse(`Listing tests:
  [id=<ID>] [project=foo] › a.test.ts:3:11 › example1
  [id=<ID>] [project=foo] › a.test.ts:6:11 › example2
  [id=<ID>] a.test.ts:3:11 › example1
  [id=<ID>] a.test.ts:6:11 › example2
Total: 4 tests in 1 file`);
});

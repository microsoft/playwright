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

import fs from 'fs';

import { test, expect } from './fixtures';

test('--init-page', async ({ startClient }) => {
  const initPagePath = test.info().outputPath('aa.ts');
  await fs.promises.writeFile(initPagePath, `
    export default async ({ page }) => {
      await page.setContent('<div>Hello world</div>');
    };
  `);
  const { client } = await startClient({
    args: [`--init-page=${initPagePath}`],
  });
  expect(await client.callTool({
    name: 'browser_snapshot',
    arguments: { url: 'about:blank' },
  })).toHaveResponse({
    pageState: expect.stringContaining('Hello world'),
  });
});

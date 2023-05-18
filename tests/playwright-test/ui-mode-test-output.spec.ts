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

import { test, expect, retries } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test('should print load errors', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('syntax error', () => {
        await 1;
      });
    `,
  });
  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText(`Unexpected reserved word 'await'`);
});

test('should work after theme switch', async ({ runUITest, writeFiles }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('syntax error', async () => {
        console.log('Hello world 1');
      });
    `,
  });
  await page.getByTitle('Toggle output').click();
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('output')).toContainText(`Hello world 1`);

  await page.getByTitle('Toggle color mode').click();
  writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('syntax error', async () => {
        console.log('Hello world 2');
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('output')).toContainText(`Hello world 2`);
});

test('should print buffers', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      import { PassThrough } from 'stream';
      test('print', () => {
        const writable = new PassThrough();
        writable.pipe(process.stdout);
        const red = Buffer.from('G1szMW1IRUxMTxtbMzlt', 'base64');
        writable.write(red);
      });
    `,
  });
  await page.getByTitle('Toggle output').click();
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('output')).toContainText('HELLO');
});

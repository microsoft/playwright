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

test('should contain text attachment', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('attach test', async () => {
        // Attach two files with the same content and different names,
        // to make sure each is downloaded with an intended name.
        await test.info().attach('file attachment', { path: __filename });
        await test.info().attach('file attachment 2', { path: __filename });
        await test.info().attach('text attachment', { body: 'hi tester!', contentType: 'text/plain' });
      });
    `,
  });
  await page.getByText('attach test').click();
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.getByText('Attachments').click();

  await page.locator('.tab-attachments').getByText('text attachment').click();
  await expect(page.locator('.tab-attachments')).toContainText('hi tester!');
  await page.locator('.tab-attachments').getByText('file attachment').first().click();
  await expect(page.locator('.tab-attachments')).not.toContainText('attach test');

  {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'download' }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('file attachment');
    expect((await readAllFromStream(await download.createReadStream())).toString()).toContain('attach test');
  }

  {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'download' }).nth(1).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('file attachment 2');
    expect((await readAllFromStream(await download.createReadStream())).toString()).toContain('attach test');
  }
});

test('should contain binary attachment', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('attach test', async () => {
        await test.info().attach('data', { body: Buffer.from([1, 2, 3]), contentType: 'application/octet-stream' });
      });
    `,
  });
  await page.getByText('attach test').click();
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.getByText('Attachments').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('data');
  expect(await readAllFromStream(await download.createReadStream())).toEqual(Buffer.from([1, 2, 3]));
});

test('should contain string attachment', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('attach test', async () => {
        await test.info().attach('note', { body: 'text42' });
      });
    `,
  });
  await page.getByText('attach test').click();
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.getByText('Attachments').click();
  await page.getByText('attach "note"', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.expandable-title', { hasText: 'note' }).getByRole('link').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('note');
  expect((await readAllFromStream(await download.createReadStream())).toString()).toEqual('text42');
});

test('should linkify string attachments', async ({ runUITest, server }) => {
  server.setRoute('/one.html', (req, res) => res.end());
  server.setRoute('/two.html', (req, res) => res.end());
  server.setRoute('/three.html', (req, res) => res.end());

  const { page } = await runUITest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('attach test', async () => {
        await test.info().attach('Inline url: ${server.PREFIX + '/one.html'}');
        await test.info().attach('Second', { body: 'Inline link ${server.PREFIX + '/two.html'} to be highlighted.' });
        await test.info().attach('Third', { body: '[markdown link](${server.PREFIX + '/three.html'})', contentType: 'text/markdown' });
      });
    `,
  });
  await page.getByText('attach test').click();
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.getByText('Attachments').click();

  const attachmentsPane = page.locator('.attachments-tab');

  {
    const url = server.PREFIX + '/one.html';
    const promise = page.waitForEvent('popup');
    await attachmentsPane.getByText(url).click();
    const popup = await promise;
    await expect(popup).toHaveURL(url);
  }

  {
    await attachmentsPane.getByText('Second download').click();
    const url = server.PREFIX + '/two.html';
    const promise = page.waitForEvent('popup');
    await attachmentsPane.getByText(url).click();
    const popup = await promise;
    await expect(popup).toHaveURL(url);
  }

  {
    await attachmentsPane.getByText('Third download').click();
    const url = server.PREFIX + '/three.html';
    const promise = page.waitForEvent('popup');
    await attachmentsPane.getByText('[markdown link]').click();
    const popup = await promise;
    await expect(popup).toHaveURL(url);
  }
});

function readAllFromStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

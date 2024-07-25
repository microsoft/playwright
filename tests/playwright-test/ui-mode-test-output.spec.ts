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
import path from 'path';

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

  await page.getByText('Settings', { exact: true }).click();
  await page.getByLabel('Dark mode').click();
  await writeFiles({
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

test('should show console messages for test', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('print', async ({ page }) => {
        await page.evaluate(() => console.log('page message'));
        console.log('node message');
        await page.evaluate(() => console.error('page error'));
        console.error('node error');
        console.log('Colors: \x1b[31mRED\x1b[0m \x1b[32mGREEN\x1b[0m');
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await page.getByText('Console').click();
  await page.getByText('print').click();

  await expect(page.locator('.console-tab .console-line-message')).toHaveText([
    'page message',
    'node message',
    'page error',
    'node error',
    'Colors: RED GREEN',
  ]);

  await expect(page.locator('.console-tab .list-view-entry .codicon')).toHaveClass([
    'codicon codicon-browser status-none',
    'codicon codicon-file status-none',
    'codicon codicon-browser status-error',
    'codicon codicon-file status-error',
    'codicon codicon-file status-none',
  ]);

  await expect.soft(page.getByText('RED', { exact: true })).toHaveCSS('color', 'rgb(205, 49, 49)');
  await expect.soft(page.getByText('GREEN', { exact: true })).toHaveCSS('color', 'rgb(0, 188, 0)');
});

test('should format console messages in page', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('print', async ({ page }) => {
        await page.evaluate(async () => {
          console.log('Object %O', { a: 1 });
          console.log('Date %o', new Date());
          console.log('Regex %o', /a/);
          console.log('Number %f', -0, 'one', 2);
          console.log('Download the %cReact DevTools%c for a better development experience: %chttps://fb.me/react-devtools', 'font-weight:bold;color:red;outline:blue', '', 'color: blue; text-decoration: underline');
          console.log('Array', 'of', 'values');
          await fetch('http://localhost:9889');
        });
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await page.getByText('Console').click();
  await page.getByText('print').click();

  await expect(page.locator('.console-tab .console-line-message')).toHaveText([
    'Object {a: 1}',
    /Date.*/,
    'Regex /a/',
    'Number 0 one 2',
    'Download the React DevTools for a better development experience: https://fb.me/react-devtools',
    'Array of values',
    'Failed to load resource: net::ERR_CONNECTION_REFUSED',
  ]);

  const label = page.getByText('React DevTools');
  await expect(label).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(label).toHaveCSS('font-weight', '700');
  // blue should not be used, should inherit color red.
  await expect(label).toHaveCSS('outline', 'rgb(255, 0, 0) none 0px');

  const link = page.getByText('https://fb.me/react-devtools');
  await expect(link).toHaveCSS('color', 'rgb(0, 0, 255)');
  await expect(link).toHaveCSS('text-decoration', 'none solid rgb(0, 0, 255)');
});

test('should stream console messages live', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('print', async ({ page }) => {
        await page.setContent('<button>Click me</button>');
        const button = page.getByRole('button', { name: 'Click me' });
        await button.evaluate(node => node.addEventListener('click', () => {
          builtinSetTimeout(() => { console.log('I was clicked'); }, 1000);
        }));
        console.log('I was logged');
        await button.click();
        await page.locator('#not-there').waitFor();
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await page.getByText('Console').click();
  await page.getByText('print').click();

  await expect(page.locator('.console-tab .console-line-message')).toHaveText([
    'I was logged',
    'I was clicked',
  ]);
  await page.getByTitle('Stop').click();
});

test('should print beforeAll console messages once', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(() => {
        console.log('before all log');
      });
      test('print', ({}) => {
        console.log('test log');
      });
    `,
  });
  await page.getByTitle('Run all').click();
  await page.getByText('Console').click();
  await page.getByText('print').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await expect(page.locator('.console-tab .console-line-message')).toHaveText([
    'before all log',
    'test log',
  ]);
});

test('should print web server output', async ({ runUITest }, { workerIndex }) => {
  const port = workerIndex * 2 + 10500;
  const serverPath = path.join(__dirname, 'assets', 'simple-server.js');
  const { page } = await runUITest({
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('connect to the server', async ({baseURL, page}) => {
        expect(baseURL).toBe('http://localhost:${port}');
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        webServer: {
          command: 'node ${JSON.stringify(serverPath)} ${port}',
          port: ${port},
          stdout: 'pipe',
          stderr: 'pipe',
        }
      };
    `,
  });
  await page.getByTitle('Toggle output').click();
  await expect(page.getByTestId('output')).toContainText('output from server');
  await expect(page.getByTestId('output')).toContainText('error from server');
});

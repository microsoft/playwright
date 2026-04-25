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

import { test, expect } from './cli-fixtures';

test.use({ mcpCaps: ['devtools'] });

test('browser_highlight', async ({ boundBrowser, startClient }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button>`);

  const { client } = await startClient({ args: [`--endpoint=default`] });
  await client.callTool({ name: 'browser_snapshot' });

  expect(await client.callTool({
    name: 'browser_highlight',
    arguments: { element: 'Submit button', target: 'e2' },
  })).toHaveResponse({
    result: `Highlighted Submit button`,
  });

  const highlight = page.locator('x-pw-highlight');
  const tooltip = page.locator('x-pw-tooltip-line');
  await expect(highlight).toBeVisible();
  await expect(tooltip).toHaveText(`locator('aria-ref=e2')`);
  expect(await highlight.boundingBox()).toEqual(await page.getByRole('button', { name: 'Submit' }).boundingBox());
});

test('browser_highlight with style', async ({ boundBrowser, startClient, mcpBrowser }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button>`);

  const { client } = await startClient({ args: [`--endpoint=default`] });
  await client.callTool({ name: 'browser_snapshot' });

  expect(await client.callTool({
    name: 'browser_highlight',
    arguments: {
      element: 'Submit button',
      target: 'e2',
      style: 'outline: 3px solid rgb(255, 0, 0); background-color: rgba(0, 255, 0, 0.25)',
    },
  })).toHaveResponse({
    result: `Highlighted Submit button`,
  });

  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  expect(await highlight.evaluate((el: HTMLElement) => ({
    outline: el.style.outline,
    backgroundColor: el.style.backgroundColor,
  }))).toEqual(mcpBrowser === 'webkit' ? {
    outline: '3px solid rgb(255, 0, 0)',
    backgroundColor: 'rgba(0, 255, 0, 0.25)',
  } : {
    outline: 'rgb(255, 0, 0) solid 3px',
    backgroundColor: 'rgba(0, 255, 0, 0.25)',
  });
});

test('browser_hide_highlight', async ({ boundBrowser, startClient }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button>`);

  const { client } = await startClient({ args: [`--endpoint=default`] });
  await client.callTool({ name: 'browser_snapshot' });

  await client.callTool({
    name: 'browser_highlight',
    arguments: { element: 'Submit button', target: 'e2' },
  });
  await expect(page.locator('x-pw-highlight')).toBeVisible();

  expect(await client.callTool({
    name: 'browser_hide_highlight',
    arguments: { element: 'Submit button', target: 'e2' },
  })).toHaveResponse({
    result: `Hid highlight for Submit button`,
  });
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
});

test('browser_hide_highlight all', async ({ boundBrowser, startClient }) => {
  const page = await boundBrowser.newPage();
  await page.setContent(`<button>Submit</button><a href="#">Go</a>`);

  const { client } = await startClient({ args: [`--endpoint=default`] });
  await client.callTool({ name: 'browser_snapshot' });

  await client.callTool({ name: 'browser_highlight', arguments: { element: 'Submit button', target: 'e2' } });
  await client.callTool({ name: 'browser_highlight', arguments: { element: 'Go link', target: 'e3' } });
  await expect(page.locator('x-pw-highlight')).toHaveCount(2);

  expect(await client.callTool({
    name: 'browser_hide_highlight',
    arguments: {},
  })).toHaveResponse({
    result: 'Hid page highlight',
  });
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
});

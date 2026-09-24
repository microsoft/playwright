/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, browserTest as test } from '../config/browserTest';

test.skip(({ mode }) => mode !== 'default', 'Highlight overlay uses an open shadow root only in default mode');

test('highlight should accept a CSS string style', async ({ browser, server, browserName, isFrozenWebkit }) => {
  test.skip(isFrozenWebkit);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.getByRole('button').highlight({ style: 'outline: 3px solid rgb(255, 0, 0); background-color: rgba(0, 255, 0, 0.25)' });

  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  const style = await highlight.evaluate((el: HTMLElement) => ({
    outline: el.style.outline,
    backgroundColor: el.style.backgroundColor,
  }));
  if (browserName === 'chromium' || browserName === 'firefox')
    expect(style.outline).toBe('rgb(255, 0, 0) solid 3px');
  else
    expect(style.outline).toBe('3px solid rgb(255, 0, 0)');
  expect(style.backgroundColor).toBe('rgba(0, 255, 0, 0.25)');

  await context.close();
});

test('highlight should accept an object style (JS only)', async ({ browser, server, browserName, isFrozenWebkit }) => {
  test.skip(isFrozenWebkit);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.getByRole('button').highlight({
    style: {
      outline: '2px dashed rgb(0, 0, 255)',
      backgroundColor: 'rgba(255, 255, 0, 0.2)',
    },
  });

  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  const style = await highlight.evaluate((el: HTMLElement) => ({
    outline: el.style.outline,
    backgroundColor: el.style.backgroundColor,
  }));
  if (browserName === 'chromium' || browserName === 'firefox')
    expect(style.outline).toBe('rgb(0, 0, 255) dashed 2px');
  else
    expect(style.outline).toBe('2px dashed rgb(0, 0, 255)');
  expect(style.backgroundColor).toBe('rgba(255, 255, 0, 0.2)');

  await context.close();
});

test('hideHighlight removes a styled highlight', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  const button = page.getByRole('button');
  await button.highlight({ style: 'outline: 2px solid red' });
  await expect(page.locator('x-pw-highlight')).toBeVisible();

  await button.hideHighlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);

  await context.close();
});

test('highlight should survive navigation', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`<button onclick="console.log(1)">Clicker</button>`);

  await page.getByRole('button').highlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(1);

  // Highlights are resolved again after the navigation.
  await page.goto(server.PREFIX + '/input/button.html');
  await expect(page.locator('x-pw-highlight')).toHaveCount(1);

  await page.hideHighlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);

  await context.close();
});

test('Page.hideHighlight clears all locator highlights', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`<button>One</button><button>Two</button>`);

  await page.getByRole('button', { name: 'One' }).highlight();
  await page.getByRole('button', { name: 'Two' }).highlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(2);

  await page.hideHighlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);

  await context.close();
});

test('highlight should work with a custom selector engine that runs in the main world', async ({ playwright, browser }) => {
  // Engines registered without "contentScript" run in the main world and can see page globals.
  const createEngine = () => ({
    query(root, selector) {
      return window['__engineEnabled'] ? root.querySelector(selector) : null;
    },
    queryAll(root, selector) {
      return window['__engineEnabled'] ? Array.from(root.querySelectorAll(selector)) : [];
    },
  });
  await playwright.selectors.register('highlight-tag', createEngine);

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent('<button>Button</button>');
  await page.evaluate(() => window['__engineEnabled'] = true);

  const button = page.locator('highlight-tag=button');
  await button.highlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(1);

  await button.hideHighlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);

  await button.highlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(1);

  await page.hideHighlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);

  await context.close();
});

test('highlight should resolve relative to the frame of the locator', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent('<iframe name="frame" srcdoc="<button>foo</button>"></iframe><button>bar</button>');
  const frame = page.frame('frame')!;

  await page.locator('button').highlight();
  await frame.locator('button').highlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(1);
  await expect(frame.locator('x-pw-highlight')).toHaveCount(1);

  await page.locator('button').hideHighlight();
  await expect(page.locator('x-pw-highlight')).toHaveCount(0);
  await expect(frame.locator('x-pw-highlight')).toHaveCount(1);

  await frame.locator('button').hideHighlight();
  await expect(frame.locator('x-pw-highlight')).toHaveCount(0);

  await context.close();
});

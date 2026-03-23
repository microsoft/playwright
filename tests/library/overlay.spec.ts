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

test.skip(({ mode }) => mode !== 'default', 'Overlay uses an open shadow root only in default mode');

test('should add and remove overlay', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const disposable = await page.overlay.add('<div id="my-overlay">Hello Overlay</div>');
  await expect(page.locator('x-pw-user-overlays')).toBeVisible();
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(1);
  await expect(page.locator('#my-overlay')).toHaveText('Hello Overlay');

  await disposable.dispose();
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(0);

  await context.close();
});

test('should add multiple overlays', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const d1 = await page.overlay.add('<div id="overlay-1">First</div>');
  const d2 = await page.overlay.add('<div id="overlay-2">Second</div>');
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(2);
  await expect(page.locator('#overlay-1')).toHaveText('First');
  await expect(page.locator('#overlay-2')).toHaveText('Second');

  await d1.dispose();
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(1);
  await expect(page.locator('#overlay-2')).toHaveText('Second');

  await d2.dispose();
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(0);

  await context.close();
});

test('should hide and show overlays', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.overlay.add('<div id="my-overlay">Visible</div>');
  await expect(page.locator('x-pw-user-overlays')).toBeVisible();

  await page.overlay.hide();
  await expect(page.locator('x-pw-user-overlays')).toBeHidden();

  await page.overlay.show();
  await expect(page.locator('x-pw-user-overlays')).toBeVisible();
  await expect(page.locator('#my-overlay')).toHaveText('Visible');

  await context.close();
});

test('should survive navigation', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.overlay.add('<div id="persistent">Survives Reload</div>');
  await expect(page.locator('#persistent')).toHaveText('Survives Reload');

  await page.goto(server.EMPTY_PAGE);
  await expect(page.locator('#persistent')).toHaveText('Survives Reload');

  await page.reload();
  await expect(page.locator('#persistent')).toHaveText('Survives Reload');

  await context.close();
});

test('should remove overlay and not restore after navigation', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const disposable = await page.overlay.add('<div id="temp">Temporary</div>');
  await expect(page.locator('#temp')).toHaveText('Temporary');

  await disposable.dispose();
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(0);

  await context.close();
});

test('should sanitize scripts from overlay html', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.overlay.add('<div id="safe">Safe</div><script>window.__injected = true</script>');
  await expect(page.locator('#safe')).toHaveText('Safe');
  expect(await page.evaluate(() => (window as any).__injected)).toBeUndefined();

  await context.close();
});

test('should strip event handlers from overlay html', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.overlay.add('<div id="clean" onclick="window.__clicked=true">Click me</div>');
  await expect(page.locator('#clean')).toHaveText('Click me');
  const hasOnclick = await page.locator('#clean').evaluate(el => el.hasAttribute('onclick'));
  expect(hasOnclick).toBe(false);

  await context.close();
});

test('should show action highlight and title on click', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button id="btn">Click me</button>');

  await page.overlay.configure({ actionDelay: 5000 });
  const clickPromise = page.locator('#btn').click();

  await expect(page.locator('x-pw-highlight')).toBeVisible();
  await expect(page.locator('x-pw-title')).toBeVisible();
  await expect(page.locator('x-pw-title')).toHaveText(/click/i);

  await clickPromise;
  await context.close();
});

test('should apply locatorStyle to highlight element', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button id="btn">Click me</button>');

  await page.overlay.configure({ actionDelay: 5000, locatorStyle: 'border: 5px solid red' });
  const clickPromise = page.locator('#btn').click();

  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  const border = await highlight.evaluate(el => el.style.border);
  expect(border).toBe('5px solid red');

  await clickPromise;
  await context.close();
});

test('should apply actionStyle to title element', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button id="btn">Click me</button>');

  await page.overlay.configure({ actionDelay: 5000, actionStyle: 'font-size: 42px' });
  const clickPromise = page.locator('#btn').click();

  const title = page.locator('x-pw-title');
  await expect(title).toBeVisible();
  const fontSize = await title.evaluate(el => el.style.fontSize);
  expect(fontSize).toBe('42px');

  await clickPromise;
  await context.close();
});

test('should auto-remove overlay after timeout', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.overlay.add('<div id="timed">Temporary</div>', { timeout: 1 });
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(0);

  await context.close();
});

test('should allow styles in overlay html', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.overlay.add('<div id="styled" style="color: red; font-size: 20px;">Styled</div>');
  await expect(page.locator('#styled')).toHaveText('Styled');
  const color = await page.locator('#styled').evaluate(el => getComputedStyle(el).color);
  expect(color).toBe('rgb(255, 0, 0)');

  await context.close();
});

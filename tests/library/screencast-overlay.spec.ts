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
import { PNG } from 'playwright-core/lib/utilsBundle';

test.skip(({ mode }) => mode !== 'default', 'Overlay uses an open shadow root only in default mode');

function pixel(screenshot: Buffer, x: number, y: number) {
  const png = PNG.sync.read(screenshot);
  const offset = (y * png.width + x) * 4;
  return [png.data[offset], png.data[offset + 1], png.data[offset + 2]];
}

test('should add and remove overlay', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const disposable = await page.screencast.showOverlay('<div id="my-overlay">Hello Overlay</div>');
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

  const d1 = await page.screencast.showOverlay('<div id="overlay-1">First</div>');
  const d2 = await page.screencast.showOverlay('<div id="overlay-2">Second</div>');
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

  await page.screencast.showOverlay('<div id="my-overlay">Visible</div>');
  await expect(page.locator('x-pw-user-overlays')).toBeVisible();

  await page.screencast.hideOverlays();
  await expect(page.locator('x-pw-user-overlays')).toBeHidden();

  await page.screencast.showOverlays();
  await expect(page.locator('x-pw-user-overlays')).toBeVisible();
  await expect(page.locator('#my-overlay')).toHaveText('Visible');

  await context.close();
});

test('should survive navigation', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.screencast.showOverlay('<div id="persistent">Survives Reload</div>');
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

  const disposable = await page.screencast.showOverlay('<div id="temp">Temporary</div>');
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

  await page.screencast.showOverlay('<div id="safe">Safe</div><script>window.__injected = true</script>');
  await expect(page.locator('#safe')).toHaveText('Safe');
  expect(await page.evaluate(() => (window as any).__injected)).toBeUndefined();

  await context.close();
});

test('should strip event handlers from overlay html', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.screencast.showOverlay('<div id="clean" onclick="window.__clicked=true">Click me</div>');
  await expect(page.locator('#clean')).toHaveText('Click me');
  const hasOnclick = await page.locator('#clean').evaluate(el => el.hasAttribute('onclick'));
  expect(hasOnclick).toBe(false);

  await context.close();
});

test('should auto-remove overlay after timeout', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.screencast.showOverlay('<div id="timed">Temporary</div>', { duration: 1 });
  await expect(page.locator('.x-pw-user-overlay')).toHaveCount(0);

  await context.close();
});

test('should allow styles in overlay html', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  await page.screencast.showOverlay('<div id="styled" style="color: red; font-size: 20px;">Styled</div>');
  await expect(page.locator('#styled')).toHaveText('Styled');
  const color = await page.locator('#styled').evaluate(el => getComputedStyle(el).color);
  expect(color).toBe('rgb(255, 0, 0)');

  await context.close();
});

const topLayerPages = {
  dialog: `
    <dialog id="target" style="position: fixed; inset: 0; margin: 0; width: 100vw; height: 100vh; padding: 0; border: 0; background: rgb(200, 200, 200);"></dialog>
    <button onclick="target.showModal()">Open</button>
  `,
  popover: `
    <div id="target" popover="manual" style="inset: 0; margin: 0; width: 100%; height: 100%; max-width: none; max-height: none; padding: 0; border: 0; background: rgb(200, 200, 200);"></div>
    <button onclick="target.showPopover()">Open</button>
  `,
};
const redOverlay = '<div style="position: absolute; top: 50px; left: 50px; width: 200px; height: 100px; background: rgb(255, 0, 0);"></div>';

for (const [kind, content] of Object.entries(topLayerPages)) {
  test(`should show overlay above ${kind} opened before it`, { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42629' } }, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(content);
    const disposable = await page.screencast.showOverlay('<div></div>');
    await disposable.dispose();

    await page.getByRole('button', { name: 'Open' }).click();
    expect(pixel(await page.screenshot(), 100, 100)).toEqual([200, 200, 200]);

    await page.screencast.showOverlay(redOverlay);
    expect(pixel(await page.screenshot(), 100, 100)).toEqual([255, 0, 0]);

    await context.close();
  });

  test(`should keep overlay above ${kind} opened after it`, { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42629' } }, async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent(content);
    await page.screencast.showOverlay(redOverlay);
    expect(pixel(await page.screenshot(), 100, 100)).toEqual([255, 0, 0]);

    await page.getByRole('button', { name: 'Open' }).click();
    await expect.poll(async () => pixel(await page.screenshot(), 100, 100)).toEqual([255, 0, 0]);

    await context.close();
  });
}

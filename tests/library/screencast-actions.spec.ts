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

test.skip(({ mode }) => mode !== 'default', 'Annotations use an open shadow root only in default mode');

test('should show annotation on click', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000 });
  page.click('button').catch(() => {});

  await expect(page.locator('x-pw-highlight')).toBeVisible();
  await expect(page.locator('x-pw-action-point')).toBeVisible();
  await expect(page.locator('x-pw-title')).toBeVisible();
  await expect(page.locator('x-pw-title')).toHaveText(/click/i);

  await context.close();
});

test('should render annotation styles', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000, fontSize: 32 });
  page.click('button').catch(() => {});

  // Highlight box: blue overlay with non-zero dimensions.
  const highlight = page.locator('x-pw-highlight');
  await expect(highlight).toBeVisible();
  const highlightStyle = await highlight.evaluate((el: HTMLElement) => ({
    backgroundColor: el.style.backgroundColor,
    borderColor: el.style.borderColor,
  }));
  expect(highlightStyle.backgroundColor).toBe('rgba(0, 128, 255, 0.15)');
  expect(highlightStyle.borderColor).toBe('rgba(0, 128, 255, 0.6)');
  const box = await highlight.boundingBox();
  expect(box!.width).toBeGreaterThan(0);
  expect(box!.height).toBeGreaterThan(0);

  // Action point: 20x20 red circle.
  const actionPoint = page.locator('x-pw-action-point');
  await expect(actionPoint).toBeVisible();
  const apStyle = await actionPoint.evaluate((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return { width: cs.width, height: cs.height, background: cs.backgroundColor, borderRadius: cs.borderRadius };
  });
  expect(apStyle.width).toBe('20px');
  expect(apStyle.height).toBe('20px');
  expect(apStyle.background).toBe('rgb(255, 0, 0)');
  expect(apStyle.borderRadius).toBe('10px');

  // Title: white text, dark background, positioned top-right by default, custom fontSize.
  const title = page.locator('x-pw-title');
  await expect(title).toBeVisible();
  const titleStyle = await title.evaluate((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return {
      color: cs.color, borderRadius: cs.borderRadius, padding: cs.padding,
      top: el.style.top, right: el.style.right, fontSize: el.style.fontSize,
    };
  });
  expect(titleStyle.color).toBe('rgb(255, 255, 255)');
  expect(titleStyle.borderRadius).toBe('6px');
  expect(titleStyle.padding).toBe('6px');
  expect(titleStyle.top).toBe('6px');
  expect(titleStyle.right).toBe('6px');
  expect(titleStyle.fontSize).toBe('32px');

  await context.close();
});

for (const { position, expected } of [
  { position: 'top-left' as const, expected: { top: '6px', left: '6px' } },
  { position: 'top' as const, expected: { top: '6px', left: '50%' } },
  { position: 'bottom-left' as const, expected: { bottom: '6px', left: '6px' } },
  { position: 'bottom' as const, expected: { bottom: '6px', left: '50%' } },
  { position: 'bottom-right' as const, expected: { bottom: '6px', right: '6px' } },
] as const) {
  test(`should position title at ${position}`, async ({ browser, server }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/button.html');

    await page.screencast.showActions({ duration: 5000, position });
    page.click('button').catch(() => {});

    const title = page.locator('x-pw-title');
    await expect(title).toBeVisible();

    const titleStyle = await title.evaluate((el: HTMLElement) => ({
      top: el.style.top,
      bottom: el.style.bottom,
      left: el.style.left,
      right: el.style.right,
    })) as any;

    for (const [key, value] of Object.entries(expected))
      expect(titleStyle[key]).toBe(value);

    await context.close();
  });
}

test('should clear annotation after duration', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 1000 });
  await page.click('button');

  await expect(page.locator('x-pw-action-point')).toBeHidden();
  await expect(page.locator('x-pw-title')).toBeHidden();

  await context.close();
});

test('should annotate fill action', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/textarea.html');

  await page.screencast.showActions({ duration: 5000 });
  page.fill('textarea', 'hello').catch(() => {});

  const title = page.locator('x-pw-title');
  await expect(title).toBeVisible();
  await expect(title).toHaveText(/fill/i);

  await context.close();
});

test('should stop showing actions after dispose', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  const actions = await page.screencast.showActions({ duration: 1000 });
  await page.click('button');
  await actions.dispose();

  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');

  await expect(page.locator('x-pw-title')).toBeHidden();

  await context.close();
});

test('should stop showing actions after hideActions', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 1000 });
  await page.click('button');
  await page.screencast.hideActions();

  await page.goto(server.PREFIX + '/input/button.html');
  await page.click('button');

  await expect(page.locator('x-pw-title')).toBeHidden();

  await context.close();
});

test('should survive navigation', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000 });
  page.click('button').catch(() => {});

  await expect(page.locator('x-pw-title')).toBeVisible();

  await page.goto(server.PREFIX + '/input/button.html');
  page.click('button').catch(() => {});

  await expect(page.locator('x-pw-title')).toBeVisible();

  await context.close();
});

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

const style = {
  point: 'width: 20px; height: 20px; border-radius: 50%; background: red',
  highlight: 'outline: 2px solid #333',
};

test('should show annotation on click', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000 });
  page.click('button').catch(() => {});

  await expect(page.locator('x-pw-title')).toBeVisible();
  await expect(page.locator('x-pw-title')).toHaveText(/click/i);
  // Point and highlight are only shown when styled.
  await expect(page.locator('x-pw-screencast-highlight')).toHaveCount(0);
  await expect(page.locator('x-pw-screencast-point')).toHaveCount(0);

  await context.close();
});

test('should render annotation styles', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000, fontSize: 32, style: { ...style, title: 'top: 100px; background-color: rgb(1, 2, 3)' } });
  const buttonBox = (await page.locator('button').boundingBox())!;
  page.click('button').catch(() => {});

  // Highlight: styled box that covers the target.
  const highlight = page.locator('x-pw-screencast-highlight');
  await expect(highlight).toBeVisible();
  expect(await highlight.evaluate((el: HTMLElement) => getComputedStyle(el).outlineWidth)).toBe('2px');
  const box = (await highlight.boundingBox())!;
  expect(box.x).toBeCloseTo(buttonBox.x, 0);
  expect(box.y).toBeCloseTo(buttonBox.y, 0);
  expect(box.width).toBeCloseTo(buttonBox.width, 0);
  expect(box.height).toBeCloseTo(buttonBox.height, 0);

  // Point: styled marker centered on the click point, Firefox rounds the click point.
  const pointBox = (await page.locator('x-pw-screencast-point').boundingBox())!;
  expect(pointBox.width).toBe(20);
  expect(Math.abs(pointBox.x + 10 - (buttonBox.x + buttonBox.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(pointBox.y + 10 - (buttonBox.y + buttonBox.height / 2))).toBeLessThanOrEqual(1);

  // Title: style applies on top of deprecated fontSize, position wins over style.
  const title = page.locator('x-pw-title');
  await expect(title).toBeVisible();
  const titleStyle = await title.evaluate((el: HTMLElement) => {
    const cs = getComputedStyle(el);
    return {
      color: cs.color, borderRadius: cs.borderRadius, padding: cs.padding, backgroundColor: cs.backgroundColor,
      top: el.style.top, right: el.style.right, fontSize: el.style.fontSize,
    };
  });
  expect(titleStyle.backgroundColor).toBe('rgb(1, 2, 3)');
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

  await page.screencast.showActions({ duration: 1000, style });
  await page.click('button');

  await expect(page.locator('x-pw-screencast-point')).toHaveCount(0);
  await expect(page.locator('x-pw-screencast-highlight')).toHaveCount(0);
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

test('should render an action cursor that animates to the click point', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000 });
  page.click('button').catch(() => {});

  const cursor = page.locator('x-pw-action-cursor');
  await expect(cursor).toBeVisible();

  const initial = await cursor.evaluate((el: HTMLElement) => ({
    top: el.style.top,
    left: el.style.left,
  }));
  expect(initial.top).toMatch(/\d+px/);
  expect(initial.left).toMatch(/\d+px/);

  await context.close();
});

test('cursor moves between two pointer actions', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(`
    <div style="position: fixed; top: 20px; left: 20px; width: 60px; height: 60px;" id="a">A</div>
    <div style="position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px;" id="b">B</div>
  `);

  await page.screencast.showActions({ duration: 5000 });
  const cursor = page.locator('x-pw-action-cursor');

  page.click('#a', { force: true }).catch(() => {});
  await expect(cursor).toBeVisible();
  const first = await cursor.evaluate((el: HTMLElement) => ({ top: el.style.top, left: el.style.left }));

  page.click('#b', { force: true }).catch(() => {});
  await expect.poll(async () => {
    return await cursor.evaluate((el: HTMLElement) => ({ top: el.style.top, left: el.style.left }));
  }).not.toEqual(first);

  await context.close();
});

test('cursor: "none" suppresses the action cursor decoration', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 5000, cursor: 'none' });
  page.click('button').catch(() => {});

  // The title still renders, but the cursor does not.
  await expect(page.locator('x-pw-title')).toBeVisible();
  await expect(page.locator('x-pw-action-cursor')).toBeHidden();

  await context.close();
});

test('cursor stays at the last action point until hideActions', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');

  await page.screencast.showActions({ duration: 100 });
  await page.click('button');
  await expect(page.locator('x-pw-title')).toBeHidden();
  const cursor = page.locator('x-pw-action-cursor');
  await expect(cursor).toBeVisible();
  const position = await cursor.evaluate((el: HTMLElement) => ({ top: el.style.top, left: el.style.left }));

  await page.goto(server.EMPTY_PAGE);
  await expect(cursor).toBeVisible();
  expect(await cursor.evaluate((el: HTMLElement) => ({ top: el.style.top, left: el.style.left }))).toEqual(position);

  await page.screencast.hideActions();
  await expect(cursor).toBeHidden();

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

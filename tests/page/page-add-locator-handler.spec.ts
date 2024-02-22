/**
 * Copyright (c) Microsoft Corporation.
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

import { test, expect } from './pageTest';
import { kTargetClosedErrorMessage } from '../config/errors';

test('should work', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  let beforeCount = 0;
  let afterCount = 0;
  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    ++beforeCount;
    await page.locator('#close').click();
    ++afterCount;
  });

  for (const args of [
    ['mouseover', 1],
    ['mouseover', 1, 'capture'],
    ['mouseover', 2],
    ['mouseover', 2, 'capture'],
    ['pointerover', 1],
    ['pointerover', 1, 'capture'],
    ['none', 1],
    ['remove', 1],
    ['hide', 1],
  ]) {
    await test.step(`${args[0]}${args[2] === 'capture' ? ' with capture' : ''} ${args[1]} times`, async () => {
      await page.locator('#aside').hover();
      beforeCount = 0;
      afterCount = 0;
      await page.evaluate(args => {
        (window as any).clicked = 0;
        (window as any).setupAnnoyingInterstitial(...args);
      }, args);
      expect(beforeCount).toBe(0);
      expect(afterCount).toBe(0);
      await page.locator('#target').click();
      expect(beforeCount).toBe(args[1]);
      expect(afterCount).toBe(args[1]);
      expect(await page.evaluate('window.clicked')).toBe(1);
      await expect(page.locator('#interstitial')).not.toBeVisible();
    });
  }
});

test('should work with a custom check', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  await page.addLocatorHandler(page.locator('body'), async () => {
    if (await page.getByText('This interstitial covers the button').isVisible())
      await page.locator('#close').click();
  });

  for (const args of [
    ['mouseover', 2],
    ['none', 1],
    ['remove', 1],
    ['hide', 1],
  ]) {
    await test.step(`${args[0]}${args[2] === 'capture' ? ' with capture' : ''} ${args[1]} times`, async () => {
      await page.locator('#aside').hover();
      await page.evaluate(args => {
        (window as any).clicked = 0;
        (window as any).setupAnnoyingInterstitial(...args);
      }, args);
      await page.locator('#target').click();
      expect(await page.evaluate('window.clicked')).toBe(1);
      await expect(page.locator('#interstitial')).not.toBeVisible();
    });
  }
});

test('should work with locator.hover()', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    await page.locator('#close').click();
  });

  await page.locator('#aside').hover();
  await page.evaluate(() => {
    (window as any).setupAnnoyingInterstitial('pointerover', 1, 'capture');
  });
  await page.locator('#target').hover();
  await expect(page.locator('#interstitial')).not.toBeVisible();
  expect(await page.$eval('#target', e => window.getComputedStyle(e).backgroundColor)).toBe('rgb(255, 255, 0)');
});

test('should not work with force:true', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    await page.locator('#close').click();
  });

  await page.locator('#aside').hover();
  await page.evaluate(() => {
    (window as any).setupAnnoyingInterstitial('none', 1);
  });
  await page.locator('#target').click({ force: true, timeout: 2000 });
  expect(await page.locator('#interstitial').isVisible()).toBe(true);
  expect(await page.evaluate('window.clicked')).toBe(undefined);
});

test('should throw when page closes', async ({ page, server, isAndroid }) => {
  test.fixme(isAndroid, 'GPU process crash: https://issues.chromium.org/issues/324909825');
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    await page.close();
  });

  await page.locator('#aside').hover();
  await page.evaluate(() => {
    (window as any).clicked = 0;
    (window as any).setupAnnoyingInterstitial('mouseover', 1);
  });
  const error = await page.locator('#target').click().catch(e => e);
  expect(error.message).toContain(kTargetClosedErrorMessage);
});

test('should throw when handler times out', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  let called = 0;
  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    ++called;
    // Deliberately timeout.
    await new Promise(() => {});
  });

  await page.locator('#aside').hover();
  await page.evaluate(() => {
    (window as any).clicked = 0;
    (window as any).setupAnnoyingInterstitial('mouseover', 1);
  });
  const error = await page.locator('#target').click({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('Timeout 3000ms exceeded');

  const error2 = await page.locator('#target').click({ timeout: 3000 }).catch(e => e);
  expect(error2.message).toContain('Timeout 3000ms exceeded');

  // Should not enter the same handler while it is still running.
  expect(called).toBe(1);
});

test('should work with toBeVisible', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  let called = 0;
  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    ++called;
    await page.locator('#close').click();
  });

  await page.evaluate(() => {
    (window as any).clicked = 0;
    (window as any).setupAnnoyingInterstitial('remove', 1);
  });
  await expect(page.locator('#target')).toBeVisible();
  await expect(page.locator('#interstitial')).not.toBeVisible();
  expect(called).toBe(1);
});

test('should work with toHaveScreenshot', async ({ page, server, isAndroid }) => {
  test.fixme(isAndroid, 'Screenshots are cut off on Android');
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/grid.html');

  await page.evaluate(() => {
    const overlay = document.createElement('div');
    document.body.append(overlay);
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.top = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'red';

    const closeButton = document.createElement('button');
    overlay.appendChild(closeButton);
    closeButton.textContent = 'close';
    closeButton.addEventListener('click', () => overlay.remove());
  });

  await page.addLocatorHandler(page.getByRole('button', { name: 'close' }), async () => {
    await page.getByRole('button', { name: 'close' }).click();
  });

  await expect(page).toHaveScreenshot('screenshot-grid.png');
});

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
import type { Page } from 'playwright-core';
import { test as it, expect, rafraf } from './pageTest';

it.skip(({ isAndroid }) => {
  return isAndroid;
});

let ignoreDelta = false;

it.beforeAll(async ({ browserName, isElectron, platform }) => {
  if (((browserName === 'chromium') || isElectron) && platform === 'darwin') {
    // Chromium reports deltaX/deltaY scaled by host device scale factor.
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1324819
    // https://github.com/microsoft/playwright/issues/7362
    // Different bots have different scale factors (usually 1 or 2), so we just ignore the values
    // instead of guessing the host scale factor.
    ignoreDelta = true;
  }
});

async function expectEvent(page: Page, expected: any) {
  let received: any;
  await expect.poll(async () => {
    received = await page.evaluate('window.lastEvent') as any;
    return received;
  }).toBeTruthy();
  if (ignoreDelta) {
    delete received.deltaX;
    delete received.deltaY;
    delete expected.deltaX;
    delete expected.deltaY;
  }
  expect(received).toEqual(expected);
}

it('should dispatch wheel events @smoke', async ({ page, server }) => {
  await page.setContent(`<div style="width: 5000px; height: 5000px;"></div>`);
  await page.mouse.move(50, 60);
  await listenForWheelEvents(page, 'div');
  await page.mouse.wheel(0, 100);
  await page.waitForFunction('window.scrollY === 100');
  await expectEvent(page, {
    deltaX: 0,
    deltaY: 100,
    clientX: 50,
    clientY: 60,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  });
});

it('should dispatch wheel events after context menu was opened', async ({ page, browserName, isWindows }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20823' });
  it.fixme(browserName === 'firefox');
  it.skip(browserName === 'chromium' && isWindows, 'context menu support is best-effort for Linux and MacOS');

  await page.setContent(`<div style="width: 5000px; height: 5000px;"></div>`);
  await page.mouse.move(50, 60);
  await page.evaluate(() => {
    window['contextMenuPromise'] = new Promise(x => {
      window.addEventListener('contextmenu', x, false);
    });
  });
  await page.mouse.down({ button: 'right' });
  await page.evaluate(() => window['contextMenuPromise']);

  await listenForWheelEvents(page, 'div');
  await page.mouse.wheel(0, 100);
  await page.waitForFunction('window.scrollY === 100');
  await expectEvent(page, {
    deltaX: 0,
    deltaY: 100,
    clientX: 50,
    clientY: 60,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  });
});

it('should dispatch wheel events after popup was opened @smoke', async ({ page, server }) => {
  await page.setContent(`
    <div style="width: 5000px; height: 5000px;"></div>
  `);
  await page.mouse.move(50, 60);
  await listenForWheelEvents(page, 'div');
  await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('')),
  ]);
  await page.mouse.wheel(0, 100);
  await page.waitForFunction('window.scrollY === 100');
  await expectEvent(page, {
    deltaX: 0,
    deltaY: 100,
    clientX: 50,
    clientY: 60,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  });
});

it('should dispatch wheel event on svg element', async ({ page, browserName, headless, isLinux }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15566' });
  await page.setContent(`
    <body>
      <svg class="scroll-box"></svg>
    </body>
    <style>
      .scroll-box {
        position: absolute;
        top: 0px;
        left: 0px;
        background-color: brown;
        width: 200px;
        height: 200px;
      }
    </style>`);
  await listenForWheelEvents(page, 'svg');
  await page.mouse.move(100, 100);
  await page.mouse.wheel(0, 100);
  await page.waitForFunction('!!window.lastEvent');
  await expectEvent(page, {
    deltaX: 0,
    deltaY: 100,
    clientX: 100,
    clientY: 100,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  });
});

it('should scroll when nobody is listening', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/scrollable.html');
  await page.mouse.move(50, 60);
  await page.mouse.wheel(0, 100);
  await page.waitForFunction('window.scrollY === 100');
});

it('should set the modifiers', async ({ page }) => {
  await page.setContent(`<div style="width: 5000px; height: 5000px;"></div>`);
  await page.mouse.move(50, 60);
  await listenForWheelEvents(page, 'div');
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, 100);
  await expectEvent(page, {
    deltaX: 0,
    deltaY: 100,
    clientX: 50,
    clientY: 60,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
    metaKey: false,
  });
});

it('should scroll horizontally', async ({ page }) => {
  await page.setContent(`<div style="width: 5000px; height: 5000px;"></div>`);
  await page.mouse.move(50, 60);
  await listenForWheelEvents(page, 'div');
  await page.mouse.wheel(100, 0);
  await expectEvent(page, {
    deltaX: 100,
    deltaY: 0,
    clientX: 50,
    clientY: 60,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  });
  await page.waitForFunction('window.scrollX === 100');
});

it('should work when the event is canceled', async ({ page }) => {
  await page.setContent(`<div style="width: 5000px; height: 5000px;"></div>`);
  await page.mouse.move(50, 60);
  await listenForWheelEvents(page, 'div');
  await page.evaluate(() => {
    document.querySelector('div').addEventListener('wheel', e => e.preventDefault());
  });
  // Give wheel listener a chance to propagate through all the layers in Firefox.
  await rafraf(page, 10);
  await page.mouse.wheel(0, 100);
  await expectEvent(page, {
    deltaX: 0,
    deltaY: 100,
    clientX: 50,
    clientY: 60,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  });
  // Give the page a chance to scroll.
  await page.waitForFunction(`!!window['lastEvent']`);
  // Ensure that it did not.
  expect(await page.evaluate('window.scrollY')).toBe(0);
});

async function listenForWheelEvents(page: Page, selector: string) {
  await page.evaluate(selector => {
    document.querySelector(selector).addEventListener('wheel', (e: WheelEvent) => {
      window['lastEvent'] = {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        clientX: e.clientX,
        clientY: e.clientY,
        deltaMode: e.deltaMode,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      };
    }, { passive: false });
  }, selector);
}

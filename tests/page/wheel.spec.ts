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
import { test as it, expect } from './pageTest';

it.skip(({ isElectron, browserMajorVersion, isAndroid }) => {
  // Old Electron has flaky wheel events.
  return (isElectron && browserMajorVersion <= 11) || isAndroid;
});
it('should dispatch wheel events #smoke', async ({ page, server }) => {
  await page.setContent(`<div style="width: 5000px; height: 5000px;"></div>`);
  await page.mouse.move(50, 60);
  await listenForWheelEvents(page, 'div');
  await page.mouse.wheel(0, 100);
  await page.waitForFunction('window.scrollY === 100');
  expect(await page.evaluate('window.lastEvent')).toEqual({
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
  expect(await page.evaluate('window.lastEvent')).toEqual({
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
  expect(await page.evaluate('window.lastEvent')).toEqual({
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
  await page.mouse.wheel(0, 100);
  expect(await page.evaluate('window.lastEvent')).toEqual({
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
  await page.waitForTimeout(100);
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

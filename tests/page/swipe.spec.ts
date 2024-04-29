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
import type { ElementHandle } from 'playwright-core';
import { contextTest as it, expect } from '../config/browserTest';

it.fixme(({ browserName }) => {
  return browserName !== 'chromium';
}, 'Not Yet Implemented');
it.use({ hasTouch: true, });


it('should work on scroll container', async ({ page, server }) => {
  await page.setContent(`<div id="container" style="width: 500px; height: 700px; overflow-y:scroll;"><div style="width:100%; height:200%;"></div></div>`);
  await page.touchscreen.swipe(10, 200, 10, -100);
  expect(await page.$eval('#container', e => e.scrollTop)).toBeGreaterThan(100);
});

it('should work for fling gesture', async ({ page, server }) => {
  await page.setContent(`<div id="container" style="width: 500px; height: 700px; overflow-y:scroll;"><div style="width:100%; height:200%;"></div></div>`);
  await page.touchscreen.swipe(10, 600, 10, -500, {
    speed: 3000
  });
  expect(await page.$eval('#container', e => e.scrollTop)).toBeGreaterThanOrEqual(500);
});

it('should invoke touch events', async ({ page, server }) => {
  await page.setContent(`<div id="container" style="width: 500px; height: 700px; overflow-y:scroll;"><div style="width:100%; height:200%;"></div></div>`);
  const eventsHandle = await trackEvents(await page.$('#container'));
  await page.touchscreen.swipe(10, 600, 10, -500);
  await new Promise(f => setTimeout(f, 100));
  expect(await eventsHandle.jsonValue()).toEqual([
    'touchstart', 'touchmove', 'scroll', 'touchend', 'scrollend',
  ]);
});
async function trackEvents(target: ElementHandle) {
  const eventsHandle = await target.evaluateHandle(target => {
    const events: string[] = [];
    for (const event of [
      'touchstart', 'touchend', 'touchmove', 'touchcancel',
      'scroll', 'scrollend'
    ]) {
      target.addEventListener(event, e => {
        if (events.indexOf(event) === -1) {
        // the scroll and touchmove event could be triggered multiple times.
        // ignore duplicated events for debounce.
          events.push(event);
        }
      }, false);
    }
    return events;
  });
  return eventsHandle;
}
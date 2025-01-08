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

import { contextTest as it, expect } from '../config/browserTest';

it.use({ hasTouch: true });

it('should support touch points in touch event arguments', async ({ page, server, browserName }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
      <div data-testid='outer' style="position: absolute; width: 120px; height: 120px; background-color: red;">
        <div data-testid='inner' style="position: absolute; width: 100px; height: 100px; top: 10px; left: 10px; background-color: green; z-index: 3;">inner</div>
      </div>`);
  const outer = page.getByTestId('outer');
  await outer.evaluate(el => {
    const events = [];
    (window as any).events = events;
    el.addEventListener('touchstart', (e: TouchEvent) => events.push('touchstart: ' + [...e.touches].map(t => `${t.constructor.name}(id: ${t.identifier}, clientX: ${t.clientX}, clientY: ${t.clientY})`)));
    el.addEventListener('touchmove', (e: TouchEvent) => events.push('touchmove: ' + [...e.touches].map(t => `${t.constructor.name}(id: ${t.identifier}, clientX: ${t.clientX}, clientY: ${t.clientY})`)));
    el.addEventListener('touchend', (e: TouchEvent) => events.push('touchend: ' + [...e.touches].map(t => `${t.constructor.name}(id: ${t.identifier}, clientX: ${t.clientX}, clientY: ${t.clientY})`)));
  });

  const touches = [{ identifier: 0, clientX: 61, clientY: 60 }, { identifier: 1, clientX: 59, clientY: 60 }];
  const inner = page.getByTestId('inner');
  await inner.dispatchEvent('touchstart', {
    touches,
    changedTouches: touches,
    targetTouches: touches,
  });
  await inner.dispatchEvent('touchmove', {
    touches,
    changedTouches: touches,
    targetTouches: touches,
  });
  await inner.dispatchEvent('touchend', {
    touches: [],
    changedTouches: touches,
    targetTouches: [],
  });
  expect(await page.evaluate(() => (window as any).events)).toEqual([
    'touchstart: Touch(id: 0, clientX: 61, clientY: 60),Touch(id: 1, clientX: 59, clientY: 60)',
    'touchmove: Touch(id: 0, clientX: 61, clientY: 60),Touch(id: 1, clientX: 59, clientY: 60)',
    'touchend: ',
  ]);
});

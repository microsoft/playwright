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

import { test as it, expect } from './pageTest';
import { waitForTestLog } from '../config/utils';
import type { Locator } from 'playwright-core';

type BoundingBox = Awaited<ReturnType<Locator['boundingBox']>>;

it.skip(({ mode }) => mode !== 'default', 'Highlight element has a closed shadow-root on != default');

it('should highlight locator', async ({ page, isAndroid }) => {
  await page.setContent(`<input type='text' />`);
  const textPromise = waitForTestLog<string>(page, 'Highlight text for test: ');
  const boxPromise = waitForTestLog<{ x: number, y: number, width: number, height: number }>(page, 'Highlight box for test: ');
  await page.locator('input').highlight();
  expect(await textPromise).toBe('input');
  let box1 = await page.locator('input').boundingBox();
  let box2 = await boxPromise;

  if (isAndroid) {
    box1 = roundBox(box1);
    box2 = roundBox(box2);
  }

  expect(box1).toEqual(box2);
});

function roundBox(box: BoundingBox): BoundingBox {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

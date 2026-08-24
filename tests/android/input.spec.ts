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

import { androidTest as test, expect } from './androidTest';
import { rafraf } from '../config/utils';

test('androidInput.swipe should start from the given point', async ({ androidDevice }) => {
  const context = await androidDevice.launchBrowser();
  const [page] = context.pages();
  await page.setContent(`<div style="height: 3000px">${'line<br>'.repeat(200)}</div>`);
  // androidDevice.input.swipe() injects a raw touch event straight into the OS input
  // pipeline, independent of the CDP connection used by setContent() above. Wait for
  // the new content to actually be composited and presented on the device screen,
  // otherwise the swipe can land on the previous (blank) frame and never scroll anything.
  await rafraf(page);
  await androidDevice.input.swipe({ x: 250, y: 1500 }, [{ x: 250, y: 500 }], 30);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await context.close();
});

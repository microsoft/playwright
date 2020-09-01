import { assert } from 'console';
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

import './playwright.fixtures';

it('should emit close event when page closes', async ({page}) => {
  let fired;
  page.on('close', () => fired = true);
  await page.close();
  expect(fired).toBeTruthy();
});

it('should fire after list of pages updated', async ({page}) => {
  expect(page.context().pages().length).toBe(1);
  let length;
  page.on('close', () => length = page.context().pages().length);
  await page.close();
  expect(length).toBe(0);
});

/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

test('should match active element', async ({ page }) => {
  await page.setContent(`
    <button id="btn1">Button 1</button>
    <button id="btn2" autofocus>Button 2</button>
  `);

  // Wait for autofocus to take effect
  await page.waitForFunction(() => document.activeElement?.id === 'btn2');

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - button "Button 1"
    - button "Button 2" [active]
  `);
});

test('should match active element after focus', async ({ page }) => {
  await page.setContent(`
    <input id="input1" placeholder="First input">
    <input id="input2" placeholder="Second input">
  `);

  // Focus the second input
  await page.locator('#input2').focus();

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - textbox "First input"
    - textbox "Second input" [active]
  `);
});

test('should match active iframe', async ({ page }) => {
  await page.setContent(`
    <input id="regular-input" placeholder="Regular input">
    <iframe src="data:text/html,<input id='iframe-input' placeholder='Input in iframe'>" tabindex="0"></iframe>
  `);

  // Focus the input inside the iframe
  await page.frameLocator('iframe').locator('#iframe-input').focus();

  await expect(page.locator('body')).toMatchAriaSnapshot(`
    - textbox "Regular input"
    - iframe [active]
  `);

  // Also check that the input element inside the iframe is active
  await expect(page.frameLocator('iframe').locator('body')).toMatchAriaSnapshot(`
    - textbox "Input in iframe" [active]
  `);
});
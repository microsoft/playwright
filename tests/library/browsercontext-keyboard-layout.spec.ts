/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { browserTest as it, expect } from '../config/browserTest';

it('should set keyboard layout on Browser.newContext @smoke', async ({ browser, server }) => {
  const context = await browser.newContext({ keyboardLayout: 'el-GR' });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('α');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: α KeyA 65 []',
        'Keypress: α KeyA 945 945 []',
        'Keyup: α KeyA 65 []'].join('\n'));
});

it('should set keyboard layout on Browser.newPage @smoke', async ({ browser, server }) => {
  const page = await browser.newPage({ keyboardLayout: 'el-GR' });
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('α');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: α KeyA 65 []',
        'Keypress: α KeyA 945 945 []',
        'Keyup: α KeyA 65 []'].join('\n'));
});

it('should set keyboard layout on BrowserType.launchPersistentContext @smoke', async ({ browserType, server, createUserDataDir }) => {
  const userDataDir = await createUserDataDir();
  const context = await browserType.launchPersistentContext(userDataDir, { keyboardLayout: 'el-GR' });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/keyboard.html');
  await page.keyboard.press('α');
  expect(await page.evaluate('getResult()')).toBe(
      ['Keydown: α KeyA 65 []',
        'Keypress: α KeyA 945 945 []',
        'Keyup: α KeyA 65 []'].join('\n'));
});

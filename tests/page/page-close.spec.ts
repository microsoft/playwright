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

import { test as it, expect } from './pageTest';

it.skip(({ isWebView2 }) => isWebView2, 'Page.close() is not supported in WebView2');

it('should close page with active dialog', async ({ page }) => {
  await page.evaluate('"trigger builtinSetTimeout"');
  await page.setContent(`<button onclick="builtinSetTimeout(() => alert(1))">alert</button>`);
  void page.click('button').catch(() => {});
  await page.waitForEvent('dialog');
  await page.close();
});

it('should not accept dialog after close', async ({ page, mode }) => {
  it.fixme(mode.startsWith('service2'), 'Times out');
  const promise = page.waitForEvent('dialog');
  page.evaluate(() => alert()).catch(() => {});
  const dialog = await promise;
  await page.close();
  const e = await dialog.dismiss().catch(e => e);
  expect(e.message).toContain('Target page, context or browser has been closed');
});

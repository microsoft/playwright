/**
 * Copyright 2020 Microsoft Corporation. All rights reserved.
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

import { kTargetClosedErrorMessage } from '../config/errors';
import { browserTest as test, expect } from '../config/browserTest';

test('should return browserType', function({ browser, browserType }) {
  expect(browser.browserType()).toBe(browserType);
});

test('should create new page @smoke', async function({ browser }) {
  const page1 = await browser.newPage();
  expect(browser.contexts().length).toBe(1);

  const page2 = await browser.newPage();
  expect(browser.contexts().length).toBe(2);

  await page1.close();
  expect(browser.contexts().length).toBe(1);

  await page2.close();
  expect(browser.contexts().length).toBe(0);
});

test('should throw upon second create new page', async function({ browser }) {
  const page = await browser.newPage();
  let error: Error;
  await page.context().newPage().catch(e => error = e);
  await page.close();
  expect(error!.message).toContain('Please use browser.newContext()');
});

test('version should work', async function({ browser, browserName }) {
  const version = browser.version();
  if (browserName === 'chromium')
    expect(version.match(/^\d+\.\d+\.\d+\.\d+$/)).toBeTruthy();
  else
    expect(version.match(/^\d+\.\d+/)).toBeTruthy();
});

test('should dispatch page.on(close) upon browser.close and reject evaluate', async ({ browserType }) => {
  const browser = await browserType.launch();
  const page = await browser.newPage();
  let closed = false;
  page.on('close', () => closed = true);
  const promise = page.evaluate(() => new Promise<void>(() => {})).catch(e => e);
  await browser.close();
  expect(closed).toBe(true);
  const error = await promise;
  expect(error.message).toContain(kTargetClosedErrorMessage);
});

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

import { contextTest as test, expect } from '../../config/browserTest';

test.use({
  launchOptions: async ({ launchOptions }, use) => {
    await use({ ...launchOptions, ignoreDefaultArgs: ['--disable-back-forward-cache'] });
  }
});

test('bindings should work after restoring from bfcache', async ({ page, server }) => {
  await page.exposeFunction('add', (a, b) => a + b);

  await page.goto(server.PREFIX + '/cached/bfcached.html');
  expect(await page.evaluate('window.add(1, 2)')).toBe(3);

  await page.setContent(`<a href='about:blank'}>click me</a>`);
  await page.click('a');

  await page.goBack({ waitUntil: 'commit' });
  await page.evaluate('window.didShow');
  expect(await page.evaluate('window.add(2, 3)')).toBe(5);
});

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

import { test as it, expect } from './pageTest';

const vues = {
  'vue2': '/reading-list/vue2.html',
  'vue3': '/reading-list/vue3.html',
};

for (const [name, url] of Object.entries(vues)) {
  it.describe(name, () => {
    it.beforeEach(async ({page, server}) => {
      await page.goto(server.PREFIX + url);
    });

    it('should work with single-root elements', async ({page}) => {
      expect(await page.$$eval(`vue=book-list`, els => els.length)).toBe(1);
      expect(await page.$$eval(`vue=book-item`, els => els.length)).toBe(3);
      expect(await page.$$eval(`vue=book-list >> vue=book-item`, els => els.length)).toBe(3);
      expect(await page.$$eval(`vue=book-item >> vue=book-list`, els => els.length)).toBe(0);

    });

    it('should work with multi-root elements (fragments)', async ({page}) => {
      it.skip(name === 'vue2', 'vue2 does not support fragments');
      expect(await page.$$eval(`vue=Root`, els => els.length)).toBe(5);
      expect(await page.$$eval(`vue=app-header`, els => els.length)).toBe(2);
      expect(await page.$$eval(`vue=new-book`, els => els.length)).toBe(2);
    });

    it('should not crash when there is no match', async ({page}) => {
      expect(await page.$$eval(`vue=apps`, els => els.length)).toBe(0);
      expect(await page.$$eval(`vue=book-li`, els => els.length)).toBe(0);
    });

    it('should compose', async ({page}) => {
      expect(await page.$eval(`vue=book-item >> text=Gatsby`, el => el.textContent.trim())).toBe('The Great Gatsby');
    });

  });
}


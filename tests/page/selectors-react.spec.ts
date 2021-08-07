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

const reacts = {
  'react15': '/reading-list/react15.html',
  'react16': '/reading-list/react16.html',
  'react17': '/reading-list/react17.html',
};

for (const [name, url] of Object.entries(reacts)) {
  it.describe(name, () => {
    it.beforeEach(async ({page, server}) => {
      await page.goto(server.PREFIX + url);
    });

    it('should work with single-root elements', async ({page}) => {
      expect(await page.$$eval(`react=BookList`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=BookItem`, els => els.length)).toBe(3);
      expect(await page.$$eval(`react=BookList >> react=BookItem`, els => els.length)).toBe(3);
      expect(await page.$$eval(`react=BookItem >> react=BookList`, els => els.length)).toBe(0);

    });

    it('should work with multi-root elements (fragments)', async ({page}) => {
      it.skip(name === 'react15', 'React 15 does not support fragments');
      expect(await page.$$eval(`react=App`, els => els.length)).toBe(5);
      expect(await page.$$eval(`react=AppHeader`, els => els.length)).toBe(2);
      expect(await page.$$eval(`react=NewBook`, els => els.length)).toBe(2);
    });

    it('should not crash when there is no match', async ({page}) => {
      expect(await page.$$eval(`react=Apps`, els => els.length)).toBe(0);
      expect(await page.$$eval(`react=BookLi`, els => els.length)).toBe(0);
    });

    it('should compose', async ({page}) => {
      expect(await page.$eval(`react=NewBook >> react=button`, el => el.textContent)).toBe('new book');
      expect(await page.$eval(`react=NewBook >> react=input`, el => el.tagName)).toBe('INPUT');
      expect(await page.$eval(`react=BookItem >> text=Gatsby`, el => el.textContent)).toBe('The Great Gatsby');
    });

  });
}


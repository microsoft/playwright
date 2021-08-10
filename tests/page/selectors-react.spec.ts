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
      expect(await page.$$eval(`react=App`, els => els.length)).toBe(14);
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

    it('should query by props combinations', async ({page}) => {
      expect(await page.$$eval(`react=BookItem[name="The Great Gatsby"]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=BookItem[name="the great gatsby" i]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=ColorButton[nested.index = 0]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=ColorButton[nested.nonexisting.index = 0]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`react=ColorButton[nested.value = 4.1]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=ColorButton[enabled = false]`, els => els.length)).toBe(4);
      expect(await page.$$eval(`react=ColorButton[enabled = true] `, els => els.length)).toBe(5);
      expect(await page.$$eval(`react=ColorButton[enabled = true][color = "red"]`, els => els.length)).toBe(2);
      expect(await page.$$eval(`react=ColorButton[enabled = true][color = "red"i][nested.index =  6]`, els => els.length)).toBe(1);
    });

    it('should exact match by props', async ({page}) => {
      expect(await page.$eval(`react=BookItem[name = "The Great Gatsby"]`, el => el.textContent)).toBe('The Great Gatsby');
      expect(await page.$$eval(`react=BookItem[name = "The Great Gatsby"]`, els => els.length)).toBe(1);
      // case sensetive by default
      expect(await page.$$eval(`react=BookItem[name = "the great gatsby"]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`react=BookItem[name = "the great gatsby" s]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`react=BookItem[name = "the great gatsby" S]`, els => els.length)).toBe(0);
      // case insensetive with flag
      expect(await page.$$eval(`react=BookItem[name = "the great gatsby" i]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=BookItem[name = "the great gatsby" I]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=BookItem[name = "  The Great Gatsby  "]`, els => els.length)).toBe(0);
    });

    it('should partially match by props', async ({page}) => {
      // Check partial matching
      expect(await page.$eval(`react=BookItem[name *= "Gatsby"]`, el => el.textContent)).toBe('The Great Gatsby');
      expect(await page.$$eval(`react=BookItem[name *= "Gatsby"]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=[name *= "Gatsby"]`, els => els.length)).toBe(1);

      expect(await page.$$eval(`react=BookItem[name = "Gatsby"]`, els => els.length)).toBe(0);
    });

    it('should support all string operators', async ({page}) => {
      expect(await page.$$eval(`react=ColorButton[color = "red"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`react=ColorButton[color |= "red"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`react=ColorButton[color $= "ed"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`react=ColorButton[color ^= "gr"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`react=ColorButton[color ~= "e"]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`react=BookItem[name ~= "gatsby" i]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`react=BookItem[name *= " gatsby" i]`, els => els.length)).toBe(1);
    });

    it('should support truthy querying', async ({page}) => {
      expect(await page.$$eval(`react=ColorButton[enabled]`, els => els.length)).toBe(5);
    });
  });
}


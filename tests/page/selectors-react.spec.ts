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
    it.beforeEach(async ({ page, server }) => {
      await page.goto(server.PREFIX + url);
    });

    it('should work with single-root elements', async ({ page }) => {
      expect(await page.$$eval(`_react=BookList`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=BookItem`, els => els.length)).toBe(3);
      expect(await page.$$eval(`_react=BookList >> _react=BookItem`, els => els.length)).toBe(3);
      expect(await page.$$eval(`_react=BookItem >> _react=BookList`, els => els.length)).toBe(0);

    });

    it('should work with multi-root elements (fragments)', async ({ page }) => {
      it.skip(name === 'react15', 'React 15 does not support fragments');
      expect(await page.$$eval(`_react=App`, els => els.length)).toBe(15);
      expect(await page.$$eval(`_react=AppHeader`, els => els.length)).toBe(2);
      expect(await page.$$eval(`_react=NewBook`, els => els.length)).toBe(2);
    });

    it('should not crash when there is no match', async ({ page }) => {
      expect(await page.$$eval(`_react=Apps`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=BookLi`, els => els.length)).toBe(0);
    });

    it('should compose', async ({ page }) => {
      expect(await page.$eval(`_react=NewBook >> _react=button`, el => el.textContent)).toBe('new book');
      expect(await page.$eval(`_react=NewBook >> _react=input`, el => el.tagName)).toBe('INPUT');
      expect(await page.$eval(`_react=BookItem >> text=Gatsby`, el => el.textContent)).toBe('The Great Gatsby');
    });

    it('should query by props combinations', async ({ page }) => {
      expect(await page.$$eval(`_react=BookItem[name="The Great Gatsby"]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=BookItem[name="the great gatsby" i]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=ColorButton[nested.index = 0]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=ColorButton[nested.nonexisting.index = 0]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=ColorButton[nested.index.nonexisting = 0]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=ColorButton[nested.index.nonexisting = 1]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=ColorButton[nested.value = 4.1]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=ColorButton[enabled = false]`, els => els.length)).toBe(4);
      expect(await page.$$eval(`_react=ColorButton[enabled = true] `, els => els.length)).toBe(5);
      expect(await page.$$eval(`_react=ColorButton[enabled = true][color = "red"]`, els => els.length)).toBe(2);
      expect(await page.$$eval(`_react=ColorButton[enabled = true][color = "red"i][nested.index =  6]`, els => els.length)).toBe(1);
    });

    it('should exact match by props', async ({ page }) => {
      expect(await page.$eval(`_react=BookItem[name = "The Great Gatsby"]`, el => el.textContent)).toBe('The Great Gatsby');
      expect(await page.$$eval(`_react=BookItem[name = "The Great Gatsby"]`, els => els.length)).toBe(1);
      // case sensetive by default
      expect(await page.$$eval(`_react=BookItem[name = "the great gatsby"]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=BookItem[name = "the great gatsby" s]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=BookItem[name = "the great gatsby" S]`, els => els.length)).toBe(0);
      // case insensetive with flag
      expect(await page.$$eval(`_react=BookItem[name = "the great gatsby" i]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=BookItem[name = "the great gatsby" I]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=BookItem[name = "  The Great Gatsby  "]`, els => els.length)).toBe(0);
    });

    it('should partially match by props', async ({ page }) => {
      // Check partial matching
      expect(await page.$eval(`_react=BookItem[name *= "Gatsby"]`, el => el.textContent)).toBe('The Great Gatsby');
      expect(await page.$$eval(`_react=BookItem[name *= "Gatsby"]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=[name *= "Gatsby"]`, els => els.length)).toBe(1);

      expect(await page.$$eval(`_react=BookItem[name = "Gatsby"]`, els => els.length)).toBe(0);
    });

    it('should support all string operators', async ({ page }) => {
      expect(await page.$$eval(`_react=ColorButton[color = "red"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`_react=ColorButton[color |= "red"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`_react=ColorButton[color $= "ed"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`_react=ColorButton[color ^= "gr"]`, els => els.length)).toBe(3);
      expect(await page.$$eval(`_react=ColorButton[color ~= "e"]`, els => els.length)).toBe(0);
      expect(await page.$$eval(`_react=BookItem[name ~= "gatsby" i]`, els => els.length)).toBe(1);
      expect(await page.$$eval(`_react=BookItem[name *= " gatsby" i]`, els => els.length)).toBe(1);
    });

    it('should support truthy querying', async ({ page }) => {
      expect(await page.$$eval(`_react=ColorButton[enabled]`, els => els.length)).toBe(5);
    });

    it('should support nested react trees', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCount(3);
      await page.evaluate(() => {
        // @ts-ignore
        mountNestedApp();
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCount(6);
    });

    it('should work with multiroot react', async ({ page }) => {
      await it.step('mount second root', async () => {
        await expect(page.locator(`_react=BookItem`)).toHaveCount(3);
        await page.evaluate(() => {
          const anotherRoot = document.createElement('div');
          anotherRoot.id = 'root2';
          document.body.append(anotherRoot);
          // @ts-ignore
          window.mountApp(anotherRoot);
        });
        await expect(page.locator(`_react=BookItem`)).toHaveCount(6);
      });

      await it.step('add a new book to second root', async () => {
        await page.locator('#root2 input').fill('newbook');
        await page.locator('#root2 >> text=new book').click();
        await expect(page.locator('css=#root >> _react=BookItem')).toHaveCount(3);
        await expect(page.locator('css=#root2 >> _react=BookItem')).toHaveCount(4);
      });
    });

    it('should work with multiroot react inside shadow DOM', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCount(3);
      await page.evaluate(() => {
        const anotherRoot = document.createElement('div');
        document.body.append(anotherRoot);
        const shadowRoot = anotherRoot.attachShadow({ mode: 'open' });
        // @ts-ignore
        window.mountApp(shadowRoot);
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCount(6);
    });
  });
}


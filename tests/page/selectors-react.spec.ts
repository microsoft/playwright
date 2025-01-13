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
  'react18': '/reading-list/react18.html',
};

for (const [name, url] of Object.entries(reacts)) {
  it.describe(name, () => {
    it.beforeEach(async ({ page, server }) => {
      await page.goto(server.PREFIX + url);
    });

    it('should work with single-root elements @smoke', async ({ page }) => {
      await expect(page.locator(`_react=BookList`)).toHaveCount(1);
      await expect(page.locator(`_react=BookItem`)).toHaveCount(3);
      await expect(page.locator(`_react=BookList >> _react=BookItem`)).toHaveCount(3);
      await expect(page.locator(`_react=BookItem >> _react=BookList`)).toHaveCount(0);
    });

    it('should work with multi-root elements (fragments)', async ({ page }) => {
      it.skip(name === 'react15', 'React 15 does not support fragments');
      await expect(page.locator(`_react=App`)).toHaveCount(15);
      await expect(page.locator(`_react=AppHeader`)).toHaveCount(2);
      await expect(page.locator(`_react=NewBook`)).toHaveCount(2);
    });

    it('should not crash when there is no match', async ({ page }) => {
      await expect(page.locator(`_react=Apps`)).toHaveCount(0);
      await expect(page.locator(`_react=BookLi`)).toHaveCount(0);
    });

    it('should compose', async ({ page }) => {
      await expect(page.locator(`_react=NewBook >> _react=button`)).toHaveText('new book');
      expect(await page.$eval(`_react=NewBook >> _react=input`, el => el.tagName)).toBe('INPUT');
      await expect(page.locator(`_react=BookItem >> text=Gatsby`)).toHaveText('The Great Gatsby');
    });

    it('should query by props combinations', async ({ page }) => {
      await expect(page.locator(`_react=BookItem[name="The Great Gatsby"]`)).toHaveCount(1);
      await expect(page.locator(`_react=BookItem[name="the great gatsby" i]`)).toHaveCount(1);
      await expect(page.locator(`_react=li[key="The Great Gatsby"]`)).toHaveCount(1);
      await expect(page.locator(`_react=ColorButton[nested.index = 0]`)).toHaveCount(1);
      await expect(page.locator(`_react=ColorButton[nested.nonexisting.index = 0]`)).toHaveCount(0);
      await expect(page.locator(`_react=ColorButton[nested.index.nonexisting = 0]`)).toHaveCount(0);
      await expect(page.locator(`_react=ColorButton[nested.index.nonexisting = 1]`)).toHaveCount(0);
      await expect(page.locator(`_react=ColorButton[nested.value = 4.1]`)).toHaveCount(1);
      await expect(page.locator(`_react=ColorButton[enabled = false]`)).toHaveCount(4);
      await expect(page.locator(`_react=ColorButton[enabled = true] `)).toHaveCount(5);
      await expect(page.locator(`_react=ColorButton[enabled = true][color = "red"]`)).toHaveCount(2);
      await expect(page.locator(`_react=ColorButton[enabled = true][color = "red"i][nested.index =  6]`)).toHaveCount(1);
    });

    it('should exact match by props', async ({ page }) => {
      await expect(page.locator(`_react=BookItem[name = "The Great Gatsby"]`)).toHaveText('The Great Gatsby');
      await expect(page.locator(`_react=BookItem[name = "The Great Gatsby"]`)).toHaveCount(1);
      // case sensitive by default
      await expect(page.locator(`_react=BookItem[name = "the great gatsby"]`)).toHaveCount(0);
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" s]`)).toHaveCount(0);
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" S]`)).toHaveCount(0);
      // case insensitive with flag
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" i]`)).toHaveCount(1);
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" I]`)).toHaveCount(1);
      await expect(page.locator(`_react=BookItem[name = "  The Great Gatsby  "]`)).toHaveCount(0);
    });

    it('should partially match by props', async ({ page }) => {
      // Check partial matching
      await expect(page.locator(`_react=BookItem[name *= "Gatsby"]`)).toHaveText('The Great Gatsby');
      await expect(page.locator(`_react=BookItem[name *= "Gatsby"]`)).toHaveCount(1);
      await expect(page.locator(`_react=[name *= "Gatsby"]`)).toHaveCount(1);

      await expect(page.locator(`_react=BookItem[name = "Gatsby"]`)).toHaveCount(0);
    });

    it('should support all string operators', async ({ page }) => {
      await expect(page.locator(`_react=ColorButton[color = "red"]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color |= "red"]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color $= "ed"]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color ^= "gr"]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color ~= "e"]`)).toHaveCount(0);
      await expect(page.locator(`_react=BookItem[name ~= "gatsby" i]`)).toHaveCount(1);
      await expect(page.locator(`_react=BookItem[name *= " gatsby" i]`)).toHaveCount(1);
    });

    it('should support regex', async ({ page }) => {
      await expect(page.locator(`_react=ColorButton[color = /red/]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color = /^red$/]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color = /RED/i]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color = /[pqr]ed/]`)).toHaveCount(3);
      await expect(page.locator(`_react=ColorButton[color = /[pq]ed/]`)).toHaveCount(0);
      await expect(page.locator(`_react=BookItem[name = /gat.by/i]`)).toHaveCount(1);
    });

    it('should support truthy querying', async ({ page }) => {
      await expect(page.locator(`_react=ColorButton[enabled]`)).toHaveCount(5);
    });

    it('should support nested react trees', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCount(3);
      await page.evaluate(() => {
        // @ts-ignore
        mountNestedApp();
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCount(6);
    });

    it('should work with react memo', async ({ page }) => {
      it.skip(name === 'react15' || name === 'react16', 'Class components dont support memo');
      await expect(page.locator(`_react=ButtonGrid`)).toHaveCount(9);
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

    it('should work with multiroot react after unmount', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCount(3);

      await page.evaluate(() => {
        const anotherRoot = document.createElement('div');
        document.body.append(anotherRoot);
        // @ts-ignore
        const newRoot = window.mountApp(anotherRoot);
        newRoot.unmount();
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCount(3);
    });
  });
}

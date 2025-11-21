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

import { test as it, expect as baseExpect } from './pageTest';
import type { Locator } from 'playwright-core';

const expect = baseExpect.extend({
  async toHaveCountError(locator: Locator, expected: number) {
    try {
      await expect(locator).toHaveCount(expected);
      if (!expected)
        return { pass: true, message: () => 'Locator has expected count of 0' };
      return {
        pass: false,
        message: () => `Querying locator ${locator.toString()} should throw, but it did not.`,
      };
    } catch (e) {
      const message = (e as Error).message;
      try {
        expect(message).toContain(`"_react" selector is not supported`);
        expect(message).toContain(`resolved to ${expected} element`);
      } catch (error) {
        return { pass: false, message: () => (error as Error).message };
      }
      return { pass: true, message: () => 'Error message is as expected' };
    }
  }
});

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
      await expect(page.locator(`_react=BookList`)).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(3);
      await expect(page.locator(`_react=BookList >> _react=BookItem`)).toHaveCountError(3);
      await expect(page.locator(`_react=BookItem >> _react=BookList`)).toHaveCountError(0);
    });

    it('should work with multi-root elements (fragments)', async ({ page }) => {
      it.skip(name === 'react15', 'React 15 does not support fragments');
      await expect(page.locator(`_react=App`)).toHaveCountError(15);
      await expect(page.locator(`_react=AppHeader`)).toHaveCountError(2);
      await expect(page.locator(`_react=NewBook`)).toHaveCountError(2);
    });

    it('should not crash when there is no match', async ({ page }) => {
      await expect(page.locator(`_react=Apps`)).toHaveCountError(0);
      await expect(page.locator(`_react=BookLi`)).toHaveCountError(0);
    });

    it('should compose', async ({ page }) => {
      await expect(page.locator(`_react=NewBook >> _react=button`).locator(':scope:has-text("new book")')).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem >> text=Gatsby`).locator(':scope:has-text("The Great Gatsby")')).toHaveCountError(1);
    });

    it('should query by props combinations', async ({ page }) => {
      await expect(page.locator(`_react=BookItem[name="The Great Gatsby"]`)).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem[name="the great gatsby" i]`)).toHaveCountError(1);
      await expect(page.locator(`_react=li[key="The Great Gatsby"]`)).toHaveCountError(1);
      await expect(page.locator(`_react=ColorButton[nested.index = 0]`)).toHaveCountError(1);
      await expect(page.locator(`_react=ColorButton[nested.nonexisting.index = 0]`)).toHaveCountError(0);
      await expect(page.locator(`_react=ColorButton[nested.index.nonexisting = 0]`)).toHaveCountError(0);
      await expect(page.locator(`_react=ColorButton[nested.index.nonexisting = 1]`)).toHaveCountError(0);
      await expect(page.locator(`_react=ColorButton[nested.value = 4.1]`)).toHaveCountError(1);
      await expect(page.locator(`_react=ColorButton[enabled = false]`)).toHaveCountError(4);
      await expect(page.locator(`_react=ColorButton[enabled = true] `)).toHaveCountError(5);
      await expect(page.locator(`_react=ColorButton[enabled = true][color = "red"]`)).toHaveCountError(2);
      await expect(page.locator(`_react=ColorButton[enabled = true][color = "red"i][nested.index =  6]`)).toHaveCountError(1);
    });

    it('should exact match by props', async ({ page }) => {
      await expect(page.locator(`_react=BookItem[name = "The Great Gatsby"]`).locator(':scope:has-text("The Great Gatsby")')).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem[name = "The Great Gatsby"]`)).toHaveCountError(1);
      // case sensitive by default
      await expect(page.locator(`_react=BookItem[name = "the great gatsby"]`)).toHaveCountError(0);
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" s]`)).toHaveCountError(0);
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" S]`)).toHaveCountError(0);
      // case insensitive with flag
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" i]`)).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem[name = "the great gatsby" I]`)).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem[name = "  The Great Gatsby  "]`)).toHaveCountError(0);
    });

    it('should partially match by props', async ({ page }) => {
      // Check partial matching
      await expect(page.locator(`_react=BookItem[name *= "Gatsby"]`).locator(':scope:has-text("The Great Gatsby")')).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem[name *= "Gatsby"]`)).toHaveCountError(1);
      await expect(page.locator(`_react=[name *= "Gatsby"]`)).toHaveCountError(1);

      await expect(page.locator(`_react=BookItem[name = "Gatsby"]`)).toHaveCountError(0);
    });

    it('should support all string operators', async ({ page }) => {
      await expect(page.locator(`_react=ColorButton[color = "red"]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color |= "red"]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color $= "ed"]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color ^= "gr"]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color ~= "e"]`)).toHaveCountError(0);
      await expect(page.locator(`_react=BookItem[name ~= "gatsby" i]`)).toHaveCountError(1);
      await expect(page.locator(`_react=BookItem[name *= " gatsby" i]`)).toHaveCountError(1);
    });

    it('should support regex', async ({ page }) => {
      await expect(page.locator(`_react=ColorButton[color = /red/]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color = /^red$/]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color = /RED/i]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color = /[pqr]ed/]`)).toHaveCountError(3);
      await expect(page.locator(`_react=ColorButton[color = /[pq]ed/]`)).toHaveCountError(0);
      await expect(page.locator(`_react=BookItem[name = /gat.by/i]`)).toHaveCountError(1);
    });

    it('should support truthy querying', async ({ page }) => {
      await expect(page.locator(`_react=ColorButton[enabled]`)).toHaveCountError(5);
    });

    it('should support nested react trees', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(3);
      await page.evaluate(() => {
        // @ts-ignore
        mountNestedApp();
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(6);
    });

    it('should work with react memo', async ({ page }) => {
      it.skip(name === 'react15' || name === 'react16', 'Class components dont support memo');
      await expect(page.locator(`_react=ButtonGrid`)).toHaveCountError(9);
    });

    it('should work with multiroot react', async ({ page }) => {
      await it.step('mount second root', async () => {
        await expect(page.locator(`_react=BookItem`)).toHaveCountError(3);
        await page.evaluate(() => {
          const anotherRoot = document.createElement('div');
          anotherRoot.id = 'root2';
          document.body.append(anotherRoot);
          // @ts-ignore
          window.mountApp(anotherRoot);
        });
        await expect(page.locator(`_react=BookItem`)).toHaveCountError(6);
      });

      await it.step('add a new book to second root', async () => {
        await page.locator('#root2 input').fill('newbook');
        await page.locator('#root2 >> text=new book').click();
        await expect(page.locator('css=#root >> _react=BookItem')).toHaveCountError(3);
        await expect(page.locator('css=#root2 >> _react=BookItem')).toHaveCountError(4);
      });
    });

    it('should work with multiroot react inside shadow DOM', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(3);
      await page.evaluate(() => {
        const anotherRoot = document.createElement('div');
        document.body.append(anotherRoot);
        const shadowRoot = anotherRoot.attachShadow({ mode: 'open' });
        // @ts-ignore
        window.mountApp(shadowRoot);
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(6);
    });

    it('should work with multiroot react after unmount', async ({ page }) => {
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(3);

      await page.evaluate(() => {
        const anotherRoot = document.createElement('div');
        document.body.append(anotherRoot);
        // @ts-ignore
        const newRoot = window.mountApp(anotherRoot);
        newRoot.unmount();
      });
      await expect(page.locator(`_react=BookItem`)).toHaveCountError(3);
    });
  });
}

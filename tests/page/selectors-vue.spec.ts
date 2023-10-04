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
    it.beforeEach(async ({ page, server }) => {
      await page.goto(server.PREFIX + url);
    });

    it('should work with single-root elements @smoke', async ({ page }) => {
      await expect(page.locator(`_vue=book-list`)).toHaveCount(1);
      // count() was not working, see: https://github.com/microsoft/playwright/issues/12887
      expect(await page.locator(`_vue=book-list`).count()).toBe(1);
      await expect(page.locator(`_vue=book-list`)).toHaveCount(1);
      await expect(page.locator(`_vue=book-item`)).toHaveCount(3);
      expect(await page.locator(`_vue=book-item`).count()).toBe(3);
      await expect(page.locator(`_vue=book-item`)).toHaveCount(3);
      await expect(page.locator(`_vue=book-list >> _vue=book-item`)).toHaveCount(3);
      expect(await page.locator(`_vue=book-list >> _vue=book-item`).count()).toBe(3);
      await expect(page.locator(`_vue=book-item >> _vue=book-list`)).toHaveCount(0);
    });

    it('should work with multi-root elements (fragments)', async ({ page }) => {
      it.skip(name === 'vue2', 'vue2 does not support fragments');
      await expect(page.locator(`_vue=Root`)).toHaveCount(15);
      await expect(page.locator(`_vue=app-header`)).toHaveCount(2);
      await expect(page.locator(`_vue=new-book`)).toHaveCount(2);
    });

    it('should not crash when there is no match', async ({ page }) => {
      await expect(page.locator(`_vue=apps`)).toHaveCount(0);
      await expect(page.locator(`_vue=book-li`)).toHaveCount(0);
    });

    it('should compose', async ({ page }) => {
      await expect(page.locator(`_vue=book-item >> text=Gatsby`)).toHaveText('The Great Gatsby');
    });

    it('should query by props combinations', async ({ page }) => {
      await expect(page.locator(`_vue=book-item[name="The Great Gatsby"]`)).toHaveCount(1);
      await expect(page.locator(`_vue=book-item[name="the great gatsby" i]`)).toHaveCount(1);
      await expect(page.locator(`_vue=color-button[nested.index = 0]`)).toHaveCount(1);
      await expect(page.locator(`_vue=color-button[nested.nonexisting.index = 0]`)).toHaveCount(0);
      await expect(page.locator(`_vue=color-button[nested.index.nonexisting = 0]`)).toHaveCount(0);
      await expect(page.locator(`_vue=color-button[nested.index.nonexisting = 1]`)).toHaveCount(0);
      await expect(page.locator(`_vue=color-button[nested.value = 4.1]`)).toHaveCount(1);
      await expect(page.locator(`_vue=color-button[enabled = false]`)).toHaveCount(4);
      await expect(page.locator(`_vue=color-button[enabled = true] `)).toHaveCount(5);
      await expect(page.locator(`_vue=color-button[enabled = true][color = "red"]`)).toHaveCount(2);
      await expect(page.locator(`_vue=color-button[enabled = true][color = "red"i][nested.index =  6]`)).toHaveCount(1);
    });

    it('should exact match by props', async ({ page }) => {
      await expect(page.locator(`_vue=book-item[name = "The Great Gatsby"]`)).toHaveText('The Great Gatsby');
      await expect(page.locator(`_vue=book-item[name = "The Great Gatsby"]`)).toHaveCount(1);
      // case sensitive by default
      await expect(page.locator(`_vue=book-item[name = "the great gatsby"]`)).toHaveCount(0);
      await expect(page.locator(`_vue=book-item[name = "the great gatsby" s]`)).toHaveCount(0);
      await expect(page.locator(`_vue=book-item[name = "the great gatsby" S]`)).toHaveCount(0);
      // case insensitive with flag
      await expect(page.locator(`_vue=book-item[name = "the great gatsby" i]`)).toHaveCount(1);
      await expect(page.locator(`_vue=book-item[name = "the great gatsby" I]`)).toHaveCount(1);
      await expect(page.locator(`_vue=book-item[name = "  The Great Gatsby  "]`)).toHaveCount(0);
    });

    it('should partially match by props', async ({ page }) => {
      // Check partial matching
      await expect(page.locator(`_vue=book-item[name *= "Gatsby"]`)).toHaveText('The Great Gatsby');
      await expect(page.locator(`_vue=book-item[name *= "Gatsby"]`)).toHaveCount(1);
      await expect(page.locator(`_vue=[name *= "Gatsby"]`)).toHaveCount(1);

      await expect(page.locator(`_vue=book-item[name = "Gatsby"]`)).toHaveCount(0);
    });

    it('should support all string operators', async ({ page }) => {
      await expect(page.locator(`_vue=color-button[color = "red"]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color |= "red"]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color $= "ed"]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color ^= "gr"]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color ~= "e"]`)).toHaveCount(0);
      await expect(page.locator(`_vue=book-item[name ~= "gatsby" i]`)).toHaveCount(1);
      await expect(page.locator(`_vue=book-item[name *= " gatsby" i]`)).toHaveCount(1);
    });

    it('should support regex', async ({ page }) => {
      await expect(page.locator(`_vue=color-button[color = /red/]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color = /^red$/]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color = /RED/i]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color = /[pqr]ed/]`)).toHaveCount(3);
      await expect(page.locator(`_vue=color-button[color = /[pq]ed/]`)).toHaveCount(0);
      await expect(page.locator(`_vue=book-item[name = /gat.by/i]`)).toHaveCount(1);
    });

    it('should support truthy querying', async ({ page }) => {
      await expect(page.locator(`_vue=color-button[enabled]`)).toHaveCount(5);
    });

    it('should support nested vue trees', async ({ page }) => {
      await expect(page.locator(`_vue=book-item`)).toHaveCount(3);
      await page.evaluate(() => {
        // @ts-ignore
        mountNestedApp();
      });
      await expect(page.locator(`_vue=book-item`)).toHaveCount(6);
    });

    it('should work with multiroot react', async ({ page }) => {
      await it.step('mount second root', async () => {
        await expect(page.locator(`_vue=book-item`)).toHaveCount(3);
        await page.evaluate(() => {
          const anotherRoot = document.createElement('div');
          anotherRoot.id = 'root2';
          anotherRoot.append(document.createElement('div'));
          document.body.append(anotherRoot);
          // @ts-ignore
          window.mountApp(anotherRoot.querySelector('div'));
        });
        await expect(page.locator(`_vue=book-item`)).toHaveCount(6);
      });

      await it.step('add a new book to second root', async () => {
        await page.locator('#root2 input').fill('newbook');
        await page.locator('#root2 >> text=new book').click();
        await expect(page.locator('css=#root >> _vue=book-item')).toHaveCount(3);
        await expect(page.locator('css=#root2 >> _vue=book-item')).toHaveCount(4);
      });
    });

    it('should work with multiroot vue inside shadow DOM', async ({ page }) => {
      await expect(page.locator(`_vue=book-item`)).toHaveCount(3);
      await page.evaluate(vueName => {
        const anotherRoot = document.createElement('div');
        document.body.append(anotherRoot);
        const shadowRoot = anotherRoot.attachShadow({ mode: 'open' });
        if (vueName === 'vue2') {
          // Vue2 cannot be mounted in shadow root directly.
          const div = document.createElement('div');
          shadowRoot.append(div);
          // @ts-ignore
          window.mountApp(div);
        } else {
          // @ts-ignore
          window.mountApp(shadowRoot);
        }
      }, name);
      await expect(page.locator(`_vue=book-item`)).toHaveCount(6);
    });
  });
}


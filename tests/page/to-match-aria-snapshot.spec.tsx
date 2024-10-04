/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { test, expect, role as x } from './pageTest';

test('should match', async ({ page }) => {
  await page.setContent(`<h1>title</h1>`);
  await expect(page.locator('body')).toMatchAriaSnapshot(<>
    <x.heading>title</x.heading>
  </>);
});

test('should match in list', async ({ page }) => {
  await page.setContent(`
    <h1>title</h1>
    <h1>title 2</h1>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(<>
    <x.heading>title</x.heading>
  </>);
});

test('should match list with accessible name', async ({ page }) => {
  await page.setContent(`
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
    </ul>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(<>
    <x.list name='my list'>
      <x.listitem>one</x.listitem>
      <x.listitem>two</x.listitem>
    </x.list>
  </>);
});

test('should match deep item', async ({ page }) => {
  await page.setContent(`
    <div>
      <h1>title</h1>
      <h1>title 2</h1>
    </div>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(<>
    <x.heading>title</x.heading>
  </>);
});

test('should match complex', async ({ page }) => {
  await page.setContent(`
    <ul>
      <li>
        <a href='about:blank'>link</a>
      </li>
    </ul>
  `);
  await expect(page.locator('body')).toMatchAriaSnapshot(<>
    <x.list>
      <x.listitem>
        <x.link>link</x.link>
      </x.listitem>
    </x.list>
  </>);
});

test('should match regex', async ({ page }) => {
  await page.setContent(`<h1>Issues 12</h1>`);
  await expect(page.locator('body')).toMatchAriaSnapshot(<>
    <x.heading>Issues {x.match(/\d+/)}</x.heading>
  </>);
});

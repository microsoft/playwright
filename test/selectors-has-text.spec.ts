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

import { it, expect } from './playwright.fixtures';

it('query', async ({page}) => {
  await page.setContent(`<div>yo</div><div>ya</div><div>\nye  </div>`);
  expect(await page.$eval(`has-text=ya`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`has-text="ya"`, e => e.outerHTML)).toBe('<div>ya</div>');
  expect(await page.$eval(`has-text=ye`, e => e.outerHTML)).toBe('<div>\nye  </div>');
});

it('query span across nodes', async ({page}) => {
  page.on('console', console.log);
  await page.setContent(`
    <div>abc</div>
    <div>
      <div>Hello</div> <div>World</div>
    </div>`);
  expect(await page.$eval(`has-text=Hello World`, e => e.outerHTML)).toBe(`<div>
      <div>Hello</div> <div>World</div>
    </div>`);
});

it('query normalize space', async ({page}) => {
  page.on('console', console.log);
  await page.setContent(`
    <div>abc</div>
    <div>
      <div>Hello </div>
      <div>World</div>
    </div>`);
  expect(await page.$eval(`has-text=Hello World`, e => e.outerHTML)).toBe(`<div>
      <div>Hello </div>
      <div>World</div>
    </div>`);
});

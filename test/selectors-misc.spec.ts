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

import { it, expect } from './fixtures';

it('should work for open shadow roots', async ({page, server}) => {
  await page.goto(server.PREFIX + '/deep-shadow.html');
  expect(await page.$eval(`id=target`, e => e.textContent)).toBe('Hello from root2');
  expect(await page.$eval(`data-testid=foo`, e => e.textContent)).toBe('Hello from root1');
  expect(await page.$$eval(`data-testid=foo`, els => els.length)).toBe(3);
  expect(await page.$(`id:light=target`)).toBe(null);
  expect(await page.$(`data-testid:light=foo`)).toBe(null);
  expect(await page.$$(`data-testid:light=foo`)).toEqual([]);
});

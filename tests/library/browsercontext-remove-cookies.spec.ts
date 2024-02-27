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

import { contextTest as it, expect } from '../config/browserTest';

it('should remove cookies', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await context.addCookies([{
    url: server.EMPTY_PAGE,
    name: 'cookie1',
    value: '1'
  },
  {
    url: server.EMPTY_PAGE,
    name: 'cookie2',
    value: '2'
  },
  {
    url: server.EMPTY_PAGE,
    name: 'cookie3',
    value: '3'
  }]);
  expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2; cookie3=3');
  await context.removeCookies(['cookie1', 'cookie2']);
  expect(await page.evaluate('document.cookie')).toBe('cookie3=3');
  await page.reload();
  expect(await page.evaluate('document.cookie')).toBe('cookie3=3');
  await context.removeCookies('cookie3');
  expect(await page.evaluate('document.cookie')).toBe('');
  await page.reload();
  expect(await page.evaluate('document.cookie')).toBe('');
});


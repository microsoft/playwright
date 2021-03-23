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

it('should override extra headers from browser context', async ({browser, server}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'fOo': 'bAr', 'baR': 'foO' },
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({
    'Foo': 'Bar'
  });
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  await context.close();
  expect(request.headers['foo']).toBe('Bar');
  expect(request.headers['bar']).toBe('foO');
});

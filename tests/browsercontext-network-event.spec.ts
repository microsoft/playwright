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

import { browserTest as it, expect } from './config/browserTest';

it('BrowserContext.Events.Request', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  context.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
  expect(requests[0].url()).toBe(server.EMPTY_PAGE);
  expect(requests[0].resourceType()).toBe('document');
  expect(requests[0].method()).toBe('GET');
  expect(await requests[0].response()).toBeTruthy();
  expect(requests[0].frame() === page.mainFrame()).toBe(true);
  expect(requests[0].frame().url()).toBe(server.EMPTY_PAGE);
});

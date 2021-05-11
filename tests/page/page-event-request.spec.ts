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
import { attachFrame } from '../config/utils';

it('should fire for navigation requests', async ({page, server}) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
});

it('should fire for iframes', async ({page, server}) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  expect(requests.length).toBe(2);
});

it('should fire for fetches', async ({page, server}) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => fetch('/empty.html'));
  expect(requests.length).toBe(2);
});

it('should report requests and responses handled by service worker', async ({page, server, isAndroid}) => {
  it.fixme(isAndroid);

  await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
  await page.evaluate(() => window['activationPromise']);
  const [swResponse, request] = await Promise.all([
    page.evaluate(() => window['fetchDummy']('foo')),
    page.waitForEvent('request'),
  ]);
  expect(swResponse).toBe('responseFromServiceWorker:foo');
  expect(request.url()).toBe(server.PREFIX + '/serviceworkers/fetchdummy/foo');
  const response = await request.response();
  expect(response.url()).toBe(server.PREFIX + '/serviceworkers/fetchdummy/foo');
  expect(await response.text()).toBe('responseFromServiceWorker:foo');
});

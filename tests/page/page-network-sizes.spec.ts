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

it('should set bodySize and headersSize', async ({page, server,browserName, platform}) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForEvent('request'),
    page.evaluate(() => fetch('./get', { method: 'POST', body: '12345'}).then(r => r.text())),
  ]);
  await (await request.response()).finished();
  const sizes = await request.sizes();
  expect(sizes.requestBodySize).toBe(5);
  expect(sizes.requestHeadersSize).toBeGreaterThanOrEqual(250);
});

it('should set bodySize to 0 if there was no body', async ({page, server,browserName, platform}) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForEvent('request'),
    page.evaluate(() => fetch('./get').then(r => r.text())),
  ]);
  const sizes = await request.sizes();
  expect(sizes.requestBodySize).toBe(0);
  expect(sizes.requestHeadersSize).toBeGreaterThanOrEqual(200);
});

it('should set bodySize, headersSize, and transferSize', async ({page, server, browserName, platform}) => {
  server.setRoute('/get', (req, res) => {
    // In Firefox, |fetch| will be hanging until it receives |Content-Type| header
    // from server.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('abc134');
  });
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForEvent('response'),
    page.evaluate(async () => fetch('./get').then(r => r.text())),
    server.waitForRequest('/get'),
  ]);
  const sizes = await response.request().sizes();
  expect(sizes.responseBodySize).toBe(6);
  expect(sizes.responseHeadersSize).toBeGreaterThanOrEqual(100);
  expect(sizes.responseTransferSize).toBeGreaterThanOrEqual(100);
});

it('should set bodySize to 0 when there was no response body', async ({page, server, browserName, platform}) => {
  const response = await page.goto(server.EMPTY_PAGE);
  const sizes = await response.request().sizes();
  expect(sizes.responseBodySize).toBe(0);
  expect(sizes.responseHeadersSize).toBeGreaterThanOrEqual(150);
  expect(sizes.responseTransferSize).toBeGreaterThanOrEqual(160);
});

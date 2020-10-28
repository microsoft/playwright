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

import { expect, it } from './fixtures';

it('should work', async ({ page, server }) => {
  const [request] = await Promise.all([
    page.waitForEvent('requestfinished'),
    page.goto(server.EMPTY_PAGE)
  ]);
  const timing = request.timing();
  expect(timing.domainLookupStart).toBeGreaterThanOrEqual(0);
  expect(timing.domainLookupEnd).toBeGreaterThanOrEqual(timing.domainLookupStart);
  expect(timing.connectStart).toBeGreaterThanOrEqual(timing.domainLookupEnd);
  expect(timing.secureConnectionStart).toBe(-1);
  expect(timing.connectEnd).toBeGreaterThan(timing.secureConnectionStart);
  expect(timing.requestStart).toBeGreaterThanOrEqual(timing.connectEnd);
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  expect(timing.responseEnd).toBeLessThan(10000);
});

it('should work for subresource', async ({ page, server, isWindows, isWebKit }) => {
  const requests = [];
  page.on('requestfinished', request => requests.push(request));
  await page.goto(server.PREFIX + '/one-style.html');
  expect(requests.length).toBe(2);
  const timing = requests[1].timing();
  if (isWebKit && isWindows) {
    // Curl does not reuse connections.
    expect(timing.domainLookupStart).toBeGreaterThanOrEqual(0);
    expect(timing.domainLookupEnd).toBeGreaterThanOrEqual(timing.domainLookupStart);
    expect(timing.connectStart).toBeGreaterThanOrEqual(timing.domainLookupEnd);
    expect(timing.secureConnectionStart).toBe(-1);
    expect(timing.connectEnd).toBeGreaterThan(timing.secureConnectionStart);
  } else {
    expect(timing.domainLookupStart === 0 || timing.domainLookupStart === -1).toBeTruthy();
    expect(timing.domainLookupEnd).toBe(-1);
    expect(timing.connectStart).toBe(-1);
    expect(timing.secureConnectionStart).toBe(-1);
    expect(timing.connectEnd).toBe(-1);
  }
  expect(timing.requestStart).toBeGreaterThanOrEqual(0);
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  expect(timing.responseEnd).toBeLessThan(10000);
});

it('should work for SSL', async ({ browser, httpsServer, isMac, isWebKit }) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const [request] = await Promise.all([
    page.waitForEvent('requestfinished'),
    page.goto(httpsServer.EMPTY_PAGE)
  ]);
  const timing = request.timing();
  if (!(isWebKit && isMac)) {
    expect(timing.domainLookupStart).toBeGreaterThanOrEqual(0);
    expect(timing.domainLookupEnd).toBeGreaterThanOrEqual(timing.domainLookupStart);
    expect(timing.connectStart).toBeGreaterThanOrEqual(timing.domainLookupEnd);
    expect(timing.secureConnectionStart).toBeGreaterThan(timing.connectStart);
    expect(timing.connectEnd).toBeGreaterThan(timing.secureConnectionStart);
    expect(timing.requestStart).toBeGreaterThanOrEqual(timing.connectEnd);
  }
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  expect(timing.responseEnd).toBeLessThan(10000);
  await page.close();
});

it('should work for redirect', (test, { browserName }) => {
  test.fixme(browserName === 'webkit', `In WebKit, redirects don't carry the timing info`);
}, async ({ page, server }) => {
  server.setRedirect('/foo.html', '/empty.html');
  const responses = [];
  page.on('response', response => responses.push(response));
  await page.goto(server.PREFIX + '/foo.html');
  await Promise.all(responses.map(r => r.finished()));

  expect(responses.length).toBe(2);
  expect(responses[0].url()).toBe(server.PREFIX + '/foo.html');
  expect(responses[1].url()).toBe(server.PREFIX + '/empty.html');

  const timing1 = responses[0].request().timing();
  expect(timing1.domainLookupStart).toBeGreaterThanOrEqual(0);
  expect(timing1.domainLookupEnd).toBeGreaterThanOrEqual(timing1.domainLookupStart);
  expect(timing1.connectStart).toBeGreaterThanOrEqual(timing1.domainLookupEnd);
  expect(timing1.secureConnectionStart).toBe(-1);
  expect(timing1.connectEnd).toBeGreaterThan(timing1.secureConnectionStart);
  expect(timing1.requestStart).toBeGreaterThanOrEqual(timing1.connectEnd);
  expect(timing1.responseStart).toBeGreaterThan(timing1.requestStart);
  expect(timing1.responseEnd).toBeGreaterThanOrEqual(timing1.responseStart);
  expect(timing1.responseEnd).toBeLessThan(10000);

  const timing2 = responses[1].request().timing();
  expect(timing2.domainLookupStart).toBe(-1);
  expect(timing2.domainLookupEnd).toBe(-1);
  expect(timing2.connectStart).toBe(-1);
  expect(timing2.secureConnectionStart).toBe(-1);
  expect(timing2.connectEnd).toBe(-1);
  expect(timing2.requestStart).toBeGreaterThanOrEqual(0);
  expect(timing2.responseStart).toBeGreaterThan(timing2.requestStart);
  expect(timing2.responseEnd).toBeGreaterThanOrEqual(timing2.responseStart);
  expect(timing2.responseEnd).toBeLessThan(10000);
});

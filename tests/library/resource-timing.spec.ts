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

import { browserTest as it, expect } from '../config/browserTest';

it('should work @smoke', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  const [request] = await Promise.all([
    page.waitForEvent('requestfinished'),
    page.goto(server.EMPTY_PAGE)
  ]);
  const timing = request.timing();
  verifyConnectionTimingConsistency(timing);
  expect(timing.requestStart).toBeGreaterThanOrEqual(timing.connectEnd);
  expect(timing.responseStart).toBeGreaterThanOrEqual(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  expect(timing.responseEnd).toBeLessThan(10000);
  await context.close();
});

it('should work for subresource', async ({ contextFactory, server, browserName, platform }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20654' });
  it.fixme(browserName === 'webkit' && platform === 'win32', 'responseStart is wrong due upstream webkit/libcurl bug');
  const context = await contextFactory();
  const page = await context.newPage();
  const requests = [];
  page.on('requestfinished', request => requests.push(request));
  await page.goto(server.PREFIX + '/one-style.html');
  expect(requests.length).toBe(2);
  const timing = requests[1].timing();
  verifyConnectionTimingConsistency(timing);
  expect(timing.requestStart).toBeGreaterThanOrEqual(0);
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  expect(timing.responseEnd).toBeLessThan(10000);
  await context.close();
});

it('should work for SSL', async ({ browser, httpsServer, browserName, platform }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20654' });
  it.fixme(browserName === 'webkit' && platform === 'win32', 'responseStart is wrong due upstream webkit/libcurl bug');
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const [request] = await Promise.all([
    page.waitForEvent('requestfinished'),
    page.goto(httpsServer.EMPTY_PAGE)
  ]);
  const timing = request.timing();
  verifyConnectionTimingConsistency(timing);
  expect(timing.requestStart).toBeGreaterThanOrEqual(timing.connectEnd);
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  expect(timing.responseEnd).toBeLessThan(10000);
  await page.close();
});

it('should work for redirect', async ({ contextFactory, browserName, server }) => {
  it.fixme(browserName === 'webkit', `In WebKit, redirects don't carry the timing info`);

  const context = await contextFactory();
  const page = await context.newPage();
  server.setRedirect('/foo.html', '/empty.html');
  const responses = [];
  page.on('response', response => responses.push(response));
  await page.goto(server.PREFIX + '/foo.html');
  await Promise.all(responses.map(r => r.finished()));

  expect(responses.length).toBe(2);
  expect(responses[0].url()).toBe(server.PREFIX + '/foo.html');
  expect(responses[1].url()).toBe(server.PREFIX + '/empty.html');

  const timing1 = responses[0].request().timing();
  verifyConnectionTimingConsistency(timing1);
  expect(timing1.requestStart).toBeGreaterThanOrEqual(timing1.connectEnd);
  expect(timing1.responseStart).toBeGreaterThan(timing1.requestStart);
  expect(timing1.responseEnd).toBeGreaterThanOrEqual(timing1.responseStart);
  expect(timing1.responseEnd).toBeLessThan(10000);

  const timing2 = responses[1].request().timing();
  verifyConnectionTimingConsistency(timing2);
  expect(timing2.requestStart).toBeGreaterThanOrEqual(0);
  expect(timing2.responseStart).toBeGreaterThan(timing2.requestStart);
  expect(timing2.responseEnd).toBeGreaterThanOrEqual(timing2.responseStart);
  expect(timing2.responseEnd).toBeLessThan(10000);

  await context.close();
});

it('should work when serving from memory cache', async ({ contextFactory, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright-java/issues/1080' });
  it.fixme(browserName === 'firefox', 'Response event is not fired in Firefox');
  server.setRoute('/one-style.css', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=10031518'
    });
    res.end(`body { background: red }`);
  });

  const context = await contextFactory();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/one-style.html');
  const [response] = await Promise.all([
    page.waitForResponse('**/one-style.css'),
    page.reload()
  ]);
  await response.finished();

  const timing = response.request().timing();
  verifyConnectionTimingConsistency(timing);

  expect(timing.responseStart).toBe(timing.responseEnd);
  expect(timing.responseEnd).toBeLessThan(1000);
  await context.close();
});

function verifyTimingValue(value: number, previous: number) {
  expect(value === -1 || value > 0 && value >= previous);
}

function verifyConnectionTimingConsistency(timing) {
  verifyTimingValue(timing.domainLookupStart, -1);
  verifyTimingValue(timing.domainLookupEnd, timing.domainLookupStart);
  verifyTimingValue(timing.connectStart, timing.domainLookupEnd);
  verifyTimingValue(timing.secureConnectionStart, timing.connectStart);
  verifyTimingValue(timing.connectEnd, timing.secureConnectionStart);
}

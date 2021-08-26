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

it('should work for resource', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  const [request] = await Promise.all([
    page.waitForEvent('requestfinished'),
    page.goto(server.EMPTY_PAGE)
  ]);
  const timing = request.timing();
  verifyConnectionTimingConsistency(timing);
  expect(timing.startTime).toBeGreaterThanOrEqual(request.issueTime());
  expect(timing.requestStart).toBeGreaterThanOrEqual(timing.connectEnd);
  expect(timing.responseStart).toBeGreaterThanOrEqual(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  await context.close();
});

it('should account for blocked and queued time', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  const requests = [];
  context.on('requestfinished', request => requests.push(request));

  const toMilliseconds = (time: number) => (time === -1 || time < 0 ? -1 : time * 1000);
  const firstPositive = (numbers: number[]) => {
    for (const num of numbers) {
      if (num > 0)
        return num;
    }
    return -1;
  };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  server.setRoute('/chunked*', async (_, res) => {
    res.writeHead(200, {
      'connection': 'close',
      'cache-control': 'no-cache, no-store, must-revalidate'
    });
    await delay(100);
    res.write('j');
    await delay(100);
    res.end('s');
  });
  server.setRoute('/blocked', async (_, res) => {
    res.setHeader('content-type', 'text/html');
    // Only 6 concurrent req are done by chrome to same domain
    res.write(`
    <script src=${server.PREFIX}/chunked*?ab=1></script>
    <script src=${server.PREFIX}/chunked*?ab=2></script>
    <script src=${server.PREFIX}/chunked*?ab=3></script>
    <script src=${server.PREFIX}/chunked*?ab=4></script>
    <script src=${server.PREFIX}/chunked*?ab=5></script>
    <script src=${server.PREFIX}/chunked*?ab=6></script>
    <script src=${server.PREFIX}/chunked*?ab=7></script>
    <script src=${server.PREFIX}/chunked*?ab=8></script>
    <script src=${server.PREFIX}/chunked*?ab=9></script>
    <script src=${server.PREFIX}/chunked*?ab=10></script>
    <script src=${server.PREFIX}/chunked*?ab=11></script>
    <script src=${server.PREFIX}/chunked*?ab=12></script>
    `);
    res.end(`<script src=${server.PREFIX}/chunked*?ab=13></script>`);
  });
  await page.goto(server.PREFIX + '/blocked', {
    waitUntil: 'networkidle'
  });

  const blockedTime = requests.map(req => {
    const timing = req.timing();
    const blockingEnd =
    firstPositive([timing.domainLookupStart, timing.connectStart, timing.requestStart]) || 0;
    return toMilliseconds(blockingEnd - timing.startTime);
  });
  const queueTime = requests.map(req => {
    const timing = req.timing();
    return toMilliseconds(timing.startTime - req.issueTime());
  });
  console.log('BlockedTime', blockedTime);
  console.log('queueTime', queueTime);
  await context.close();
});

it('should work for subresource', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  const requests = [];
  page.on('requestfinished', request => requests.push(request));
  await page.goto(server.PREFIX + '/one-style.html');
  expect(requests.length).toBe(2);
  const timing = requests[1].timing();
  verifyConnectionTimingConsistency(timing);
  expect(timing.startTime).toBeGreaterThanOrEqual(requests[1].issueTime());
  expect(timing.requestStart).toBeGreaterThanOrEqual(0);
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
  await context.close();
});

it('should work for SSL', async ({ browser, httpsServer }) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const [request] = await Promise.all([
    page.waitForEvent('requestfinished'),
    page.goto(httpsServer.EMPTY_PAGE)
  ]);
  const timing = request.timing();
  verifyConnectionTimingConsistency(timing);
  expect(timing.startTime).toBeGreaterThanOrEqual(request.issueTime());
  expect(timing.requestStart).toBeGreaterThanOrEqual(timing.connectEnd);
  expect(timing.responseStart).toBeGreaterThan(timing.requestStart);
  expect(timing.responseEnd).toBeGreaterThanOrEqual(timing.responseStart);
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
  expect(timing1.startTime).toBeGreaterThanOrEqual(responses[0].request().issueTime());
  expect(timing1.requestStart).toBeGreaterThanOrEqual(timing1.connectEnd);
  expect(timing1.responseStart).toBeGreaterThan(timing1.requestStart);
  expect(timing1.responseEnd).toBeGreaterThanOrEqual(timing1.responseStart);

  const timing2 = responses[1].request().timing();
  verifyConnectionTimingConsistency(timing2);
  expect(timing1.startTime).toBeGreaterThanOrEqual(responses[1].request().issueTime());
  expect(timing2.requestStart).toBeGreaterThanOrEqual(0);
  expect(timing2.responseStart).toBeGreaterThan(timing2.requestStart);
  expect(timing2.responseEnd).toBeGreaterThanOrEqual(timing2.responseStart);

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

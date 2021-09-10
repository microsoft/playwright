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

import fs from 'fs';
import zlib from 'zlib';

import { test as it, expect } from './pageTest';

it('should set bodySize and headersSize', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForEvent('request'),
    page.evaluate(() => fetch('./get', { method: 'POST', body: '12345' }).then(r => r.text())),
  ]);
  const sizes = await request.sizes();
  expect(sizes.requestBodySize).toBe(5);
  expect(sizes.requestHeadersSize).toBeGreaterThanOrEqual(250);
});

it('should set bodySize to 0 if there was no body', async ({ page, server, browserName, platform }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForEvent('request'),
    page.evaluate(() => fetch('./get').then(r => r.text())),
  ]);
  const sizes = await request.sizes();
  expect(sizes.requestBodySize).toBe(0);
  expect(sizes.requestHeadersSize).toBeGreaterThanOrEqual(200);
});

it('should set bodySize, headersSize, and transferSize', async ({ page, server }) => {
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
});

it('should set bodySize to 0 when there was no response body', async ({ page, server }) => {
  const response = await page.goto(server.EMPTY_PAGE);
  const sizes = await response.request().sizes();
  expect(sizes.responseBodySize).toBe(0);
  expect(sizes.responseHeadersSize).toBeGreaterThanOrEqual(150);
});

it('should have the correct responseBodySize', async ({ page, server, asset, browserName }) => {
  const response = await page.goto(server.PREFIX + '/simplezip.json');
  const sizes = await response.request().sizes();
  expect(sizes.responseBodySize).toBe(fs.statSync(asset('simplezip.json')).size);
});

it('should have the correct responseBodySize for chunked request', async ({ page, server, asset, browserName }) => {
  const content = fs.readFileSync(asset('simplezip.json'));
  server.setRoute('/chunked-simplezip.json', (req, resp) => {
    resp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Transfer-Encoding': 'chunked' });
    const AMOUNT_OF_CHUNKS = 10;
    const CHUNK_SIZE = Math.ceil(content.length / AMOUNT_OF_CHUNKS);
    for (let i = 0; i < AMOUNT_OF_CHUNKS; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, content.length);
      resp.write(content.slice(start, end));
    }
    resp.end();
  });
  const response = await page.goto(server.PREFIX + '/chunked-simplezip.json');
  const sizes = await response.request().sizes();
  expect(sizes.responseBodySize).toBe(fs.statSync(asset('simplezip.json')).size);
});

it('should have the correct responseBodySize with gzip compression', async ({ page, server, asset }, testInfo) => {
  server.enableGzip('/simplezip.json');
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForEvent('response'),
    page.evaluate(() => fetch('./simplezip.json').then(r => r.text()))
  ]);
  const sizes = await response.request().sizes();

  const chunks: Buffer[] = [];
  const gzip = fs.createReadStream(asset('simplezip.json')).pipe(zlib.createGzip());
  const done = new Promise(resolve => gzip.on('end', resolve));
  gzip.on('data', o => chunks.push(o));
  await done;

  expect(sizes.responseBodySize).toBe(Buffer.concat(chunks).length);
});

it('should handle redirects', async ({ page, server }) => {
  server.setRedirect('/foo', '/bar');
  server.setRoute('/bar', (req, resp) => resp.end('bar'));
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForEvent('response'),
    page.evaluate(async () => fetch('/foo', {
      method: 'POST',
      body: '12345',
    }).then(r => r.text())),
  ]);
  expect((await response.request().sizes()).requestBodySize).toBe(5);
  const newRequest = response.request().redirectedTo();
  expect((await newRequest.sizes()).responseBodySize).toBe(3);
});

it('should throw for failed requests', async ({ page, server }) => {
  server.setRoute('/one-style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.connection.destroy();
  });
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForEvent('requestfailed'),
    page.goto(server.PREFIX + '/one-style.html')
  ]);
  await expect(request.sizes()).rejects.toThrow('Unable to fetch sizes for failed request');
});

for (const statusCode of [200, 401, 404, 500]) {
  it(`should work with ${statusCode} status code`, async ({ page, server }) => {
    server.setRoute('/foo', (req, resp) => {
      resp.writeHead(statusCode, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': '3',
      });
      resp.end('bar');
    });
    await page.goto(server.EMPTY_PAGE);
    const [response] = await Promise.all([
      page.waitForEvent('response'),
      page.evaluate(async () => fetch('/foo', {
        method: 'POST',
        body: '12345',
      }).then(r => r.text())),
    ]);
    expect(response.status()).toBe(statusCode);
    const sizes = await response.request().sizes();
    expect(sizes.requestBodySize).toBe(5);
    expect(sizes.responseBodySize).toBe(3);
  });
}

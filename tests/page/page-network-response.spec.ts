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
import fs from 'fs';

it('should work', async ({page, server}) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('foo', 'bar');
    res.setHeader('BaZ', 'bAz');
    res.end();
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.headers()['foo']).toBe('bar');
  expect(response.headers()['baz']).toBe('bAz');
  expect(response.headers()['BaZ']).toBe(undefined);
});


it('should return text', async ({page, server}) => {
  const response = await page.goto(server.PREFIX + '/simple.json');
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('should return uncompressed text', async ({page, server}) => {
  server.enableGzip('/simple.json');
  const response = await page.goto(server.PREFIX + '/simple.json');
  expect(response.headers()['content-encoding']).toBe('gzip');
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('should throw when requesting body of redirected response', async ({page, server}) => {
  server.setRedirect('/foo.html', '/empty.html');
  const response = await page.goto(server.PREFIX + '/foo.html');
  const redirectedFrom = response.request().redirectedFrom();
  expect(redirectedFrom).toBeTruthy();
  const redirected = await redirectedFrom.response();
  expect(redirected.status()).toBe(302);
  let error = null;
  await redirected.text().catch(e => error = e);
  expect(error.message).toContain('Response body is unavailable for redirect responses');
});

it('should wait until response completes', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  // Setup server to trap request.
  let serverResponse = null;
  server.setRoute('/get', (req, res) => {
    serverResponse = res;
    // In Firefox, |fetch| will be hanging until it receives |Content-Type| header
    // from server.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write('hello ');
  });
  // Setup page to trap response.
  let requestFinished = false;
  page.on('requestfinished', r => requestFinished = requestFinished || r.url().includes('/get'));
  // send request and wait for server response
  const [pageResponse] = await Promise.all([
    page.waitForEvent('response'),
    page.evaluate(() => fetch('./get', { method: 'GET'})),
    server.waitForRequest('/get'),
  ]);

  expect(serverResponse).toBeTruthy();
  expect(pageResponse).toBeTruthy();
  expect(pageResponse.status()).toBe(200);
  expect(requestFinished).toBe(false);

  const responseText = pageResponse.text();
  // Write part of the response and wait for it to be flushed.
  await new Promise(x => serverResponse.write('wor', x));
  // Finish response.
  await new Promise(x => serverResponse.end('ld!', x));
  expect(await responseText).toBe('hello world!');
});

it('should return json', async ({page, server}) => {
  const response = await page.goto(server.PREFIX + '/simple.json');
  expect(await response.json()).toEqual({foo: 'bar'});
});

it('should return body', async ({page, server, asset}) => {
  const response = await page.goto(server.PREFIX + '/pptr.png');
  const imageBuffer = fs.readFileSync(asset('pptr.png'));
  const responseBuffer = await response.body();
  expect(responseBuffer.equals(imageBuffer)).toBe(true);
});

it('should return body with compression', async ({page, server, asset}) => {
  server.enableGzip('/pptr.png');
  const response = await page.goto(server.PREFIX + '/pptr.png');
  const imageBuffer = fs.readFileSync(asset('pptr.png'));
  const responseBuffer = await response.body();
  expect(responseBuffer.equals(imageBuffer)).toBe(true);
});

it('should return status text', async ({page, server}) => {
  server.setRoute('/cool', (req, res) => {
    res.writeHead(200, 'cool!');
    res.end();
  });
  const response = await page.goto(server.PREFIX + '/cool');
  expect(response.statusText()).toBe('cool!');
});

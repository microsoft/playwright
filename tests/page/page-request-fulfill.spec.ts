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
  await page.route('**/*', route => {
    route.fulfill({
      status: 201,
      headers: {
        foo: 'bar'
      },
      contentType: 'text/html',
      body: 'Yo, page!'
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(201);
  expect(response.headers().foo).toBe('bar');
  expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
});

it('should work with status code 422', async ({page, server}) => {
  await page.route('**/*', route => {
    route.fulfill({
      status: 422,
      body: 'Yo, page!'
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(422);
  expect(response.statusText()).toBe('Unprocessable Entity');
  expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
});

it('should allow mocking binary responses', async ({page, server, browserName, headless, asset, isAndroid}) => {
  it.skip(browserName === 'firefox' && !headless, 'Firefox headed produces a different image.');
  it.skip(isAndroid);

  await page.route('**/*', route => {
    const imageBuffer = fs.readFileSync(asset('pptr.png'));
    route.fulfill({
      contentType: 'image/png',
      body: imageBuffer
    });
  });
  await page.evaluate(PREFIX => {
    const img = document.createElement('img');
    img.src = PREFIX + '/does-not-exist.png';
    document.body.appendChild(img);
    return new Promise(fulfill => img.onload = fulfill);
  }, server.PREFIX);
  const img = await page.$('img');
  expect(await img.screenshot()).toMatchSnapshot('mock-binary-response.png');
});

it('should allow mocking svg with charset', async ({page, server, browserName, headless, isAndroid}) => {
  it.skip(browserName === 'firefox' && !headless, 'Firefox headed produces a different image.');
  it.skip(isAndroid);

  await page.route('**/*', route => {
    route.fulfill({
      contentType: 'image/svg+xml ; charset=utf-8',
      body: '<svg width="50" height="50" version="1.1" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="30" height="30" stroke="black" fill="transparent" stroke-width="5"/></svg>'
    });
  });
  await page.evaluate(PREFIX => {
    const img = document.createElement('img');
    img.src = PREFIX + '/does-not-exist.svg';
    document.body.appendChild(img);
    return new Promise((f, r) => { img.onload = f; img.onerror = r; });
  }, server.PREFIX);
  const img = await page.$('img');
  expect(await img.screenshot()).toMatchSnapshot('mock-svg.png');
});

it('should work with file path', async ({page, server, asset, isAndroid}) => {
  it.skip(isAndroid);

  await page.route('**/*', route => route.fulfill({ contentType: 'shouldBeIgnored', path: asset('pptr.png') }));
  await page.evaluate(PREFIX => {
    const img = document.createElement('img');
    img.src = PREFIX + '/does-not-exist.png';
    document.body.appendChild(img);
    return new Promise(fulfill => img.onload = fulfill);
  }, server.PREFIX);
  const img = await page.$('img');
  expect(await img.screenshot()).toMatchSnapshot('mock-binary-response.png');
});

it('should stringify intercepted request response headers', async ({page, server}) => {
  await page.route('**/*', route => {
    route.fulfill({
      status: 200,
      headers: {
        'foo': 'true'
      },
      body: 'Yo, page!'
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers.foo).toBe('true');
  expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
});

it('should not modify the headers sent to the server', async ({page, server}) => {
  await page.goto(server.PREFIX + '/empty.html');
  const interceptedRequests = [];

  // this is just to enable request interception, which disables caching in chromium
  await page.route(server.PREFIX + '/unused', () => {});

  server.setRoute('/something', (request, response) => {
    interceptedRequests.push(request);
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('done');
  });

  const text = await page.evaluate(async url => {
    const data = await fetch(url);
    return data.text();
  }, server.CROSS_PROCESS_PREFIX + '/something');
  expect(text).toBe('done');

  await page.route(server.CROSS_PROCESS_PREFIX + '/something', (route, request) => {
    route.continue({
      headers: {
        ...request.headers()
      }
    });
  });

  const textAfterRoute = await page.evaluate(async url => {
    const data = await fetch(url);
    return data.text();
  }, server.CROSS_PROCESS_PREFIX + '/something');
  expect(textAfterRoute).toBe('done');

  expect(interceptedRequests.length).toBe(2);
  expect(interceptedRequests[1].headers).toEqual(interceptedRequests[0].headers);
});

it('should include the origin header', async ({page, server, isAndroid}) => {
  it.skip(isAndroid, 'No cross-process on Android');

  await page.goto(server.PREFIX + '/empty.html');
  let interceptedRequest;
  await page.route(server.CROSS_PROCESS_PREFIX + '/something', (route, request) => {
    interceptedRequest = request;
    route.fulfill({
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      contentType: 'text/plain',
      body: 'done'
    });
  });

  const text = await page.evaluate(async url => {
    const data = await fetch(url);
    return data.text();
  }, server.CROSS_PROCESS_PREFIX + '/something');
  expect(text).toBe('done');
  expect(interceptedRequest.headers()['origin']).toEqual(server.PREFIX);
});

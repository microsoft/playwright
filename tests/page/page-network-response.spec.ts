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
import url from 'url';
import { expect, test as it } from './pageTest';

it('should work @smoke', async ({ page, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('foo', 'bar');
    res.setHeader('BaZ', 'bAz');
    res.end();
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect((await response.allHeaders())['foo']).toBe('bar');
  expect((await response.allHeaders())['baz']).toBe('bAz');
  expect((await response.allHeaders())['BaZ']).toBe(undefined);
});

it('should return multiple header value', async ({ page, server, browserName, platform }) => {
  it.skip(browserName === 'webkit' && platform === 'win32', 'libcurl does not support non-set-cookie multivalue headers');

  server.setRoute('/headers', (req, res) => {
    // Headers array is only supported since Node v14.14.0 so we write directly to the socket.
    // res.writeHead(200, ['name-a', 'v1','name-b', 'v4','Name-a', 'v2', 'name-A', 'v3']);
    const conn = res.connection;
    conn.write('HTTP/1.1 200 OK\r\n');
    conn.write('Name-A: v1\r\n');
    conn.write('Name-a: v2\r\n');
    conn.write('name-A: v3\r\n');
    conn.write('\r\n');
    conn.uncork();
    conn.end();
  });
  const response = await page.goto(`${server.PREFIX}/headers`);
  expect(response.status()).toBe(200);
  expect(response.headers()['name-a']).toBe('v1, v2, v3');
});

it('should return text', async ({ page, server }) => {
  const response = await page.goto(server.PREFIX + '/simple.json');
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('should return uncompressed text', async ({ page, server }) => {
  server.enableGzip('/simple.json');
  const response = await page.goto(server.PREFIX + '/simple.json');
  expect(response.headers()['content-encoding']).toBe('gzip');
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('should throw when requesting body of redirected response', async ({ page, server }) => {
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

it('should wait until response completes', async ({ page, server }) => {
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
    page.evaluate(() => fetch('./get', { method: 'GET' })),
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

it('should return json', async ({ page, server }) => {
  const response = await page.goto(server.PREFIX + '/simple.json');
  expect(await response.json()).toEqual({ foo: 'bar' });
});

it('should return body', async ({ page, server, asset }) => {
  const response = await page.goto(server.PREFIX + '/pptr.png');
  const imageBuffer = fs.readFileSync(asset('pptr.png'));
  const responseBuffer = await response.body();
  expect(responseBuffer.equals(imageBuffer)).toBe(true);
});

it('should return body with compression', async ({ page, server, asset }) => {
  server.enableGzip('/pptr.png');
  const response = await page.goto(server.PREFIX + '/pptr.png');
  const imageBuffer = fs.readFileSync(asset('pptr.png'));
  const responseBuffer = await response.body();
  expect(responseBuffer.equals(imageBuffer)).toBe(true);
});

it('should return status text', async ({ page, server }) => {
  server.setRoute('/cool', (req, res) => {
    res.writeHead(200, 'cool!');
    res.end();
  });
  const response = await page.goto(server.PREFIX + '/cool');
  expect(response.statusText()).toBe('cool!');
});

it('should report all headers', async ({ page, server, browserName, platform, isElectron, browserMajorVersion }) => {
  it.skip(isElectron && browserMajorVersion < 99, 'This needs Chromium >= 99');
  it.skip(browserName === 'webkit' && platform === 'win32', 'libcurl does not support non-set-cookie multivalue headers');

  const expectedHeaders = {
    'header-a': ['value-a', 'value-a-1', 'value-a-2'],
    'header-b': ['value-b'],
  };
  server.setRoute('/headers', (req, res) => {
    res.writeHead(200, expectedHeaders);
    res.end();
  });

  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse('**/*'),
    page.evaluate(() => fetch('/headers'))
  ]);
  const headers = await response.headersArray();
  const actualHeaders = {};
  for (const { name, value } of headers) {
    if (!actualHeaders[name])
      actualHeaders[name] = [];
    actualHeaders[name].push(value);
  }
  delete actualHeaders['Keep-Alive'];
  delete actualHeaders['keep-alive'];
  delete actualHeaders['Connection'];
  delete actualHeaders['connection'];
  delete actualHeaders['Date'];
  delete actualHeaders['date'];
  delete actualHeaders['Transfer-Encoding'];
  delete actualHeaders['transfer-encoding'];
  expect(actualHeaders).toEqual(expectedHeaders);
});

it('should report multiple set-cookie headers', async ({ page, server, isElectron, browserMajorVersion }) => {
  it.skip(isElectron && browserMajorVersion < 99, 'This needs Chromium >= 99');

  server.setRoute('/headers', (req, res) => {
    res.writeHead(200, {
      'Set-Cookie': ['a=b', 'c=d']
    });
    res.write('\r\n');
    res.end();
  });

  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse('**/*'),
    page.evaluate(() => fetch('/headers'))
  ]);
  const headers = await response.headersArray();
  const cookies = headers.filter(({ name }) => name.toLowerCase() === 'set-cookie').map(({ value }) => value);
  expect(cookies).toEqual(['a=b', 'c=d']);
  expect(await response.headerValue('not-there')).toEqual(null);
  expect(await response.headerValue('set-cookie')).toEqual('a=b\nc=d');
  expect(await response.headerValues('set-cookie')).toEqual(['a=b', 'c=d']);
});

it('should behave the same way for headers and allHeaders', async ({ page, server, browserName, platform }) => {
  it.skip(browserName === 'webkit' && platform === 'win32', 'libcurl does not support non-set-cookie multivalue headers');
  server.setRoute('/headers', (req, res) => {
    const headers = {
      'Set-Cookie': ['a=b', 'c=d'],
      'header-a': ['a=b', 'c=d'],
      'Name-A': 'v1',
      'name-b': 'v4',
      'Name-a': 'v2',
      'name-A': 'v3',
    };
    // Chromium does not report set-cookie headers immediately, so they are missing from .headers()
    if (browserName === 'chromium')
      delete headers['Set-Cookie'];

    res.writeHead(200, headers);
    res.write('\r\n');
    res.end();
  });

  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse('**/*'),
    page.evaluate(() => fetch('/headers'))
  ]);
  const allHeaders = await response.allHeaders();
  expect(response.headers()).toEqual(allHeaders);
  expect(allHeaders['header-a']).toEqual('a=b, c=d');
  expect(allHeaders['name-a']).toEqual('v1, v2, v3');
  expect(allHeaders['name-b']).toEqual('v4');
});

it('should provide a Response with a file URL', async ({ page, asset, isAndroid, isElectron, isWindows, browserName, mode }) => {
  it.skip(isAndroid, 'No files on Android');
  it.skip(browserName === 'firefox', 'Firefox does return null for file:// URLs');
  it.skip(mode.startsWith('service'));

  const fileurl = url.pathToFileURL(asset('frames/two-frames.html')).href;
  const response = await page.goto(fileurl);
  if (isElectron || (browserName === 'chromium') || (browserName === 'webkit' && isWindows))
    expect(response.status()).toBe(200);
  else
    expect(response.status()).toBe(0);
  expect(response.ok()).toBe(true);
});

it('should return set-cookie header after route.fulfill', async ({ page, server, browserName }) => {
  it.fail(browserName === 'webkit' || browserName === 'chromium', 'https://github.com/microsoft/playwright/issues/11035');
  await page.route('**/*', async route => {
    await route.fulfill({
      status: 200,
      headers: {
        'set-cookie': 'a=b'
      },
      contentType: 'text/plain',
      body: ''
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  const headers = await response.allHeaders();
  expect(headers['set-cookie']).toBe('a=b');
});

it('should return headers after route.fulfill', async ({ page, server }) => {
  await page.route('**/*', async route => {
    await route.fulfill({
      status: 200,
      headers: {
        'foo': 'bar',
        'content-language': 'en'
      },
      contentType: 'text/plain',
      body: 'done'
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(await response.allHeaders()).toEqual({
    'foo': 'bar',
    'content-type': 'text/plain',
    'content-length': '4',
    'content-language': 'en'
  });
});

it('should report if request was fromServiceWorker', async ({ page, server, isAndroid, isElectron }) => {
  it.skip(isAndroid || isElectron);
  {
    const res = await page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html');
    expect(res.fromServiceWorker()).toBe(false);
  }
  await page.evaluate(() => window['activationPromise']);
  {
    const [res] = await Promise.all([
      page.waitForResponse(/example\.txt/),
      page.evaluate(() => fetch('/example.txt')),
    ]);
    expect(res.fromServiceWorker()).toBe(true);
  }
});

it('should return body for prefetch script', async ({ page, server, browserName }) => {
  it.skip(browserName === 'webkit', 'No prefetch in WebKit: https://caniuse.com/link-rel-prefetch');
  const [response] = await Promise.all([
    page.waitForResponse('**/prefetch.js'),
    page.goto(server.PREFIX + '/prefetch.html')
  ]);
  const body = await response.body();
  expect(body.toString()).toBe('// Scripts will be pre-fetched');
});

it('should bypass disk cache when page interception is enabled', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30000' });
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  await page.route('**/api*', route => route.continue());
  {
    const requests = [];
    server.setRoute('/api', (req, res) => {
      requests.push(req);
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain');
      res.setHeader('cache-control', 'public, max-age=31536000');
      res.end('Hello');
    });
    for (let i = 0; i < 3; i++) {
      await it.step(`main frame iteration ${i}`, async () => {
        const respPromise = page.waitForResponse('**/api');
        await page.evaluate(async () => {
          const response = await fetch('/api');
          return response.status;
        });
        const response = await respPromise;
        expect(response.status()).toBe(200);
        expect(requests.length).toBe(i + 1);
      });
    }
  }

  {
    const requests = [];
    server.setRoute('/frame/api', (req, res) => {
      requests.push(req);
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain');
      res.setHeader('cache-control', 'public, max-age=31536000');
      res.end('Hello');
    });
    for (let i = 0; i < 3; i++) {
      await it.step(`subframe iteration ${i}`, async () => {
        const respPromise = page.waitForResponse('**/frame/api');
        await page.frame({ url: '**/frame.html' }).evaluate(async () => {
          const response = await fetch('/frame/api');
          return response.status;
        });
        const response = await respPromise;
        expect(response.status()).toBe(200);
        expect(requests.length).toBe(i + 1);
      });
    }
  }
});

it('should bypass disk cache when context interception is enabled', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30000' });
  await page.context().route('**/api*', route => route.continue());
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  {
    const requests = [];
    server.setRoute('/api', (req, res) => {
      requests.push(req);
      res.statusCode = 200;
      res.setHeader('content-type', 'text/plain');
      res.setHeader('cache-control', 'public, max-age=31536000');
      res.end('Hello');
    });
    for (let i = 0; i < 3; i++) {
      await it.step(`main frame iteration ${i}`, async () => {
        const respPromise = page.waitForResponse('**/api');
        await page.evaluate(async () => {
          const response = await fetch('/api');
          return response.status;
        });
        const response = await respPromise;
        expect(response.status()).toBe(200);
        expect(requests.length).toBe(i + 1);
      });
    }
  }
});

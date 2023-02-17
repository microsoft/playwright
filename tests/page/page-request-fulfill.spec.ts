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

import { test as base, expect } from './pageTest';
import fs from 'fs';
import type * as har from '../../packages/trace/src/har';

const it = base.extend<{
  // We access test servers at 10.0.2.2 from inside the browser on Android,
  // which is actually forwarded to the desktop localhost.
  // To use request such an url with apiRequestContext on the desktop, we need to change it back to localhost.
  rewriteAndroidLoopbackURL(url: string): string
      }>({
        rewriteAndroidLoopbackURL: ({ isAndroid }, use) => use(givenURL => {
          if (!isAndroid)
            return givenURL;
          const requestURL = new URL(givenURL);
          requestURL.hostname = 'localhost';
          return requestURL.toString();
        })
      });

it('should work', async ({ page, server }) => {
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

it('should work with buffer as body', async ({ page, server, browserName, isLinux }) => {
  await page.route('**/*', route => {
    route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: Buffer.from('Yo, page!')
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
});

it('should work with status code 422', async ({ page, server }) => {
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

it('should allow mocking binary responses', async ({ page, server, browserName, headless, asset, isAndroid, mode }) => {
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

it('should allow mocking svg with charset', async ({ page, server, browserName, headless, isAndroid, isElectron, mode }) => {
  it.skip(browserName === 'firefox' && !headless, 'Firefox headed produces a different image.');
  it.skip(isAndroid);
  it.skip(isElectron, 'Protocol error (Storage.getCookies): Browser context management is not supported');

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

it('should work with file path', async ({ page, server, asset, mode, isAndroid }) => {
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

it('should stringify intercepted request response headers', async ({ page, server }) => {
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

it('should not modify the headers sent to the server', async ({ page, server }) => {
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

it('should include the origin header', async ({ page, server, isAndroid }) => {
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

it('should fulfill with global fetch result', async ({ playwright, page, server, isElectron, rewriteAndroidLoopbackURL }) => {
  it.fixme(isElectron, 'error: Browser context management is not supported.');
  await page.route('**/*', async route => {
    const request = await playwright.request.newContext();
    const response = await request.get(rewriteAndroidLoopbackURL(server.PREFIX + '/simple.json'));
    route.fulfill({ response });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ 'foo': 'bar' });
});

it('should fulfill with fetch result', async ({ page, server, isElectron, rewriteAndroidLoopbackURL }) => {
  it.fixme(isElectron, 'error: Browser context management is not supported.');
  await page.route('**/*', async route => {
    const response = await page.request.get(rewriteAndroidLoopbackURL(server.PREFIX + '/simple.json'));
    route.fulfill({ response });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ 'foo': 'bar' });
});

it('should fulfill with fetch result and overrides', async ({ page, server, isElectron, rewriteAndroidLoopbackURL }) => {
  it.fixme(isElectron, 'error: Browser context management is not supported.');
  await page.route('**/*', async route => {
    const response = await page.request.get(rewriteAndroidLoopbackURL(server.PREFIX + '/simple.json'));
    route.fulfill({
      response,
      status: 201,
      headers: {
        'Content-Type': 'application/json', // Case matters for the tested behavior
        'foo': 'bar'
      }
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(201);
  expect((await response.allHeaders()).foo).toEqual('bar');
  expect(await response.json()).toEqual({ 'foo': 'bar' });
});

it('should fetch original request and fulfill', async ({ page, server, isElectron, isAndroid }) => {
  it.fixme(isElectron, 'error: Browser context management is not supported.');
  it.skip(isAndroid, 'The internal Android localhost (10.0.0.2) != the localhost on the host');
  await page.route('**/*', async route => {
    const response = await page.request.fetch(route.request());
    route.fulfill({
      response,
    });
  });
  const response = await page.goto(server.PREFIX + '/title.html');
  expect(response.status()).toBe(200);
  expect(await page.title()).toEqual('Woof-Woof');
});

it('should fulfill with multiple set-cookie', async ({ page, server, isElectron }) => {
  it.fixme(isElectron, 'Electron 14+ is required');
  const cookies = ['a=b', 'c=d'];
  await page.route('**/empty.html', async route => {
    route.fulfill({
      status: 200,
      headers: {
        'X-Header-1': 'v1',
        'Set-Cookie': cookies.join('\n'),
        'X-Header-2': 'v2',
      },
      body: ''
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect((await page.evaluate(() => document.cookie)).split(';').map(s => s.trim()).sort()).toEqual(cookies);
  expect(await response.headerValue('X-Header-1')).toBe('v1');
  expect(await response.headerValue('X-Header-2')).toBe('v2');
});

it('should fulfill with fetch response that has multiple set-cookie', async ({ playwright, page, server, isAndroid }) => {
  it.fixme(isAndroid);
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b', 'c=d']);
    res.setHeader('Content-Type', 'text/html');
    res.end();
  });
  await page.route('**/empty.html', async route => {
    const request = await playwright.request.newContext();
    const response = await request.fetch(route.request());
    route.fulfill({ response });
  });
  await page.goto(server.EMPTY_PAGE);
  const cookie = await page.evaluate(() => document.cookie);
  expect(cookie.split(';').map(s => s.trim()).sort()).toEqual(['a=b', 'c=d']);
});

it('headerValue should return set-cookie from intercepted response', async ({ page, server, browserName }) => {
  it.fail(browserName === 'chromium', 'Set-Cookie is missing in response after interception');
  it.skip(browserName === 'webkit', 'Set-Cookie with \n in intercepted response does not pass validation in WebCore, see also https://github.com/microsoft/playwright/pull/9273');
  await page.route('**/empty.html', async route => {
    route.fulfill({
      status: 200,
      headers: {
        'Set-Cookie': 'a=b',
      },
      body: ''
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(await response.headerValue('Set-Cookie')).toBe('a=b');
});

it('should fulfill with har response', async ({ page, asset }) => {
  const harPath = asset('har-fulfill.har');
  const har = JSON.parse(await fs.promises.readFile(harPath, 'utf-8')) as har.HARFile;
  await page.route('**/*', async route => {
    const response = findResponse(har, route.request().url());
    const headers = {};
    for (const { name, value } of response.headers)
      headers[name] = value;
    await route.fulfill({
      status: response.status,
      headers,
      body: Buffer.from(response.content.text || '', (response.content.encoding as 'base64' | undefined) || 'utf-8'),
    });
  });
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script.
  expect(await page.evaluate('window.value')).toBe('foo');
  // HAR contains a POST for the css file but we match ignoring the method, so the file should be served.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 255, 255)');
});

function findResponse(har: har.HARFile, url: string): har.Response {
  let entry;
  const originalUrl = url;
  while (url.trim()) {
    entry = har.log.entries.find(entry => entry.request.url === url);
    url = entry?.response.redirectURL;
  }
  expect(entry, originalUrl).toBeTruthy();
  return entry?.response;
}

it('should fulfill preload link requests', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16745' });
  let intercepted = false;
  await page.route('**/one-style.css', route => {
    intercepted = true;
    route.fulfill({
      status: 200,
      headers: {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'no-cache, no-store',
        'custom': 'value'
      },
      body: 'body { background-color: green; }'
    });
  });
  const [response] = await Promise.all([
    page.waitForResponse('**/one-style.css'),
    page.goto(server.PREFIX + '/preload.html')
  ]);
  expect(await response.headerValue('custom')).toBe('value');
  await page.waitForFunction(() => (window as any).preloadedStyles);
  expect(intercepted).toBe(true);
  const color = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
  expect(color).toBe('rgb(0, 128, 0)');
});

it('should fulfill json', async ({ page, server }) => {
  await page.route('**/*', route => {
    route.fulfill({
      status: 201,
      headers: {
        foo: 'bar'
      },
      json: { bar: 'baz' },
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(201);
  expect(response.headers()['content-type']).toBe('application/json');
  expect(await page.evaluate(() => document.body.textContent)).toBe(JSON.stringify({ bar: 'baz' }));
});

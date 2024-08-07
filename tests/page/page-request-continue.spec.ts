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
import type { Route } from 'playwright-core';

it('should work', async ({ page, server }) => {
  await page.route('**/*', route => route.continue());
  await page.goto(server.EMPTY_PAGE);
});

it('should amend HTTP headers', async ({ page, server }) => {
  await page.route('**/*', route => {
    const headers = Object.assign({}, route.request().headers());
    headers['FOO'] = 'bar';
    void route.continue({ headers });
  });
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    server.waitForRequest('/sleep.zzz'),
    page.evaluate(() => fetch('/sleep.zzz'))
  ]);
  expect(request.headers['foo']).toBe('bar');
});

it('should delete header with undefined value', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/13106' });

  await page.goto(server.PREFIX + '/empty.html');
  server.setRoute('/something', (request, response) => {
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('done');
  });
  let interceptedRequest;
  await page.route(server.PREFIX + '/something', async (route, request) => {
    interceptedRequest = request;
    const headers = await request.allHeaders();
    void route.continue({
      headers: {
        ...headers,
        foo: undefined
      }
    });
  });

  const [text, serverRequest] = await Promise.all([
    page.evaluate(async url => {
      const data = await fetch(url, {
        headers: {
          foo: 'a',
          bar: 'b',
        }
      });
      return data.text();
    }, server.PREFIX + '/something'),
    server.waitForRequest('/something')
  ]);
  expect(text).toBe('done');
  expect(interceptedRequest.headers()['foo']).toEqual(undefined);
  expect(serverRequest.headers.foo).toBeFalsy();
  expect(serverRequest.headers.bar).toBe('b');
});

it('should amend method', async ({ page, server }) => {
  const sRequest = server.waitForRequest('/sleep.zzz');
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', route => route.continue({ method: 'POST' }));
  const [request] = await Promise.all([
    server.waitForRequest('/sleep.zzz'),
    page.evaluate(() => fetch('/sleep.zzz'))
  ]);
  expect(request.method).toBe('POST');
  expect((await sRequest).method).toBe('POST');
});

it('should override request url', async ({ page, server }) => {
  const serverRequest = server.waitForRequest('/global-var.html');
  await page.route('**/foo', route => {
    void route.continue({ url: server.PREFIX + '/global-var.html' });
  });
  const response = await page.goto(server.PREFIX + '/foo');
  expect(response.request().url()).toBe(server.PREFIX + '/global-var.html');
  expect(response.url()).toBe(server.PREFIX + '/global-var.html');
  expect(await page.evaluate(() => window['globalVar'])).toBe(123);
  expect((await serverRequest).method).toBe('GET');
});

it('should not allow changing protocol when overriding url', async ({ page, server }) => {
  let resolve;
  const errorPromise = new Promise<Error|null>(f => resolve = f);
  await page.route('**/*', async route => {
    try {
      await route.continue({ url: 'file:///tmp/foo' });
      resolve(null);
    } catch (e) {
      resolve(e);
    }
  });
  page.goto(server.EMPTY_PAGE).catch(() => {});
  const error = await errorPromise;
  expect(error).toBeTruthy();
  expect(error.message).toContain('New URL must have same protocol as overridden URL');
});

it('should not throw when continuing while page is closing', async ({ page, server, isWebView2 }) => {
  it.skip(isWebView2, 'Page.close() is not supported in WebView2');

  let done;
  await page.route('**/*', async route => {
    done = Promise.all([
      void route.continue(),
      page.close(),
    ]);
  });
  await page.goto(server.EMPTY_PAGE).catch(e => e);
  await done;
});

it('should not throw when continuing after page is closed', async ({ page, server, isWebView2 }) => {
  it.skip(isWebView2, 'Page.close() is not supported in WebView2');

  let done;
  await page.route('**/*', async route => {
    await page.close();
    done = route.continue();
  });
  const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
  await done;
  expect(error).toBeInstanceOf(Error);
});

it('should not throw if request was cancelled by the page', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28490' });
  let interceptCallback;
  const interceptPromise = new Promise<Route>(f => interceptCallback = f);
  await page.route('**/data.json', route => interceptCallback(route));
  await page.goto(server.EMPTY_PAGE);
  page.evaluate(url => {
    globalThis.controller = new AbortController();
    return fetch(url, { signal: globalThis.controller.signal });
  }, server.PREFIX + '/data.json').catch(() => {});
  const route = await interceptPromise;
  const failurePromise = page.waitForEvent('requestfailed');
  await page.evaluate(() => globalThis.controller.abort());
  const cancelledRequest = await failurePromise;
  expect(cancelledRequest.failure().errorText).toMatch(/cancelled|aborted/i);
  await route.continue(); // Should not throw.
});

it('should override method along with url', async ({ page, server }) => {
  const request = server.waitForRequest('/empty.html');
  await page.route('**/foo', route => {
    void route.continue({
      url: server.EMPTY_PAGE,
      method: 'POST'
    });
  });
  await page.goto(server.PREFIX + '/foo');
  expect((await request).method).toBe('POST');
});

it('should amend method on main request', async ({ page, server }) => {
  const request = server.waitForRequest('/empty.html');
  await page.route('**/*', route => route.continue({ method: 'POST' }));
  await page.goto(server.EMPTY_PAGE);
  expect((await request).method).toBe('POST');
});

it.describe('post data', () => {
  it('should amend post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      void route.continue({ postData: 'doggo' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo');
  });

  it('should compute content-length from post data', async ({ page, server }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16027' });
    await page.goto(server.EMPTY_PAGE);
    const data = 'a'.repeat(7500);
    await page.route('**/*', route => {
      const headers = route.request().headers();
      headers['content-type'] =  'application/json';
      void route.continue({ postData: data, headers });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'PATCH', body: 'birdy' }))
    ]);
    expect((await serverRequest.postBody).toString('utf8')).toBe(data);
    expect(serverRequest.headers['content-length']).toBe(String(data.length));
    expect(serverRequest.headers['content-type']).toBe('application/json');
  });

  it('should amend method and post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      void route.continue({ method: 'POST', postData: 'doggo' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'GET' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo');
  });

  it('should amend utf8 post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      void route.continue({ postData: 'пушкин' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    expect((await serverRequest.postBody).toString('utf8')).toBe('пушкин');
  });

  it('should amend longer post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      void route.continue({ postData: 'doggo-is-longer-than-birdy' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo-is-longer-than-birdy');
  });

  it('should amend binary post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    const arr = Array.from(Array(256).keys());
    await page.route('**/*', route => {
      void route.continue({ postData: Buffer.from(arr) });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    const buffer = await serverRequest.postBody;
    expect(buffer.length).toBe(arr.length);
    for (let i = 0; i < arr.length; ++i)
      expect(arr[i]).toBe(buffer[i]);
  });

  it('should use content-type from original request', async ({ page, server, browserName }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16736' });

    await page.goto(server.EMPTY_PAGE);
    await page.route(`${server.PREFIX}/title.html`, route => route.continue({ postData: '{"b":2}' }));
    const [request] = await Promise.all([
      server.waitForRequest('/title.html'),
      page.evaluate(async url => {
        await fetch(url, {
          method: 'POST',
          body: '{"a":1}',
          headers: { 'content-type': 'application/json' },
        });
      }, `${server.PREFIX}/title.html`)
    ]);
    expect(request.headers['content-type']).toBe('application/json');
    expect((await request.postBody).toString('utf-8')).toBe('{"b":2}');
  });
});

it('should work with Cross-Origin-Opener-Policy', async ({ page, server, browserName }) => {
  it.fail(browserName === 'webkit', 'https://github.com/microsoft/playwright/issues/8796');
  let serverHeaders;
  const serverRequests = [];
  server.setRoute('/empty.html', (req, res) => {
    serverRequests.push(req.url);
    serverHeaders ??= req.headers;
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.end();
  });

  const intercepted = [];
  await page.route('**/*', (route, req) => {
    intercepted.push(req.url());
    void route.continue({
      headers: {
        foo: 'bar'
      }
    });
  });
  const requests = new Set();
  const events = [];
  page.on('request', r => {
    events.push('request');
    requests.add(r);
  });
  page.on('requestfailed', r => {
    events.push('requestfailed');
    requests.add(r);
  });
  page.on('requestfinished', r => {
    events.push('requestfinished');
    requests.add(r);
  });
  page.on('response', r => {
    events.push('response');
    requests.add(r.request());
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([server.EMPTY_PAGE]);
  // There should be only one request to the server.
  if (browserName === 'webkit')
    expect(serverRequests).toEqual(['/empty.html', '/empty.html']);
  else
    expect(serverRequests).toEqual(['/empty.html']);
  expect(serverHeaders['foo']).toBe('bar');
  expect(page.url()).toBe(server.EMPTY_PAGE);
  await response.finished();
  expect(events).toEqual(['request', 'response', 'requestfinished']);
  expect(requests.size).toBe(1);
  expect(response.request().failure()).toBeNull();
});

it('should delete the origin header', async ({ page, server, isAndroid, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/13106' });
  it.skip(isAndroid, 'No cross-process on Android');
  it.fail(browserName === 'webkit', 'Does not delete origin in webkit');

  await page.goto(server.PREFIX + '/empty.html');
  server.setRoute('/something', (request, response) => {
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('done');
  });
  let interceptedRequest;
  await page.route(server.CROSS_PROCESS_PREFIX + '/something', async (route, request) => {
    interceptedRequest = request;
    const headers = await request.allHeaders();
    delete headers['origin'];
    void route.continue({ headers });
  });

  const [text, serverRequest] = await Promise.all([
    page.evaluate(async url => {
      const data = await fetch(url);
      return data.text();
    }, server.CROSS_PROCESS_PREFIX + '/something'),
    server.waitForRequest('/something')
  ]);
  expect(text).toBe('done');
  expect(interceptedRequest.headers()['origin']).toEqual(undefined);
  expect(serverRequest.headers.origin).toBeFalsy();
});

it('should continue preload link requests', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16745' });
  let intercepted = false;
  await page.route('**/one-style.css', route => {
    intercepted = true;
    void route.continue({
      headers: {
        ...route.request().headers(),
        'custom': 'value'
      }
    });
  });
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/one-style.css'),
    page.goto(server.PREFIX + '/preload.html')
  ]);
  expect(serverRequest.headers['custom']).toBe('value');
  await page.waitForFunction(() => (window as any).preloadedStyles);
  expect(intercepted).toBe(true);
  const color = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
  expect(color).toBe('rgb(255, 192, 203)');
});

it('continue should propagate headers to redirects', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28758' },
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32045' },
  ]
}, async ({ page, server }) => {
  await server.setRedirect('/redirect', '/empty.html');
  await page.route('**/redirect', route => {
    void route.continue({
      headers: {
        ...route.request().headers(),
        custom: 'value'
      }
    });
  });
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.PREFIX + '/redirect')
  ]);
  expect(serverRequest.headers['custom']).toBe('value');
});

it('redirected requests should report overridden headers', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31351' },
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32045' },
  ]
}, async ({ page, server }) => {
  await server.setRedirect('/redirect', '/empty.html');
  await page.route('**/redirect', route => {
    const headers = route.request().headers();
    headers['custom'] = 'value';
    void route.fallback({ headers });
  });

  const [serverRequest, response] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.PREFIX + '/redirect')
  ]);
  expect(serverRequest.headers['custom']).toBe('value');
  expect(response.request().url()).toBe(server.EMPTY_PAGE);
  expect(response.request().headers()['custom']).toBe('value');
  expect((await response.request().allHeaders())['custom']).toBe('value');
});

it('continue should delete headers on redirects', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/13106' },
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32045' },
  ]
}, async ({ page, server }) => {
  await page.goto(server.PREFIX + '/empty.html');
  server.setRoute('/something', (request, response) => {
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('done');
  });
  await server.setRedirect('/redirect', '/something');
  await page.route('**/redirect', route => {
    void route.continue({
      headers: {
        ...route.request().headers(),
        foo: undefined
      }
    });
  });
  const [text, serverRequest] = await Promise.all([
    page.evaluate(async url => {
      const data = await fetch(url, {
        headers: {
          foo: 'a',
        }
      });
      return data.text();
    }, server.PREFIX + '/redirect'),
    server.waitForRequest('/something')
  ]);
  expect(text).toBe('done');
  expect(serverRequest.headers.foo).toBeFalsy();
});

it('should intercept css variable with background url', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19158' });

  server.setRoute('/test.html', (request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`
    <style>
      @keyframes JNDzq {
        0% { background-position: 0 0 }
        to { background-position: 100 0 }
      }
      div {
        --background: url(/pptr.png);
        background-image: var(--background);
        animation: JNDzq 1s linear infinite;
      }
    </style>
    <div>Yo!</div>`);
  });
  let interceptCallback;
  const interceptPromise = new Promise(f => interceptCallback = f);
  let interceptedRequests = 0;
  await page.route(server.PREFIX + '/pptr.png', async (route, request) => {
    ++interceptedRequests;
    interceptCallback();
    void route.continue();
  });
  await page.goto(server.PREFIX + '/test.html');
  expect(await page.locator('div').textContent()).toBe('Yo!');
  await interceptPromise;
  await page.waitForTimeout(1000);
  expect(interceptedRequests).toBe(1);
});

it('continue should not change multipart/form-data body', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19158' });
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/upload', (request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('done');
  });
  async function sendFormData() {
    const reqPromise = server.waitForRequest('/upload');
    const status = await page.evaluate(async () => {
      const newFile = new File(['file content'], 'file.txt');
      const formData = new FormData();
      formData.append('file', newFile);
      const response = await fetch('/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      return response.status;
    });
    const req = await reqPromise;
    expect(status).toBe(200);
    return req;
  }
  const reqBefore = await sendFormData();
  await page.route('**/*', async route => {
    await route.continue();
  });
  const reqAfter = await sendFormData();
  const fileContent = [
    'Content-Disposition: form-data; name=\"file\"; filename=\"file.txt\"',
    'Content-Type: application/octet-stream',
    '',
    'file content',
    '------'].join('\r\n');
  expect.soft((await reqBefore.postBody).toString('utf8')).toContain(fileContent);
  expect.soft((await reqAfter.postBody).toString('utf8')).toContain(fileContent);
});

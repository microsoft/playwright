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

import os from 'os';
import type { Route } from 'playwright-core';
import { test as it, expect } from './pageTest';

it('should intercept @smoke', async ({ page, server }) => {
  let intercepted = false;
  await page.route('**/empty.html', (route, request) => {
    expect(route.request()).toBe(request);
    expect(request.url()).toContain('empty.html');
    expect(request.headers()['user-agent']).toBeTruthy();
    expect(request.method()).toBe('GET');
    expect(request.postData()).toBe(null);
    expect(request.isNavigationRequest()).toBe(true);
    expect(request.resourceType()).toBe('document');
    expect(request.frame() === page.mainFrame()).toBe(true);
    expect(request.frame().url()).toBe('about:blank');
    void route.continue();
    intercepted = true;
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(intercepted).toBe(true);
});

it('should unroute', async ({ page, server }) => {
  let intercepted = [];
  await page.route('**/*', route => {
    intercepted.push(1);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(2);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback();
  });
  const handler4 = route => {
    intercepted.push(4);
    void route.fallback();
  };
  await page.route(/empty.html/, handler4);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([4, 3, 2, 1]);

  intercepted = [];
  await page.unroute(/empty.html/, handler4);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);

  intercepted = [];
  await page.unroute('**/empty.html');
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([1]);
});

it('should support ? in glob pattern', async ({ page, server }) => {
  server.setRoute('/index', (req, res) => res.end('index-no-hello'));
  server.setRoute('/index123hello', (req, res) => res.end('index123hello'));
  server.setRoute('/index?hello', (req, res) => res.end('index?hello'));

  await page.route('**/index?hello', async (route, request) => {
    await route.fulfill({ body: 'intercepted any character' });
  });

  await page.route('**/index\\?hello', async (route, request) => {
    await route.fulfill({ body: 'intercepted question mark' });
  });

  await page.goto(server.PREFIX + '/index?hello');
  expect(await page.content()).toContain('intercepted question mark');

  await page.goto(server.PREFIX + '/index');
  expect(await page.content()).toContain('index-no-hello');

  await page.goto(server.PREFIX + '/index1hello');
  expect(await page.content()).toContain('intercepted any character');

  await page.goto(server.PREFIX + '/index123hello');
  expect(await page.content()).toContain('index123hello');
});

it('should work when POST is redirected with 302', async ({ page, server }) => {
  server.setRedirect('/rredirect', '/empty.html');
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', route => route.continue());
  await page.setContent(`
    <form action='/rredirect' method='post'>
      <input type="hidden" id="foo" name="foo" value="FOOBAR">
    </form>
  `);
  await Promise.all([
    page.$eval('form', form => form.submit()),
    page.waitForNavigation()
  ]);
});

// @see https://github.com/GoogleChrome/puppeteer/issues/3973
it('should work when header manipulation headers with redirect', async ({ page, server }) => {
  server.setRedirect('/rrredirect', '/empty.html');
  await page.route('**/*', route => {
    const headers = Object.assign({}, route.request().headers(), {
      foo: 'bar'
    });
    void route.continue({ headers });
  });
  await page.goto(server.PREFIX + '/rrredirect');
});

// @see https://github.com/GoogleChrome/puppeteer/issues/4743
it('should be able to remove headers', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', async route => {
    const headers = { ...route.request().headers() };
    delete headers['foo'];
    void route.continue({ headers });
  });

  const [serverRequest] = await Promise.all([
    server.waitForRequest('/title.html'),
    page.evaluate(url => fetch(url, { headers: { foo: 'bar' } }), server.PREFIX + '/title.html')
  ]);
  expect(serverRequest.headers.foo).toBe(undefined);
});

it('should contain referer header', async ({ page, server }) => {
  const requests = [];
  await page.route('**/*', route => {
    requests.push(route.request());
    void route.continue();
  });
  await page.goto(server.PREFIX + '/one-style.html');
  expect(requests[1].url()).toContain('/one-style.css');
  expect(requests[1].headers().referer).toContain('/one-style.html');
});

it('should properly return navigation response when URL has cookies', async ({ page, server, isAndroid, isElectron, electronMajorVersion }) => {
  it.skip(isAndroid, 'No isolated context');
  it.skip(isElectron && electronMajorVersion < 30, 'error: Browser context management is not supported.');

  // Setup cookie.
  await page.goto(server.EMPTY_PAGE);
  await page.context().addCookies([{ url: server.EMPTY_PAGE, name: 'foo', value: 'bar' }]);

  // Setup request interception.
  await page.route('**/*', route => route.continue());
  const response = await page.reload();
  expect(response.status()).toBe(200);
});

it('should override cookie header', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16773' });
  it.fail(browserName !== 'firefox');

  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => document.cookie = 'original=value');
  let cookieValueInRoute;
  await page.route('**', async route => {
    const headers = await route.request().allHeaders();
    cookieValueInRoute = headers['cookie'];
    headers['cookie'] = 'overridden=value';
    void route.continue({ headers });
  });
  const [serverReq] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);

  expect(cookieValueInRoute).toBe('original=value');
  expect(serverReq.headers['cookie']).toBe('overridden=value');
});

it('should show custom HTTP headers', async ({ page, server }) => {
  await page.setExtraHTTPHeaders({
    foo: 'bar'
  });
  await page.route('**/*', route => {
    expect(route.request().headers()['foo']).toBe('bar');
    void route.continue();
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
});

// @see https://github.com/GoogleChrome/puppeteer/issues/4337
it('should work with redirect inside sync XHR', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28461' });
  it.fixme(browserName === 'webkit', 'No Network.requestIntercepted for the request');
  await page.goto(server.EMPTY_PAGE);
  server.setRedirect('/logo.png', '/pptr.png');
  let continuePromise;
  await page.route('**/*', route => {
    continuePromise = route.continue();
  });
  const status = await page.evaluate(async () => {
    const request = new XMLHttpRequest();
    request.open('GET', '/logo.png', false);  // `false` makes the request synchronous
    request.send(null);
    return request.status;
  });
  expect(status).toBe(200);
  expect(continuePromise).toBeTruthy();
  await continuePromise;
});

it('should pause intercepted XHR until continue', async ({ page, server, browserName }) => {
  it.fixme(browserName === 'webkit', 'Redirected request is not paused in WebKit');

  await page.goto(server.EMPTY_PAGE);
  let resolveRoute;
  const routePromise = new Promise(r => resolveRoute = r);
  await page.route('**/global-var.html', async route => resolveRoute(route));
  let xhrFinished = false;
  const statusPromise = page.evaluate(async () => {
    const request = new XMLHttpRequest();
    request.open('GET', '/global-var.html', false);  // `false` makes the request synchronous
    request.send(null);
    return request.status;
  }).then(r => {
    xhrFinished = true;
    return r;
  });
  const route = await routePromise;
  // Check that intercepted request is actually paused.
  await new Promise(r => setTimeout(r, 500));
  expect(xhrFinished).toBe(false);
  const [status] = await Promise.all([
    statusPromise,
    (route as any).continue()
  ]);
  expect(status).toBe(200);
});

it('should pause intercepted fetch request until continue', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let resolveRoute;
  const routePromise = new Promise(r => resolveRoute = r);
  await page.route('**/global-var.html', async route => resolveRoute(route));
  let fetchFinished = false;
  const statusPromise = page.evaluate(async () => {
    const response = await fetch('/global-var.html');
    return response.status;
  }).then(r => {
    fetchFinished = true;
    return r;
  });
  const route = await routePromise;
  // Check that intercepted request is actually paused.
  await new Promise(r => setTimeout(r, 500));
  expect(fetchFinished).toBe(false);
  const [status] = await Promise.all([
    statusPromise,
    (route as any).continue()
  ]);
  expect(status).toBe(200);
});

it('should work with custom referer headers', async ({ page, server, browserName }) => {
  await page.setExtraHTTPHeaders({ 'referer': server.EMPTY_PAGE });
  await page.route('**/*', route => {
    // See https://github.com/microsoft/playwright/issues/8999
    if (browserName === 'chromium')
      expect(route.request().headers()['referer']).toBe(server.EMPTY_PAGE + ', ' + server.EMPTY_PAGE);
    else
      expect(route.request().headers()['referer']).toBe(server.EMPTY_PAGE);
    void route.continue();
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
});

it('should be abortable', async ({ page, server }) => {
  await page.route(/\.css$/, route => route.abort());
  let failed = false;
  page.on('requestfailed', request => {
    if (request.url().includes('.css'))
      failed = true;
  });
  const response = await page.goto(server.PREFIX + '/one-style.html');
  expect(response.ok()).toBe(true);
  expect(response.request().failure()).toBe(null);
  expect(failed).toBe(true);
});

it('should be abortable with custom error codes', async ({ page, server, browserName, isMac }) => {
  await page.route('**/*', route => route.abort('internetdisconnected'));
  let failedRequest = null;
  page.on('requestfailed', request => failedRequest = request);
  await page.goto(server.EMPTY_PAGE).catch(e => {});
  expect(failedRequest).toBeTruthy();
  const isFrozenWebKit = isMac && parseInt(os.release(), 10) < 20;
  if (browserName === 'webkit')
    expect(failedRequest.failure().errorText).toBe(isFrozenWebKit ? 'Request intercepted' : 'Blocked by Web Inspector');
  else if (browserName === 'firefox')
    expect(failedRequest.failure().errorText).toBe('NS_ERROR_OFFLINE');
  else
    expect(failedRequest.failure().errorText).toBe('net::ERR_INTERNET_DISCONNECTED');
});

it('should not throw if request was cancelled by the page', async ({ page, server }) => {
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
  await route.abort(); // Should not throw.
});

it('should send referer', async ({ page, server }) => {
  await page.setExtraHTTPHeaders({
    referer: 'http://google.com/'
  });
  await page.route('**/*', route => route.continue());
  const [request] = await Promise.all([
    server.waitForRequest('/grid.html'),
    page.goto(server.PREFIX + '/grid.html'),
  ]);
  expect(request.headers['referer']).toBe('http://google.com/');
});

it('should fail navigation when aborting main resource', async ({ page, server, browserName, isMac }) => {
  await page.route('**/*', route => route.abort());
  let error = null;
  await page.goto(server.EMPTY_PAGE).catch(e => error = e);
  expect(error).toBeTruthy();
  const isFrozenWebKit = isMac && parseInt(os.release(), 10) < 20;
  if (browserName === 'webkit')
    expect(error.message).toContain(isFrozenWebKit ? 'Request intercepted' : 'Blocked by Web Inspector');
  else if (browserName === 'firefox')
    expect(error.message).toContain('NS_ERROR_FAILURE');
  else
    expect(error.message).toContain('net::ERR_FAILED');
});

it('should not work with redirects', async ({ page, server }) => {
  const intercepted = [];
  await page.route('**/*', route => {
    void route.continue();
    intercepted.push(route.request());
  });
  server.setRedirect('/non-existing-page.html', '/non-existing-page-2.html');
  server.setRedirect('/non-existing-page-2.html', '/non-existing-page-3.html');
  server.setRedirect('/non-existing-page-3.html', '/non-existing-page-4.html');
  server.setRedirect('/non-existing-page-4.html', '/empty.html');

  const response = await page.goto(server.PREFIX + '/non-existing-page.html');
  expect(response.status()).toBe(200);
  expect(response.url()).toContain('empty.html');

  expect(intercepted.length).toBe(1);
  expect(intercepted[0].resourceType()).toBe('document');
  expect(intercepted[0].isNavigationRequest()).toBe(true);
  expect(intercepted[0].url()).toContain('/non-existing-page.html');

  const chain = [];
  for (let r = response.request(); r; r = r.redirectedFrom()) {
    chain.push(r);
    expect(r.isNavigationRequest()).toBe(true);
  }
  expect(chain.length).toBe(5);
  expect(chain[0].url()).toContain('/empty.html');
  expect(chain[1].url()).toContain('/non-existing-page-4.html');
  expect(chain[2].url()).toContain('/non-existing-page-3.html');
  expect(chain[3].url()).toContain('/non-existing-page-2.html');
  expect(chain[4].url()).toContain('/non-existing-page.html');
  for (let i = 0; i < chain.length; i++)
    expect(chain[i].redirectedTo()).toBe(i ? chain[i - 1] : null);
});

it('should chain fallback w/ dynamic URL', async ({ page, server }) => {
  const intercepted = [];
  await page.route('**/bar', route => {
    intercepted.push(1);
    void route.fallback({ url: server.EMPTY_PAGE });
  });
  await page.route('**/foo', route => {
    intercepted.push(2);
    void route.fallback({ url: 'http://localhost/bar' });
  });

  await page.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback({ url: 'http://localhost/foo' });
  });

  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);
});

it('should work with redirects for subresources', async ({ page, server }) => {
  const intercepted = [];
  await page.route('**/*', route => {
    void route.continue();
    intercepted.push(route.request());
  });
  server.setRedirect('/one-style.css', '/two-style.css');
  server.setRedirect('/two-style.css', '/three-style.css');
  server.setRedirect('/three-style.css', '/four-style.css');
  server.setRoute('/four-style.css', (req, res) => res.end('body {box-sizing: border-box; }'));

  const response = await page.goto(server.PREFIX + '/one-style.html');
  expect(response.status()).toBe(200);
  expect(response.url()).toContain('one-style.html');

  expect(intercepted.length).toBe(2);
  expect(intercepted[0].resourceType()).toBe('document');
  expect(intercepted[0].url()).toContain('one-style.html');

  let r = intercepted[1];
  for (const url of ['/one-style.css', '/two-style.css', '/three-style.css', '/four-style.css']) {
    expect(r.resourceType()).toBe('stylesheet');
    expect(r.url()).toContain(url);
    r = r.redirectedTo();
  }
  expect(r).toBe(null);
});

it('should work with equal requests', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let responseCount = 1;
  server.setRoute('/zzz', (req, res) => res.end((responseCount++) * 11 + ''));

  let spinner = false;
  // Cancel 2nd request.
  await page.route('**/*', route => {
    void (spinner ? route.abort() : route.continue());
    spinner = !spinner;
  });
  const results = [];
  for (let i = 0; i < 3; i++)
    results.push(await page.evaluate(() => fetch('/zzz').then(response => response.text()).catch(e => 'FAILED')));
  expect(results).toEqual(['11', 'FAILED', '22']);
});

it('should navigate to dataURL and not fire dataURL requests', async ({ page, server }) => {
  const requests = [];
  await page.route('**/*', route => {
    requests.push(route.request());
    void route.continue();
  });
  const dataURL = 'data:text/html,<div>yo</div>';
  const response = await page.goto(dataURL);
  expect(response).toBe(null);
  expect(requests.length).toBe(0);
});

it('should be able to fetch dataURL and not fire dataURL requests', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const requests = [];
  await page.route('**/*', route => {
    requests.push(route.request());
    void route.continue();
  });
  const dataURL = 'data:text/html,<div>yo</div>';
  const text = await page.evaluate(url => fetch(url).then(r => r.text()), dataURL);
  expect(text).toBe('<div>yo</div>');
  expect(requests.length).toBe(0);
});

it('should navigate to URL with hash and and fire requests without hash', async ({ page, server }) => {
  const requests = [];
  await page.route('**/*', route => {
    requests.push(route.request());
    void route.continue();
  });
  const response = await page.goto(server.EMPTY_PAGE + '#hash');
  expect(response.status()).toBe(200);
  expect(response.url()).toBe(server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
  expect(requests[0].url()).toBe(server.EMPTY_PAGE);
});

it('should work with encoded server', async ({ page, server }) => {
  // The requestWillBeSent will report encoded URL, whereas interception will
  // report URL as-is. @see crbug.com/759388
  await page.route('**/*', route => route.continue());
  const response = await page.goto(server.PREFIX + '/some nonexisting page');
  expect(response.status()).toBe(404);
});

it('should work with badly encoded server', async ({ page, server }) => {
  server.setRoute('/malformed?rnd=%911', (req, res) => res.end());
  await page.route('**/*', route => route.continue());
  const response = await page.goto(server.PREFIX + '/malformed?rnd=%911');
  expect(response.status()).toBe(200);
});

it('should work with encoded server - 2', async ({ page, server, browserName }) => {
  // The requestWillBeSent will report URL as-is, whereas interception will
  // report encoded URL for stylesheet. @see crbug.com/759388
  const requests = [];
  await page.route('**/*', route => {
    void route.continue();
    requests.push(route.request());
  });
  const response = await page.goto(`data:text/html,<link rel="stylesheet" href="${server.PREFIX}/fonts?helvetica|arial"/>`);
  expect(response).toBe(null);
  if (browserName === 'firefox')
    expect(requests.length).toBe(2); // Firefox DevTools report to navigations in this case as well.
  else
    expect(requests.length).toBe(1);
  expect((await requests[0].response()).status()).toBe(404);
});

it('should not throw "Invalid Interception Id" if the request was cancelled', async ({ page, server }) => {
  await page.setContent('<iframe></iframe>');
  let route = null;
  await page.route('**/*', async r => route = r);
  void page.$eval('iframe', (frame, url) => frame.src = url, server.EMPTY_PAGE);
  // Wait for request interception.
  await page.waitForEvent('request');
  // Delete frame to cause request to be canceled.
  await page.$eval('iframe', frame => frame.remove());
  let error = null;
  await route.continue().catch(e => error = e);
  expect(error).toBe(null);
});

it('should intercept main resource during cross-process navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let intercepted = false;
  await page.route(server.CROSS_PROCESS_PREFIX + '/empty.html', route => {
    intercepted = true;
    void route.continue();
  });
  const response = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  expect(response.ok()).toBe(true);
  expect(intercepted).toBe(true);
});

it('should fulfill with redirect status', async ({ page, server, browserName }) => {
  it.fixme(browserName === 'webkit', 'in WebKit the redirects are handled by the network stack and we intercept before');

  await page.goto(server.PREFIX + '/title.html');
  server.setRoute('/final', (req, res) => res.end('foo'));
  await page.route('**/*', async (route, request) => {
    if (request.url() !== server.PREFIX + '/redirect_this')
      return route.continue();
    await route.fulfill({
      status: 301,
      headers: {
        'location': '/final',
      }
    });
  });

  const text = await page.evaluate(async url => {
    const data = await fetch(url);
    return data.text();
  }, server.PREFIX + '/redirect_this');
  expect(text).toBe('foo');
});

it('should not fulfill with redirect status', async ({ page, server, browserName }) => {
  it.skip(browserName !== 'webkit', 'we should support fulfill with redirect in webkit and delete this test');

  await page.goto(server.PREFIX + '/empty.html');

  let status;
  let fulfill;
  let reject;
  await page.route('**/*', async (route, request) => {
    if (request.url() !== server.PREFIX + '/redirect_this')
      return route.continue();
    try {
      await route.fulfill({
        status,
        headers: {
          'location': '/empty.html',
        }
      });
      reject('fulfill didn\'t throw');
    } catch (e) {
      fulfill(e);
    }
  });

  for (status = 300; status < 310; status++) {
    const [, exception] = await Promise.all([
      page.evaluate(url => location.href = url, server.PREFIX + '/redirect_this'),
      new Promise<Error>((f, r) => {fulfill = f; reject = r;})
    ]);
    expect(exception).toBeTruthy();
    expect(exception.message.includes('Cannot fulfill with redirect status')).toBe(true);
  }
});

it('should support cors with GET', async ({ page, server, browserName }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/cars*', async (route, request) => {
    const headers = { 'access-control-allow-origin': request.url().endsWith('allow') ? '*' : 'none' };
    await route.fulfill({
      contentType: 'application/json',
      headers,
      status: 200,
      body: JSON.stringify(['electric', 'gas']),
    });
  });
  {
    // Should succeed
    const resp = await page.evaluate(async () => {
      const response = await fetch('https://example.com/cars?allow', { mode: 'cors' });
      return response.json();
    });
    expect(resp).toEqual(['electric', 'gas']);
  }
  {
    // Should be rejected
    const error = await page.evaluate(async () => {
      const response = await fetch('https://example.com/cars?reject', { mode: 'cors' });
      return response.json();
    }).catch(e => e);
    if (browserName === 'chromium')
      expect(error.message).toContain('Failed');
    if (browserName === 'webkit')
      expect(error.message).toContain('TypeError');
    if (browserName === 'firefox')
      expect(error.message).toContain('NetworkError');
  }
});

it('should add Access-Control-Allow-Origin by default when fulfill', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/cars', async route => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify(['electric', 'gas']),
    });
  });

  const [result, response] = await Promise.all([
    page.evaluate(async () => {
      const response = await fetch('https://example.com/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ 'number': 1 })
      });
      return response.json();
    }),
    page.waitForResponse('https://example.com/cars')
  ]);
  expect(result).toEqual(['electric', 'gas']);
  expect(await response.headerValue('Access-Control-Allow-Origin')).toBe(server.PREFIX);
});

it('should allow null origin for about:blank', async ({ page, server, browserName }) => {
  await page.route('**/something', async route => {
    await route.fulfill({
      contentType: 'text/plain',
      status: 200,
      body: 'done',
    });
  });

  const [response, text] = await Promise.all([
    page.waitForResponse(server.CROSS_PROCESS_PREFIX + '/something'),
    page.evaluate(async url => {
      const data = await fetch(url, {
        method: 'GET',
        headers: { 'X-PINGOTHER': 'pingpong' }
      });
      return data.text();
    }, server.CROSS_PROCESS_PREFIX + '/something')
  ]);
  expect(text).toBe('done');
  expect(await response.headerValue('Access-Control-Allow-Origin')).toBe('null');
});

it('should respect cors overrides', async ({ page, server, browserName, isAndroid }) => {
  it.fail(isAndroid, 'no cors error in android emulator');
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/something', (request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-cache'
      });
      response.end();
      return;
    }
    response.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
    response.end('NOT FOUND');
  });
  // Fetch request should fail when CORS header doesn't include the origin.
  {
    await page.route('**/something', async route => {
      await route.fulfill({
        contentType: 'text/plain',
        status: 200,
        headers: { 'Access-Control-Allow-Origin': 'http://non-existent' },
        body: 'done',
      });
    });

    const error = await page.evaluate(async url => {
      const data = await fetch(url, {
        method: 'GET',
        headers: { 'X-PINGOTHER': 'pingpong' }
      });
      return data.text();
    }, server.CROSS_PROCESS_PREFIX + '/something').catch(e => e);
    if (browserName === 'chromium')
      expect(error.message).toContain('Failed to fetch');
    else if (browserName === 'webkit')
      expect(error.message).toContain('Load failed');
    else if (browserName === 'firefox')
      expect(error.message).toContain('NetworkError when attempting to fetch resource.');
  }
});

it('should not auto-intercept non-preflight OPTIONS', async ({ page, server, isAndroid, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20469' });
  it.fixme(isAndroid);

  await page.goto(server.EMPTY_PAGE);

  let requests = [];
  server.setRoute('/something', (request, response) => {
    requests.push(request.method + ':' + request.url);
    if (request.method === 'OPTIONS') {
      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-cache'
      });
      response.end(`Hello`);
      return;
    }
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('World');
  });

  // Without interception.
  {
    requests = [];
    const [text1, text2] = await page.evaluate(async url => {
      const response1 = await fetch(url, { method: 'OPTIONS' });
      const text1 = await response1.text();
      const response2 = await fetch(url, { method: 'GET' });
      const text2 = await response2.text();
      return [text1, text2];
    }, server.CROSS_PROCESS_PREFIX + '/something');
    expect.soft(text1).toBe('Hello');
    expect.soft(text2).toBe('World');
    // Preflight for OPTIONS, then OPTIONS, then GET without preflight.
    expect.soft(requests).toEqual(['OPTIONS:/something', 'OPTIONS:/something', 'GET:/something']);
  }

  // With interception.
  {
    await page.route('**/something', route => route.continue());

    requests = [];
    const [text1, text2] = await page.evaluate(async url => {
      const response1 = await fetch(url, { method: 'OPTIONS' });
      const text1 = await response1.text();
      const response2 = await fetch(url, { method: 'GET' });
      const text2 = await response2.text();
      return [text1, text2];
    }, server.CROSS_PROCESS_PREFIX + '/something');
    expect.soft(text1).toBe('Hello');
    expect.soft(text2).toBe('World');
    // Preflight for OPTIONS is auto-fulfilled, then OPTIONS, then GET without preflight.
    if (browserName === 'firefox')
      expect.soft(requests).toEqual(['OPTIONS:/something', 'OPTIONS:/something', 'GET:/something']);
    else
      expect.soft(requests).toEqual(['OPTIONS:/something', 'GET:/something']);
  }
});

it('should support cors with POST', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/cars', async route => {
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      status: 200,
      body: JSON.stringify(['electric', 'gas']),
    });
  });
  const resp = await page.evaluate(async () => {
    const response = await fetch('https://example.com/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify({ 'number': 1 })
    });
    return response.json();
  });
  expect(resp).toEqual(['electric', 'gas']);
});

it('should support cors with credentials', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/cars', async route => {
    await route.fulfill({
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': server.PREFIX,
        'Access-Control-Allow-Credentials': 'true'
      },
      status: 200,
      body: JSON.stringify(['electric', 'gas']),
    });
  });
  const resp = await page.evaluate(async () => {
    const response = await fetch('https://example.com/cars', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors',
      body: JSON.stringify({ 'number': 1 }),
      credentials: 'include'
    });
    return response.json();
  });
  expect(resp).toEqual(['electric', 'gas']);
});

it('should reject cors with disallowed credentials', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/cars', async route => {
    await route.fulfill({
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': server.PREFIX,
        // Should fail without this line below!
        // 'Access-Control-Allow-Credentials': 'true'
      },
      status: 200,
      body: JSON.stringify(['electric', 'gas']),
    });
  });
  let error = '';
  try {
    await page.evaluate(async () => {
      const response = await fetch('https://example.com/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ 'number': 1 }),
        credentials: 'include'
      });
      return response.json();
    });
  } catch (e) {
    error = e;
  }
  expect(error).toBeTruthy();
});

it('should support cors for different methods', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/cars', async (route, request) => {
    await route.fulfill({
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      status: 200,
      body: JSON.stringify([request.method(), 'electric', 'gas']),
    });
  });
  // First POST
  {
    const resp = await page.evaluate(async () => {
      const response = await fetch('https://example.com/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify({ 'number': 1 })
      });
      return response.json();
    });
    expect(resp).toEqual(['POST', 'electric', 'gas']);
  }
  // Then DELETE
  {
    const resp = await page.evaluate(async () => {
      const response = await fetch('https://example.com/cars', {
        method: 'DELETE',
        headers: {},
        mode: 'cors',
        body: ''
      });
      return response.json();
    });
    expect(resp).toEqual(['DELETE', 'electric', 'gas']);
  }
});

it('should support the times parameter with route matching', async ({ page, server }) => {
  const intercepted = [];
  await page.route('**/empty.html', route => {
    intercepted.push(1);
    void route.continue();
  }, { times: 1 });
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toHaveLength(1);
});

it('should work if handler with times parameter was removed from another handler', async ({ page, server }) => {
  const intercepted = [];
  const handler = async route => {
    intercepted.push('first');
    void route.continue();
  };
  await page.route('**/*', handler, { times: 1 });
  await page.route('**/*', async route => {
    intercepted.push('second');
    await page.unroute('**/*', handler);
    await route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual(['second']);
  intercepted.length = 0;
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual(['second']);
});

it('should support async handler w/ times', async ({ page, server }) => {
  await page.route('**/empty.html', async route => {
    await new Promise(f => setTimeout(f, 100));
    await route.fulfill({
      body: '<html>intercepted</html>',
      contentType: 'text/html'
    });
  }, { times: 1 });
  await page.goto(server.EMPTY_PAGE);
  await expect(page.locator('body')).toHaveText('intercepted');
  await page.goto(server.EMPTY_PAGE);
  await expect(page.locator('body')).not.toHaveText('intercepted');
});

it('should contain raw request header', async ({ page, server }) => {
  let headers: any;
  await page.route('**/*', async route => {
    headers = await route.request().allHeaders();
    void route.continue();
  });
  await page.goto(server.PREFIX + '/empty.html');
  expect(headers.accept).toBeTruthy();
});

it('should contain raw response header', async ({ page, server }) => {
  let request: any;
  await page.route('**/*', async route => {
    request = route.request();
    void route.continue();
  });
  await page.goto(server.PREFIX + '/empty.html');
  const response = await request.response();
  const headers = await response.allHeaders();
  expect(headers['content-type']).toBeTruthy();
});

it('should contain raw response header after fulfill', async ({ page, server }) => {
  let request: any;
  await page.route('**/*', async route => {
    request = route.request();
    await route.fulfill({
      status: 200,
      body: 'Hello',
      contentType: 'text/html',
    });
  });
  await page.goto(server.PREFIX + '/empty.html');
  const response = await request.response();
  const headers = await response.allHeaders();
  expect(headers['content-type']).toBeTruthy();
});

for (const method of ['fulfill', 'continue', 'fallback', 'abort'] as const) {
  it(`route.${method} should throw if called twice`, async ({ page, server }) => {
    let resolve;
    const resolvePromise = new Promise<Route>(f => resolve = f);
    await page.route('**/*', resolve);
    page.goto(server.PREFIX + '/empty.html').catch(() => {});
    const route = await resolvePromise;
    await route[method]();
    const e = await route[method]().catch(e => e);
    expect(e.message).toContain('Route is already handled!');
  });
}

it('should intercept when postData is more than 1MB', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22753' });
  await page.goto(server.EMPTY_PAGE);
  let interceptionCallback;
  const interceptionPromise = new Promise(x => interceptionCallback = x);
  const POST_BODY = '0'.repeat(2 * 1024 * 1024); // 2MB
  await page.route('**/404.html', async route => {
    await route.abort();
    interceptionCallback(route.request().postData());
  });
  await page.evaluate(POST_BODY => fetch('/404.html', {
    method: 'POST',
    body: POST_BODY,
  }).catch(e => {}), POST_BODY);
  expect(await interceptionPromise).toBe(POST_BODY);
});

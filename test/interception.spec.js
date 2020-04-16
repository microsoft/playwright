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

const fs = require('fs');
const path = require('path');
const { helper } = require('../lib/helper');
const vm = require('vm');
const {FFOX, CHROMIUM, WEBKIT} = require('./utils').testOptions(browserType);

describe('Page.route', function() {
  it('should intercept', async({page, server}) => {
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
      route.continue();
      intercepted = true;
    });
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
    expect(intercepted).toBe(true);
  });
  it('should unroute', async({page, server}) => {
    let intercepted = [];
    const handler1 = route => {
      intercepted.push(1);
      route.continue();
    };
    await page.route('**/empty.html', handler1);
    await page.route('**/empty.html', route => {
      intercepted.push(2);
      route.continue();
    });
    await page.route('**/empty.html', route => {
      intercepted.push(3);
      route.continue();
    });
    await page.route('**/*', route => {
      intercepted.push(4);
      route.continue();
    });
    await page.goto(server.EMPTY_PAGE);
    expect(intercepted).toEqual([1]);

    intercepted = [];
    await page.unroute('**/empty.html', handler1);
    await page.goto(server.EMPTY_PAGE);
    expect(intercepted).toEqual([2]);

    intercepted = [];
    await page.unroute('**/empty.html');
    await page.goto(server.EMPTY_PAGE);
    expect(intercepted).toEqual([4]);
  });
  it('should work when POST is redirected with 302', async({page, server}) => {
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
  it('should work when header manipulation headers with redirect', async({page, server}) => {
    server.setRedirect('/rrredirect', '/empty.html');
    await page.route('**/*', route => {
      const headers = Object.assign({}, route.request().headers(), {
        foo: 'bar'
      });
      route.continue({ headers });
    });
    await page.goto(server.PREFIX + '/rrredirect');
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/4743
  it('should be able to remove headers', async({page, server}) => {
    await page.route('**/*', route => {
      const headers = Object.assign({}, route.request().headers(), {
        foo: 'bar',
        origin: undefined, // remove "origin" header
      });
      route.continue({ headers });
    });

    const [serverRequest] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.PREFIX + '/empty.html')
    ]);

    expect(serverRequest.headers.origin).toBe(undefined);
  });
  it('should contain referer header', async({page, server}) => {
    const requests = [];
    await page.route('**/*', route => {
      requests.push(route.request());
      route.continue();
    });
    await page.goto(server.PREFIX + '/one-style.html');
    expect(requests[1].url()).toContain('/one-style.css');
    expect(requests[1].headers().referer).toContain('/one-style.html');
  });
  it('should properly return navigation response when URL has cookies', async({context, page, server}) => {
    // Setup cookie.
    await page.goto(server.EMPTY_PAGE);
    await context.addCookies([{ url: server.EMPTY_PAGE, name: 'foo', value: 'bar'}]);

    // Setup request interception.
    await page.route('**/*', route => route.continue());
    const response = await page.reload();
    expect(response.status()).toBe(200);
  });
  it('should show custom HTTP headers', async({page, server}) => {
    await page.setExtraHTTPHeaders({
      foo: 'bar'
    });
    await page.route('**/*', route => {
      expect(route.request().headers()['foo']).toBe('bar');
      route.continue();
    });
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
  });
  // @see https://github.com/GoogleChrome/puppeteer/issues/4337
  it('should work with redirect inside sync XHR', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    server.setRedirect('/logo.png', '/pptr.png');
    await page.route('**/*', route => route.continue());
    const status = await page.evaluate(async() => {
      const request = new XMLHttpRequest();
      request.open('GET', '/logo.png', false);  // `false` makes the request synchronous
      request.send(null);
      return request.status;
    });
    expect(status).toBe(200);
  });
  it('should work with custom referer headers', async({page, server}) => {
    await page.setExtraHTTPHeaders({ 'referer': server.EMPTY_PAGE });
    await page.route('**/*', route => {
      expect(route.request().headers()['referer']).toBe(server.EMPTY_PAGE);
      route.continue();
    });
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
  });
  it('should be abortable', async({page, server}) => {
    await page.route(/\.css$/, route => route.abort());
    let failedRequests = 0;
    page.on('requestfailed', event => ++failedRequests);
    const response = await page.goto(server.PREFIX + '/one-style.html');
    expect(response.ok()).toBe(true);
    expect(response.request().failure()).toBe(null);
    expect(failedRequests).toBe(1);
  });
  it('should be abortable with custom error codes', async({page, server}) => {
    await page.route('**/*', route => route.abort('internetdisconnected'));
    let failedRequest = null;
    page.on('requestfailed', request => failedRequest = request);
    await page.goto(server.EMPTY_PAGE).catch(e => {});
    expect(failedRequest).toBeTruthy();
    if (WEBKIT)
      expect(failedRequest.failure().errorText).toBe('Request intercepted');
    else if (FFOX)
      expect(failedRequest.failure().errorText).toBe('NS_ERROR_OFFLINE');
    else
      expect(failedRequest.failure().errorText).toBe('net::ERR_INTERNET_DISCONNECTED');
  });
  it('should send referer', async({page, server}) => {
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
  it('should fail navigation when aborting main resource', async({page, server}) => {
    await page.route('**/*', route => route.abort());
    let error = null;
    await page.goto(server.EMPTY_PAGE).catch(e => error = e);
    expect(error).toBeTruthy();
    if (WEBKIT)
      expect(error.message).toContain('Request intercepted');
    else if (FFOX)
      expect(error.message).toContain('NS_ERROR_FAILURE');
    else
      expect(error.message).toContain('net::ERR_FAILED');
  });
  it('should work with redirects', async({page, server}) => {
    const requests = [];
    await page.route('**/*', route => {
      route.continue();
      requests.push(route.request());
    });
    server.setRedirect('/non-existing-page.html', '/non-existing-page-2.html');
    server.setRedirect('/non-existing-page-2.html', '/non-existing-page-3.html');
    server.setRedirect('/non-existing-page-3.html', '/non-existing-page-4.html');
    server.setRedirect('/non-existing-page-4.html', '/empty.html');
    const response = await page.goto(server.PREFIX + '/non-existing-page.html');
    expect(response.status()).toBe(200);
    expect(response.url()).toContain('empty.html');
    expect(requests.length).toBe(5);
    expect(requests[2].resourceType()).toBe('document');
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
  it('should work with redirects for subresources', async({page, server}) => {
    const requests = [];
    await page.route('**/*', route => {
      route.continue();
      requests.push(route.request());
    });
    server.setRedirect('/one-style.css', '/two-style.css');
    server.setRedirect('/two-style.css', '/three-style.css');
    server.setRedirect('/three-style.css', '/four-style.css');
    server.setRoute('/four-style.css', (req, res) => res.end('body {box-sizing: border-box; }'));

    const response = await page.goto(server.PREFIX + '/one-style.html');
    expect(response.status()).toBe(200);
    expect(response.url()).toContain('one-style.html');
    expect(requests.length).toBe(5);
    expect(requests[0].resourceType()).toBe('document');

    let r = requests.find(r => r.url().includes('/four-style.css'));
    for (const url of ['/four-style.css', '/three-style.css', '/two-style.css', '/one-style.css']) {
      expect(r.resourceType()).toBe('stylesheet');
      expect(r.url()).toContain(url);
      r = r.redirectedFrom();
    }
    expect(r).toBe(null);
  });
  it('should work with equal requests', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    let responseCount = 1;
    server.setRoute('/zzz', (req, res) => res.end((responseCount++) * 11 + ''));

    let spinner = false;
    // Cancel 2nd request.
    await page.route('**/*', route => {
      spinner ? route.abort() : route.continue();
      spinner = !spinner;
    });
    const results = [];
    for (let i = 0; i < 3; i++)
      results.push(await page.evaluate(() => fetch('/zzz').then(response => response.text()).catch(e => 'FAILED')));
    expect(results).toEqual(['11', 'FAILED', '22']);
  });
  it('should navigate to dataURL and not fire dataURL requests', async({page, server}) => {
    const requests = [];
    await page.route('**/*', route => {
      requests.push(route.request());
      route.continue();
    });
    const dataURL = 'data:text/html,<div>yo</div>';
    const response = await page.goto(dataURL);
    expect(response).toBe(null);
    expect(requests.length).toBe(0);
  });
  it('should be able to fetch dataURL and not fire dataURL requests', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const requests = [];
    await page.route('**/*', route => {
      requests.push(route.request());
      route.continue();
    });
    const dataURL = 'data:text/html,<div>yo</div>';
    const text = await page.evaluate(url => fetch(url).then(r => r.text()), dataURL);
    expect(text).toBe('<div>yo</div>');
    expect(requests.length).toBe(0);
  });
  it('should navigate to URL with hash and and fire requests without hash', async({page, server}) => {
    const requests = [];
    await page.route('**/*', route => {
      requests.push(route.request());
      route.continue();
    });
    const response = await page.goto(server.EMPTY_PAGE + '#hash');
    expect(response.status()).toBe(200);
    expect(response.url()).toBe(server.EMPTY_PAGE);
    expect(requests.length).toBe(1);
    expect(requests[0].url()).toBe(server.EMPTY_PAGE);
  });
  it('should work with encoded server', async({page, server}) => {
    // The requestWillBeSent will report encoded URL, whereas interception will
    // report URL as-is. @see crbug.com/759388
    await page.route('**/*', route => route.continue());
    const response = await page.goto(server.PREFIX + '/some nonexisting page');
    expect(response.status()).toBe(404);
  });
  it('should work with badly encoded server', async({page, server}) => {
    server.setRoute('/malformed?rnd=%911', (req, res) => res.end());
    await page.route('**/*', route => route.continue());
    const response = await page.goto(server.PREFIX + '/malformed?rnd=%911');
    expect(response.status()).toBe(200);
  });
  it('should work with encoded server - 2', async({page, server}) => {
    // The requestWillBeSent will report URL as-is, whereas interception will
    // report encoded URL for stylesheet. @see crbug.com/759388
    const requests = [];
    await page.route('**/*', route => {
      route.continue();
      requests.push(route.request());
    });
    const response = await page.goto(`data:text/html,<link rel="stylesheet" href="${server.PREFIX}/fonts?helvetica|arial"/>`);
    expect(response).toBe(null);
    expect(requests.length).toBe(1);
    expect((await requests[0].response()).status()).toBe(404);
  });
  it('should not throw "Invalid Interception Id" if the request was cancelled', async({page, server}) => {
    await page.setContent('<iframe></iframe>');
    let route = null;
    await page.route('**/*', async r => route = r);
    page.$eval('iframe', (frame, url) => frame.src = url, server.EMPTY_PAGE),
    // Wait for request interception.
    await page.waitForEvent('request');
    // Delete frame to cause request to be canceled.
    await page.$eval('iframe', frame => frame.remove());
    let error = null;
    await route.continue().catch(e => error = e);
    expect(error).toBe(null);
  });
  it('should intercept main resource during cross-process navigation', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    let intercepted = false;
    await page.route(server.CROSS_PROCESS_PREFIX + '/empty.html', route => {
      intercepted = true;
      route.continue();
    });
    const response = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
    expect(response.ok()).toBe(true);
    expect(intercepted).toBe(true);
  });
  it('should create a redirect', async({page, server}) => {
    await page.goto(server.PREFIX + '/empty.html');
    await page.route('**/*', async(route, request) => {
      if (request.url() !== server.PREFIX + '/redirect_this')
        return route.continue();
      await route.fulfill({
        status: 301,
        headers: {
          'location': '/empty.html',
        }
      });
    });

    const text = await page.evaluate(async url => {
      const data = await fetch(url);
      return data.text();
    }, server.PREFIX + '/redirect_this');
    expect(text).toBe('');
  });
});

describe('Request.continue', function() {
  it('should work', async({page, server}) => {
    await page.route('**/*', route => route.continue());
    await page.goto(server.EMPTY_PAGE);
  });
  it('should amend HTTP headers', async({page, server}) => {
    await page.route('**/*', route => {
      const headers = Object.assign({}, route.request().headers());
      headers['FOO'] = 'bar';
      route.continue({ headers });
    });
    await page.goto(server.EMPTY_PAGE);
    const [request] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz'))
    ]);
    expect(request.headers['foo']).toBe('bar');
  });
  it('should amend method', async({page, server}) => {
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
  it('should amend method on main request', async({page, server}) => {
    const request = server.waitForRequest('/empty.html');
    await page.route('**/*', route => route.continue({ method: 'POST' }));
    await page.goto(server.EMPTY_PAGE);
    expect((await request).method).toBe('POST');
  });
  it('should amend post data', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      route.continue({ postData: 'doggo' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(await serverRequest.postBody).toBe('doggo');
  });
});

describe('Request.fulfill', function() {
  it('should work', async({page, server}) => {
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
  it('should work with status code 422', async({page, server}) => {
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
  it('should allow mocking binary responses', async({page, server, golden}) => {
    await page.route('**/*', route => {
      const imageBuffer = fs.readFileSync(path.join(__dirname, 'assets', 'pptr.png'));
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
    expect(await img.screenshot()).toBeGolden(golden('mock-binary-response.png'));
  });
  it('should work with file path', async({page, server, golden}) => {
    await page.route('**/*', route => route.fulfill({ contentType: 'shouldBeIgnored', path: path.join(__dirname, 'assets', 'pptr.png') }));
    await page.evaluate(PREFIX => {
      const img = document.createElement('img');
      img.src = PREFIX + '/does-not-exist.png';
      document.body.appendChild(img);
      return new Promise(fulfill => img.onload = fulfill);
    }, server.PREFIX);
    const img = await page.$('img');
    expect(await img.screenshot()).toBeGolden(golden('mock-binary-response.png'));
  });
  it('should stringify intercepted request response headers', async({page, server}) => {
    await page.route('**/*', route => {
      route.fulfill({
        status: 200,
        headers: {
          'foo': true
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
  it('should not modify the headers sent to the server', async({page, server}) => {
    await page.goto(server.PREFIX + '/empty.html');
    const interceptedRequests = [];

    //this is just to enable request interception, which disables caching in chromium
    await page.route(server.PREFIX + '/unused');

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

    let playwrightRequest;
    await page.route(server.CROSS_PROCESS_PREFIX + '/something', (route, request) => {
      playwrightRequest = request;
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
  it('should include the origin header', async({page, server}) => {
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
});

describe('Interception vs isNavigationRequest', () => {
  it('should work with request interception', async({page, server}) => {
    const requests = new Map();
    await page.route('**/*', route => {
      requests.set(route.request().url().split('/').pop(), route.request());
      route.continue();
    });
    server.setRedirect('/rrredirect', '/frames/one-frame.html');
    await page.goto(server.PREFIX + '/rrredirect');
    expect(requests.get('rrredirect').isNavigationRequest()).toBe(true);
    expect(requests.get('one-frame.html').isNavigationRequest()).toBe(true);
    expect(requests.get('frame.html').isNavigationRequest()).toBe(true);
    expect(requests.get('script.js').isNavigationRequest()).toBe(false);
    expect(requests.get('style.css').isNavigationRequest()).toBe(false);
  });
});

describe('ignoreHTTPSErrors', function() {
  it('should work with request interception', async({browser, httpsServer}) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.route('**/*', route => route.continue());
    const response = await page.goto(httpsServer.EMPTY_PAGE);
    expect(response.status()).toBe(200);
    await context.close();
  });
});

describe('service worker', function() {
  it('should intercept after a service worker', async({browser, page, server, context}) => {
    await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
    await page.evaluate(() => window.activationPromise);

    // Sanity check.
    const swResponse = await page.evaluate(() => fetchDummy('foo'));
    expect(swResponse).toBe('responseFromServiceWorker:foo');

    await page.route('**/foo', route => {
      const slash = route.request().url().lastIndexOf('/');
      const name = route.request().url().substring(slash + 1);
      route.fulfill({
        status: 200,
        contentType: 'text/css',
        body: 'responseFromInterception:' + name
      });
    });

    // Page route is applied after service worker fetch event.
    const swResponse2 = await page.evaluate(() => fetchDummy('foo'));
    expect(swResponse2).toBe('responseFromServiceWorker:foo');

    // Page route is not applied to service worker initiated fetch.
    const nonInterceptedResponse = await page.evaluate(() => fetchDummy('passthrough'));
    expect(nonInterceptedResponse).toBe('FAILURE: Not Found');
  });
});

describe('glob', function() {
  it('should work with glob', async({newPage, httpsServer}) => {
    expect(helper.globToRegex('**/*.js').test('https://localhost:8080/foo.js')).toBeTruthy();
    expect(helper.globToRegex('**/*.css').test('https://localhost:8080/foo.js')).toBeFalsy();
    expect(helper.globToRegex('*.js').test('https://localhost:8080/foo.js')).toBeFalsy();
    expect(helper.globToRegex('https://**/*.js').test('https://localhost:8080/foo.js')).toBeTruthy();
    expect(helper.globToRegex('http://localhost:8080/simple/path.js').test('http://localhost:8080/simple/path.js')).toBeTruthy();
    expect(helper.globToRegex('http://localhost:8080/?imple/path.js').test('http://localhost:8080/Simple/path.js')).toBeTruthy();
    expect(helper.globToRegex('**/{a,b}.js').test('https://localhost:8080/a.js')).toBeTruthy();
    expect(helper.globToRegex('**/{a,b}.js').test('https://localhost:8080/b.js')).toBeTruthy();
    expect(helper.globToRegex('**/{a,b}.js').test('https://localhost:8080/c.js')).toBeFalsy();

    expect(helper.globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.jpg')).toBeTruthy();
    expect(helper.globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.jpeg')).toBeTruthy();
    expect(helper.globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.png')).toBeTruthy();
    expect(helper.globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.css')).toBeFalsy();
  });
});

describe('regexp', function() {
  it('should work with regular expression passed from a different context', async({page, server}) => {
    const ctx = vm.createContext();
    const regexp = vm.runInContext('new RegExp("empty\\.html")', ctx);
    let intercepted = false;

    await page.route(regexp, (route, request) => {
      expect(route.request()).toBe(request);
      expect(request.url()).toContain('empty.html');
      expect(request.headers()['user-agent']).toBeTruthy();
      expect(request.method()).toBe('GET');
      expect(request.postData()).toBe(null);
      expect(request.isNavigationRequest()).toBe(true);
      expect(request.resourceType()).toBe('document');
      expect(request.frame() === page.mainFrame()).toBe(true);
      expect(request.frame().url()).toBe('about:blank');
      route.continue();
      intercepted = true;
    });

    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
    expect(intercepted).toBe(true);
  });
});

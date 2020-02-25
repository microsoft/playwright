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
const utils = require('./utils');
const vm = require('vm');

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function({testRunner, expect, defaultBrowserOptions, playwright, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.route', function() {
    it('should intercept', async({page, server}) => {
      await page.route('/empty.html', request => {
        expect(request.url()).toContain('empty.html');
        expect(request.headers()['user-agent']).toBeTruthy();
        expect(request.method()).toBe('GET');
        expect(request.postData()).toBe(undefined);
        expect(request.isNavigationRequest()).toBe(true);
        expect(request.resourceType()).toBe('document');
        expect(request.frame() === page.mainFrame()).toBe(true);
        expect(request.frame().url()).toBe('about:blank');
        request.continue();
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
    it('should work when POST is redirected with 302', async({page, server}) => {
      server.setRedirect('/rredirect', '/empty.html');
      await page.goto(server.EMPTY_PAGE);
      await page.route('**/*', request => request.continue());
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
      await page.route('**/*', request => {
        const headers = Object.assign({}, request.headers(), {
          foo: 'bar'
        });
        request.continue({ headers });
      });
      await page.goto(server.PREFIX + '/rrredirect');
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4743
    it('should be able to remove headers', async({page, server}) => {
      await page.route('**/*', request => {
        const headers = Object.assign({}, request.headers(), {
          foo: 'bar',
          origin: undefined, // remove "origin" header
        });
        request.continue({ headers });
      });

      const [serverRequest] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.PREFIX + '/empty.html')
      ]);

      expect(serverRequest.headers.origin).toBe(undefined);
    });
    it('should contain referer header', async({page, server}) => {
      const requests = [];
      await page.route('**/*', request => {
        requests.push(request);
        request.continue();
      });
      await page.goto(server.PREFIX + '/one-style.html');
      expect(requests[1].url()).toContain('/one-style.css');
      expect(requests[1].headers().referer).toContain('/one-style.html');
    });
    it('should properly return navigation response when URL has cookies', async({context, page, server}) => {
      // Setup cookie.
      await page.goto(server.EMPTY_PAGE);
      await context.setCookies([{ url: server.EMPTY_PAGE, name: 'foo', value: 'bar'}]);

      // Setup request interception.
      await page.route('**/*', request => request.continue());
      const response = await page.reload();
      expect(response.status()).toBe(200);
    });
    it('should show custom HTTP headers', async({page, server}) => {
      await page.setExtraHTTPHeaders({
        foo: 'bar'
      });
      await page.route('**/*', request => {
        expect(request.headers()['foo']).toBe('bar');
        request.continue();
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4337
    it('should work with redirect inside sync XHR', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      server.setRedirect('/logo.png', '/pptr.png');
      await page.route('**/*', request => request.continue());
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
      await page.route('**/*', request => {
        expect(request.headers()['referer']).toBe(server.EMPTY_PAGE);
        request.continue();
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
    it('should be abortable', async({page, server}) => {
      await page.route(/\.css$/, request => request.abort());
      let failedRequests = 0;
      page.on('requestfailed', event => ++failedRequests);
      const response = await page.goto(server.PREFIX + '/one-style.html');
      expect(response.ok()).toBe(true);
      expect(response.request().failure()).toBe(null);
      expect(failedRequests).toBe(1);
    });
    it('should be abortable with custom error codes', async({page, server}) => {
      await page.route('**/*', request => request.abort('internetdisconnected'));
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
      await page.route('**/*', request => request.continue());
      const [request] = await Promise.all([
        server.waitForRequest('/grid.html'),
        page.goto(server.PREFIX + '/grid.html'),
      ]);
      expect(request.headers['referer']).toBe('http://google.com/');
    });
    it('should fail navigation when aborting main resource', async({page, server}) => {
      await page.route('**/*', request => request.abort());
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
      await page.route('**/*', request => {
        request.continue();
        requests.push(request);
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
      // Check redirect chain
      const redirectChain = response.request().redirectChain();
      expect(redirectChain.length).toBe(4);
      expect(redirectChain[0].url()).toContain('/non-existing-page.html');
      expect(redirectChain[2].url()).toContain('/non-existing-page-3.html');
      for (let i = 0; i < redirectChain.length; ++i) {
        const request = redirectChain[i];
        expect(request.isNavigationRequest()).toBe(true);
        expect(request.redirectChain().indexOf(request)).toBe(i);
      }
    });
    it('should work with redirects for subresources', async({page, server}) => {
      const requests = [];
      await page.route('**/*', request => {
        request.continue();
        requests.push(request);
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
      expect(requests[1].resourceType()).toBe('stylesheet');
      // Check redirect chain
      const redirectChain = requests[1].redirectChain();
      expect(redirectChain.length).toBe(3);
      expect(redirectChain[0].url()).toContain('/one-style.css');
      expect(redirectChain[2].url()).toContain('/three-style.css');
    });
    it('should work with equal requests', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      let responseCount = 1;
      server.setRoute('/zzz', (req, res) => res.end((responseCount++) * 11 + ''));

      let spinner = false;
      // Cancel 2nd request.
      await page.route('**/*', request => {
        spinner ? request.abort() : request.continue();
        spinner = !spinner;
      });
      const results = await page.evaluate(() => Promise.all([
        fetch('/zzz').then(response => response.text()).catch(e => 'FAILED'),
        fetch('/zzz').then(response => response.text()).catch(e => 'FAILED'),
        fetch('/zzz').then(response => response.text()).catch(e => 'FAILED'),
      ]));
      expect(results).toEqual(['11', 'FAILED', '22']);
    });
    it('should navigate to dataURL and not fire dataURL requests', async({page, server}) => {
      const requests = [];
      await page.route('**/*', request => {
        requests.push(request);
        request.continue();
      });
      const dataURL = 'data:text/html,<div>yo</div>';
      const response = await page.goto(dataURL);
      expect(response).toBe(null);
      expect(requests.length).toBe(0);
    });
    it('should be able to fetch dataURL and not fire dataURL requests', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const requests = [];
      await page.route('**/*', request => {
        requests.push(request);
        request.continue();
      });
      const dataURL = 'data:text/html,<div>yo</div>';
      const text = await page.evaluate(url => fetch(url).then(r => r.text()), dataURL);
      expect(text).toBe('<div>yo</div>');
      expect(requests.length).toBe(0);
    });
    it('should navigate to URL with hash and and fire requests without hash', async({page, server}) => {
      const requests = [];
      await page.route('**/*', request => {
        requests.push(request);
        request.continue();
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
      await page.route('**/*', request => request.continue());
      const response = await page.goto(server.PREFIX + '/some nonexisting page');
      expect(response.status()).toBe(404);
    });
    it('should work with badly encoded server', async({page, server}) => {
      server.setRoute('/malformed?rnd=%911', (req, res) => res.end());
      await page.route('**/*', request => request.continue());
      const response = await page.goto(server.PREFIX + '/malformed?rnd=%911');
      expect(response.status()).toBe(200);
    });
    it('should work with encoded server - 2', async({page, server}) => {
      // The requestWillBeSent will report URL as-is, whereas interception will
      // report encoded URL for stylesheet. @see crbug.com/759388
      const requests = [];
      await page.route('**/*', request => {
        request.continue();
        requests.push(request);
      });
      const response = await page.goto(`data:text/html,<link rel="stylesheet" href="${server.PREFIX}/fonts?helvetica|arial"/>`);
      expect(response).toBe(null);
      expect(requests.length).toBe(1);
      expect(requests[0].response().status()).toBe(404);
    });
    it('should not throw "Invalid Interception Id" if the request was cancelled', async({page, server}) => {
      await page.setContent('<iframe></iframe>');
      let request = null;
      await page.route('**/*', async r => request = r);
      page.$eval('iframe', (frame, url) => frame.src = url, server.EMPTY_PAGE),
      // Wait for request interception.
      await utils.waitEvent(page, 'request');
      // Delete frame to cause request to be canceled.
      await page.$eval('iframe', frame => frame.remove());
      let error = null;
      await request.continue().catch(e => error = e);
      expect(error).toBe(null);
    });
    it('should throw if interception is not enabled', async({browser, server}) => {
      let error = null;
      const context = await browser.newContext();
      const page = await context.newPage();
      page.on('request', async request => {
        try {
          await request.continue();
        } catch (e) {
          error = e;
        }
      });
      await page.goto(server.EMPTY_PAGE);
      expect(error.message).toContain('Request Interception is not enabled');
      await context.close();
    });
    it('should intercept main resource during cross-process navigation', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      let intercepted = false;
      await page.route(server.CROSS_PROCESS_PREFIX + '/empty.html', request => {
        intercepted = true;
        request.continue();
      });
      const response = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      expect(response.ok()).toBe(true);
      expect(intercepted).toBe(true);
    });
    it('should not throw when continued after navigation', async({page, server}) => {
      await page.route(server.PREFIX + '/one-style.css', () => {});
      // For some reason, Firefox issues load event with one outstanding request.
      const firstNavigation = page.goto(server.PREFIX + '/one-style.html', { waitUntil: FFOX ? 'networkidle0' : 'load' }).catch(e => e);
      const request = await page.waitForRequest(server.PREFIX + '/one-style.css');
      await page.goto(server.PREFIX + '/empty.html');
      await firstNavigation;
      const notAnError = await request.continue().then(() => null).catch(e => e);
      expect(notAnError).toBe(null);
    });
    it('should not throw when continued after cross-process navigation', async({page, server}) => {
      await page.route(server.PREFIX + '/one-style.css', () => {});
      // For some reason, Firefox issues load event with one outstanding request.
      const firstNavigation = page.goto(server.PREFIX + '/one-style.html', { waitUntil: FFOX ? 'networkidle0' : 'load' }).catch(e => e);
      const request = await page.waitForRequest(server.PREFIX + '/one-style.css');
      await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      await firstNavigation;
      const notAnError = await request.continue().then(() => null).catch(e => e);
      expect(notAnError).toBe(null);
    });
  });

  describe('Request.continue', function() {
    it('should work', async({page, server}) => {
      await page.route('**/*', request => request.continue());
      await page.goto(server.EMPTY_PAGE);
    });
    it('should amend HTTP headers', async({page, server}) => {
      await page.route('**/*', request => {
        const headers = Object.assign({}, request.headers());
        headers['FOO'] = 'bar';
        request.continue({ headers });
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
      await page.route('**/*', request => request.continue({ method: 'POST' }));
      const [request] = await Promise.all([
        server.waitForRequest('/sleep.zzz'),
        page.evaluate(() => fetch('/sleep.zzz'))
      ]);
      expect(request.method).toBe('POST');
      expect((await sRequest).method).toBe('POST');
    });
    it('should amend method on main request', async({page, server}) => {
      const request = server.waitForRequest('/empty.html');
      await page.route('**/*', request => request.continue({ method: 'POST' }));
      await page.goto(server.EMPTY_PAGE);
      expect((await request).method).toBe('POST');
    });
    it('should amend post data', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.route('**/*', request => {
        request.continue({ postData: 'doggo' });
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
      await page.route('**/*', request => {
        request.fulfill({
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
      await page.route('**/*', request => {
        request.fulfill({
          status: 422,
          body: 'Yo, page!'
        });
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(422);
      expect(response.statusText()).toBe('Unprocessable Entity');
      expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
    });
    it('should allow mocking binary responses', async({page, server}) => {
      await page.route('**/*', request => {
        const imageBuffer = fs.readFileSync(path.join(__dirname, 'assets', 'pptr.png'));
        request.fulfill({
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
      expect(await img.screenshot()).toBeGolden('mock-binary-response.png');
    });
    it('should stringify intercepted request response headers', async({page, server}) => {
      await page.route('**/*', request => {
        request.fulfill({
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
  });

  describe('Page.authenticate', function() {
    it('should work', async({page, server}) => {
      server.setAuth('/empty.html', 'user', 'pass');
      let response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(401);
      await page.authenticate({
        username: 'user',
        password: 'pass'
      });
      response = await page.reload();
      expect(response.status()).toBe(200);
    });
    it('should fail if wrong credentials', async({page, server}) => {
      // Use unique user/password since Chromium caches credentials per origin.
      server.setAuth('/empty.html', 'user2', 'pass2');
      await page.authenticate({
        username: 'foo',
        password: 'bar'
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(401);
    });
    it('should allow disable authentication', async({page, server}) => {
      // Use unique user/password since Chromium caches credentials per origin.
      server.setAuth('/empty.html', 'user3', 'pass3');
      await page.authenticate({
        username: 'user3',
        password: 'pass3'
      });
      let response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(200);
      await page.authenticate(null);
      // Navigate to a different origin to bust Chromium's credential caching.
      response = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      expect(response.status()).toBe(401);
    });
  });

  describe.skip(FFOX)('Interception.setOfflineMode', function() {
    it('should work', async({page, server}) => {
      await page.setOfflineMode(true);
      let error = null;
      await page.goto(server.EMPTY_PAGE).catch(e => error = e);
      expect(error).toBeTruthy();
      await page.setOfflineMode(false);
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(200);
    });
    it('should emulate navigator.onLine', async({page, server}) => {
      expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
      await page.setOfflineMode(true);
      expect(await page.evaluate(() => window.navigator.onLine)).toBe(false);
      await page.setOfflineMode(false);
      expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
    });
  });

  describe('Interception vs isNavigationRequest', () => {
    it('should work with request interception', async({page, server}) => {
      const requests = new Map();
      await page.route('**/*', request => {
        requests.set(request.url().split('/').pop(), request);
        request.continue();
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
      const context = await browser.newContext({ ignoreHTTPSErrors: true, interceptNetwork: true });
      const page = await context.newPage();

      await page.route('**/*', request => request.continue());
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

      await page.route('**/foo', request => {
        const slash = request.url().lastIndexOf('/');
        const name = request.url().substring(slash + 1);
        request.fulfill({
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

      await page.route(regexp, request => {
        expect(request.url()).toContain('empty.html');
        expect(request.headers()['user-agent']).toBeTruthy();
        expect(request.method()).toBe('GET');
        expect(request.postData()).toBe(undefined);
        expect(request.isNavigationRequest()).toBe(true);
        expect(request.resourceType()).toBe('document');
        expect(request.frame() === page.mainFrame()).toBe(true);
        expect(request.frame().url()).toBe('about:blank');
        request.continue();
      });

      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
  });
};

/**
 * @param {string} path
 * @return {string}
 */
function pathToFileURL(path) {
  let pathName = path.replace(/\\/g, '/');
  // Windows drive letter must be prefixed with a slash.
  if (!pathName.startsWith('/'))
    pathName = '/' + pathName;
  return 'file://' + pathName;
}

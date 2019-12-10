/**
 * Copyright 2018 Google Inc. All rights reserved.
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
const utils = require('../utils');

module.exports.addTests = function({testRunner, expect, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Interception.enable', function() {
    it('should intercept', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        if (utils.isFavicon(request)) {
          page.interception.continue(request);
          return;
        }
        expect(request.url()).toContain('empty.html');
        expect(request.headers()['user-agent']).toBeTruthy();
        expect(request.method()).toBe('GET');
        expect(request.postData()).toBe(undefined);
        expect(request.isNavigationRequest()).toBe(true);
        expect(request.resourceType()).toBe('document');
        expect(request.frame() === page.mainFrame()).toBe(true);
        expect(request.frame().url()).toBe('about:blank');
        page.interception.continue(request);
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
      expect(response.remoteAddress().port).toBe(server.PORT);
    });
    it('should work when POST is redirected with 302', async({page, server}) => {
      server.setRedirect('/rredirect', '/empty.html');
      await page.goto(server.EMPTY_PAGE);
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
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
      await page.interception.enable();
      page.on('request', request => {
        const headers = Object.assign({}, request.headers(), {
          foo: 'bar'
        });
        page.interception.continue(request, { headers });
      });
      await page.goto(server.PREFIX + '/rrredirect');
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4743
    it('should be able to remove headers', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        const headers = Object.assign({}, request.headers(), {
          foo: 'bar',
          origin: undefined, // remove "origin" header
        });
        page.interception.continue(request, { headers });
      });

      const [serverRequest] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.PREFIX + '/empty.html')
      ]);

      expect(serverRequest.headers.origin).toBe(undefined);
    });
    it('should contain referer header', async({page, server}) => {
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        if (!utils.isFavicon(request))
          requests.push(request);
        page.interception.continue(request);
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
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
      const response = await page.reload();
      expect(response.status()).toBe(200);
    });
    it('should stop intercepting', async({page, server}) => {
      await page.interception.enable();
      page.once('request', request => page.interception.continue(request));
      await page.goto(server.EMPTY_PAGE);
      await page.interception.disable();
      await page.goto(server.EMPTY_PAGE);
    });
    it('should show custom HTTP headers', async({page, server}) => {
      await page.setExtraHTTPHeaders({
        foo: 'bar'
      });
      await page.interception.enable();
      page.on('request', request => {
        expect(request.headers()['foo']).toBe('bar');
        page.interception.continue(request);
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
    // @see https://github.com/GoogleChrome/puppeteer/issues/4337
    it('should work with redirect inside sync XHR', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      server.setRedirect('/logo.png', '/pptr.png');
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
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
      await page.interception.enable();
      page.on('request', request => {
        expect(request.headers()['referer']).toBe(server.EMPTY_PAGE);
        page.interception.continue(request);
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
    it('should be abortable', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        if (request.url().endsWith('.css'))
          page.interception.abort(request);
        else
          page.interception.continue(request);
      });
      let failedRequests = 0;
      page.on('requestfailed', event => ++failedRequests);
      const response = await page.goto(server.PREFIX + '/one-style.html');
      expect(response.ok()).toBe(true);
      expect(response.request().failure()).toBe(null);
      expect(failedRequests).toBe(1);
    });
    it.skip(FFOX)('should be abortable with custom error codes', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        page.interception.abort(request, 'internetdisconnected');
      });
      let failedRequest = null;
      page.on('requestfailed', request => failedRequest = request);
      await page.goto(server.EMPTY_PAGE).catch(e => {});
      expect(failedRequest).toBeTruthy();
      expect(failedRequest.failure().errorText).toBe('net::ERR_INTERNET_DISCONNECTED');
    });
    it('should send referer', async({page, server}) => {
      await page.setExtraHTTPHeaders({
        referer: 'http://google.com/'
      });
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
      const [request] = await Promise.all([
        server.waitForRequest('/grid.html'),
        page.goto(server.PREFIX + '/grid.html'),
      ]);
      expect(request.headers['referer']).toBe('http://google.com/');
    });
    it('should fail navigation when aborting main resource', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => page.interception.abort(request));
      let error = null;
      await page.goto(server.EMPTY_PAGE).catch(e => error = e);
      expect(error).toBeTruthy();
      if (CHROME || WEBKIT)
        expect(error.message).toContain('net::ERR_FAILED');
      else
        expect(error.message).toContain('NS_ERROR_FAILURE');
    });
    it('should work with redirects', async({page, server}) => {
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        page.interception.continue(request);
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
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        page.interception.continue(request);
        if (!utils.isFavicon(request))
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
    it('should be able to abort redirects', async({page, server}) => {
      await page.interception.enable();
      server.setRedirect('/non-existing.json', '/non-existing-2.json');
      server.setRedirect('/non-existing-2.json', '/simple.html');
      page.on('request', request => {
        if (request.url().includes('non-existing-2'))
          page.interception.abort(request);
        else
          page.interception.continue(request);
      });
      await page.goto(server.EMPTY_PAGE);
      const result = await page.evaluate(async() => {
        try {
          await fetch('/non-existing.json');
        } catch (e) {
          return e.message;
        }
      });
      if (CHROME)
        expect(result).toContain('Failed to fetch');
      else
        expect(result).toContain('NetworkError');
    });
    it('should work with equal requests', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      let responseCount = 1;
      server.setRoute('/zzz', (req, res) => res.end((responseCount++) * 11 + ''));
      await page.interception.enable();

      let spinner = false;
      // Cancel 2nd request.
      page.on('request', request => {
        if (utils.isFavicon(request)) {
          page.interception.continue(request);
          return;
        }
        spinner ? page.interception.abort(request) : page.interception.continue(request);
        spinner = !spinner;
      });
      const results = await page.evaluate(() => Promise.all([
        fetch('/zzz').then(response => response.text()).catch(e => 'FAILED'),
        fetch('/zzz').then(response => response.text()).catch(e => 'FAILED'),
        fetch('/zzz').then(response => response.text()).catch(e => 'FAILED'),
      ]));
      expect(results).toEqual(['11', 'FAILED', '22']);
    });
    it.skip(FFOX)('should navigate to dataURL and fire dataURL requests', async({page, server}) => {
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        requests.push(request);
        page.interception.continue(request);
      });
      const dataURL = 'data:text/html,<div>yo</div>';
      const response = await page.goto(dataURL);
      expect(response.status()).toBe(200);
      expect(requests.length).toBe(1);
      expect(requests[0].url()).toBe(dataURL);
    });
    it.skip(FFOX)('should be able to fetch dataURL and fire dataURL requests', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        requests.push(request);
        page.interception.continue(request);
      });
      const dataURL = 'data:text/html,<div>yo</div>';
      const text = await page.evaluate(url => fetch(url).then(r => r.text()), dataURL);
      expect(text).toBe('<div>yo</div>');
      expect(requests.length).toBe(1);
      expect(requests[0].url()).toBe(dataURL);
    });
    it.skip(FFOX)('should navigate to URL with hash and and fire requests without hash', async({page, server}) => {
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        requests.push(request);
        page.interception.continue(request);
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
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
      const response = await page.goto(server.PREFIX + '/some nonexisting page');
      expect(response.status()).toBe(404);
    });
    it('should work with badly encoded server', async({page, server}) => {
      await page.interception.enable();
      server.setRoute('/malformed?rnd=%911', (req, res) => res.end());
      page.on('request', request => page.interception.continue(request));
      const response = await page.goto(server.PREFIX + '/malformed?rnd=%911');
      expect(response.status()).toBe(200);
    });
    it.skip(FFOX)('should work with encoded server - 2', async({page, server}) => {
      // The requestWillBeSent will report URL as-is, whereas interception will
      // report encoded URL for stylesheet. @see crbug.com/759388
      await page.interception.enable();
      const requests = [];
      page.on('request', request => {
        page.interception.continue(request);
        requests.push(request);
      });
      const response = await page.goto(`data:text/html,<link rel="stylesheet" href="${server.PREFIX}/fonts?helvetica|arial"/>`);
      expect(response.status()).toBe(200);
      expect(requests.length).toBe(2);
      expect(requests[1].response().status()).toBe(404);
    });
    it.skip(FFOX)('should not throw "Invalid Interception Id" if the request was cancelled', async({page, server}) => {
      await page.setContent('<iframe></iframe>');
      await page.interception.enable();
      let request = null;
      page.on('request', async r => request = r);
      page.$eval('iframe', (frame, url) => frame.src = url, server.EMPTY_PAGE),
      // Wait for request interception.
      await utils.waitEvent(page, 'request');
      // Delete frame to cause request to be canceled.
      await page.$eval('iframe', frame => frame.remove());
      let error = null;
      await page.interception.continue(request).catch(e => error = e);
      expect(error).toBe(null);
    });
    it('should throw if interception is not enabled', async({page, server}) => {
      let error = null;
      page.on('request', async request => {
        try {
          await page.interception.continue(request);
        } catch (e) {
          error = e;
        }
      });
      await page.goto(server.EMPTY_PAGE);
      expect(error.message).toContain('Request Interception is not enabled');
    });
    it.skip(FFOX)('should work with file URLs', async({page, server}) => {
      await page.interception.enable();
      const urls = new Set();
      page.on('request', request => {
        urls.add(request.url().split('/').pop());
        page.interception.continue(request);
      });
      await page.goto(pathToFileURL(path.join(__dirname, '..', 'assets', 'one-style.html')));
      expect(urls.size).toBe(2);
      expect(urls.has('one-style.html')).toBe(true);
      expect(urls.has('one-style.css')).toBe(true);
    });
  });

  describe.skip(WEBKIT)('Interception.continue', function() {
    it('should work', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => page.interception.continue(request));
      await page.goto(server.EMPTY_PAGE);
    });
    it('should amend HTTP headers', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        const headers = Object.assign({}, request.headers());
        headers['FOO'] = 'bar';
        page.interception.continue(request, { headers });
      });
      await page.goto(server.EMPTY_PAGE);
      const [request] = await Promise.all([
        server.waitForRequest('/sleep.zzz'),
        page.evaluate(() => fetch('/sleep.zzz'))
      ]);
      expect(request.headers['foo']).toBe('bar');
    });
    it.skip(FFOX)('should redirect in a way non-observable to page', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        const redirectURL = request.url().includes('/empty.html') ? server.PREFIX + '/consolelog.html' : undefined;
        page.interception.continue(request, { url: redirectURL });
      });
      let consoleMessage = null;
      page.on('console', msg => consoleMessage = msg);
      await page.goto(server.EMPTY_PAGE);
      expect(page.url()).toBe(server.EMPTY_PAGE);
      expect(consoleMessage.text()).toBe('yellow');
    });
    it.skip(FFOX)('should amend method', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);

      await page.interception.enable();
      page.on('request', request => {
        page.interception.continue(request, { method: 'POST' });
      });
      const [request] = await Promise.all([
        server.waitForRequest('/sleep.zzz'),
        page.evaluate(() => fetch('/sleep.zzz'))
      ]);
      expect(request.method).toBe('POST');
    });
    it.skip(FFOX)('should amend post data', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);

      await page.interception.enable();
      page.on('request', request => {
        page.interception.continue(request, { postData: 'doggo' });
      });
      const [serverRequest] = await Promise.all([
        server.waitForRequest('/sleep.zzz'),
        page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
      ]);
      expect(await serverRequest.postBody).toBe('doggo');
    });
    it.skip(FFOX)('should amend both post data and method on navigation', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        page.interception.continue(request, { method: 'POST', postData: 'doggo' });
      });
      const [serverRequest] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.EMPTY_PAGE),
      ]);
      expect(serverRequest.method).toBe('POST');
      expect(await serverRequest.postBody).toBe('doggo');
    });
  });

  describe.skip(FFOX || WEBKIT)('interception.fulfill', function() {
    it('should work', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        page.interception.fulfill(request, {
          status: 201,
          headers: {
            foo: 'bar'
          },
          body: 'Yo, page!'
        });
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(201);
      expect(response.headers().foo).toBe('bar');
      expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
    });
    it('should work with status code 422', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        page.interception.fulfill(request, {
          status: 422,
          body: 'Yo, page!'
        });
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(422);
      expect(response.statusText()).toBe('Unprocessable Entity');
      expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
    });
    it('should redirect', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        if (!request.url().includes('rrredirect')) {
          page.interception.continue(request);
          return;
        }
        page.interception.fulfill(request, {
          status: 302,
          headers: {
            location: server.EMPTY_PAGE,
          },
        });
      });
      const response = await page.goto(server.PREFIX + '/rrredirect');
      expect(response.request().redirectChain().length).toBe(1);
      expect(response.request().redirectChain()[0].url()).toBe(server.PREFIX + '/rrredirect');
      expect(response.url()).toBe(server.EMPTY_PAGE);
    });
    it('should allow mocking binary responses', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        const imageBuffer = fs.readFileSync(path.join(__dirname, '..', 'assets', 'pptr.png'));
        page.interception.fulfill(request, {
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
      await page.interception.enable();
      page.on('request', request => {
        page.interception.fulfill(request, {
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

  describe.skip(FFOX)('Interception.authenticate', function() {
    it('should work', async({page, server}) => {
      server.setAuth('/empty.html', 'user', 'pass');
      let response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(401);
      await page.interception.authenticate({
        username: 'user',
        password: 'pass'
      });
      response = await page.reload();
      expect(response.status()).toBe(200);
    });
    it('should fail if wrong credentials', async({page, server}) => {
      // Use unique user/password since Chrome caches credentials per origin.
      server.setAuth('/empty.html', 'user2', 'pass2');
      await page.interception.authenticate({
        username: 'foo',
        password: 'bar'
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(401);
    });
    it('should allow disable authentication', async({page, server}) => {
      // Use unique user/password since Chrome caches credentials per origin.
      server.setAuth('/empty.html', 'user3', 'pass3');
      await page.interception.authenticate({
        username: 'user3',
        password: 'pass3'
      });
      let response = await page.goto(server.EMPTY_PAGE);
      expect(response.status()).toBe(200);
      await page.interception.authenticate(null);
      // Navigate to a different origin to bust Chrome's credential caching.
      response = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
      expect(response.status()).toBe(401);
    });
  });

  
  describe.skip(FFOX)('Interception.setOfflineMode', function() {
    it('should work', async({page, server}) => {
      await page.interception.setOfflineMode(true);
      let error = null;
      await page.goto(server.EMPTY_PAGE).catch(e => error = e);
      expect(error).toBeTruthy();
      await page.interception.setOfflineMode(false);
      const response = await page.reload();
      expect(response.status()).toBe(200);
    });
    it('should emulate navigator.onLine', async({page, server}) => {
      expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
      await page.interception.setOfflineMode(true);
      expect(await page.evaluate(() => window.navigator.onLine)).toBe(false);
      await page.interception.setOfflineMode(false);
      expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
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

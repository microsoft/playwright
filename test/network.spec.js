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
const utils = require('./utils');

module.exports.addTests = function({testRunner, expect, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.Events.Request', function() {
    it('should fire for navigation requests', async({page, server}) => {
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      await page.goto(server.EMPTY_PAGE);
      expect(requests.length).toBe(1);
    });
    it('should fire for iframes', async({page, server}) => {
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      expect(requests.length).toBe(2);
    });
    it('should fire for fetches', async({page, server}) => {
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => fetch('/empty.html'));
      expect(requests.length).toBe(2);
    });
  });

  describe('Request.frame', function() {
    it('should work for main frame navigation request', async({page, server}) => {
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      await page.goto(server.EMPTY_PAGE);
      expect(requests.length).toBe(1);
      expect(requests[0].frame()).toBe(page.mainFrame());
    });
    // FIXME: needs frameAttached event, otherwise it introduces too many hacks in the lib.
    it.skip(WEBKIT)('should work for subframe navigation request', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      expect(requests.length).toBe(1);
      expect(requests[0].frame()).toBe(page.frames()[1]);
    });
    it('should work for fetch requests', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      let requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      await page.evaluate(() => fetch('/digits/1.png'));
      requests = requests.filter(request => !request.url().includes('favicon'));
      expect(requests.length).toBe(1);
      expect(requests[0].frame()).toBe(page.mainFrame());
    });
  });

  describe('Request.headers', function() {
    it('should work', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE);
      if (CHROME)
        expect(response.request().headers()['user-agent']).toContain('Chrome');
      else if (FFOX)
        expect(response.request().headers()['user-agent']).toContain('Firefox');
      else if (WEBKIT)
        expect(response.request().headers()['user-agent']).toContain('WebKit');
    });
  });

  describe('Response.headers', function() {
    it('should work', async({page, server}) => {
      server.setRoute('/empty.html', (req, res) => {
        res.setHeader('foo', 'bar');
        res.end();
      });
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.headers()['foo']).toBe('bar');
    });
  });

  describe('Request.postData', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      server.setRoute('/post', (req, res) => res.end());
      let request = null;
      page.on('request', r => request = r);
      await page.evaluate(() => fetch('./post', { method: 'POST', body: JSON.stringify({foo: 'bar'})}));
      expect(request).toBeTruthy();
      expect(request.postData()).toBe('{"foo":"bar"}');
    });
    it('should be |undefined| when there is no post data', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.request().postData()).toBe(undefined);
    });
  });

  describe('Response.text', function() {
    it('should work', async({page, server}) => {
      const response = await page.goto(server.PREFIX + '/simple.json');
      expect(await response.text()).toBe('{"foo": "bar"}\n');
    });
    it('should return uncompressed text', async({page, server}) => {
      server.enableGzip('/simple.json');
      const response = await page.goto(server.PREFIX + '/simple.json');
      expect(response.headers()['content-encoding']).toBe('gzip');
      expect(await response.text()).toBe('{"foo": "bar"}\n');
    });
    it('should throw when requesting body of redirected response', async({page, server}) => {
      server.setRedirect('/foo.html', '/empty.html');
      const response = await page.goto(server.PREFIX + '/foo.html');
      const redirectChain = response.request().redirectChain();
      expect(redirectChain.length).toBe(1);
      const redirected = redirectChain[0].response();
      expect(redirected.status()).toBe(302);
      let error = null;
      await redirected.text().catch(e => error = e);
      expect(error.message).toContain('Response body is unavailable for redirect responses');
    });
    it('should wait until response completes', async({page, server}) => {
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
        page.waitForResponse(r => !utils.isFavicon(r.request())),
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
  });

  describe('Response.json', function() {
    it('should work', async({page, server}) => {
      const response = await page.goto(server.PREFIX + '/simple.json');
      expect(await response.json()).toEqual({foo: 'bar'});
    });
  });

  describe('Response.buffer', function() {
    it('should work', async({page, server}) => {
      const response = await page.goto(server.PREFIX + '/pptr.png');
      const imageBuffer = fs.readFileSync(path.join(__dirname, 'assets', 'pptr.png'));
      const responseBuffer = await response.buffer();
      expect(responseBuffer.equals(imageBuffer)).toBe(true);
    });
    it('should work with compression', async({page, server}) => {
      server.enableGzip('/pptr.png');
      const response = await page.goto(server.PREFIX + '/pptr.png');
      const imageBuffer = fs.readFileSync(path.join(__dirname, 'assets', 'pptr.png'));
      const responseBuffer = await response.buffer();
      expect(responseBuffer.equals(imageBuffer)).toBe(true);
    });
  });

  describe('Response.statusText', function() {
    it('should work', async({page, server}) => {
      server.setRoute('/cool', (req, res) => {
        res.writeHead(200, 'cool!');
        res.end();
      });
      const response = await page.goto(server.PREFIX + '/cool');
      expect(response.statusText()).toBe('cool!');
    });
  });

  describe('Network Events', function() {
    it('Page.Events.Request', async({page, server}) => {
      const requests = [];
      page.on('request', request => requests.push(request));
      await page.goto(server.EMPTY_PAGE);
      expect(requests.length).toBe(1);
      expect(requests[0].url()).toBe(server.EMPTY_PAGE);
      expect(requests[0].resourceType()).toBe('document');
      expect(requests[0].method()).toBe('GET');
      expect(requests[0].response()).toBeTruthy();
      expect(requests[0].frame() === page.mainFrame()).toBe(true);
      expect(requests[0].frame().url()).toBe(server.EMPTY_PAGE);
    });
    // FIXME: WebKit doesn't provide remoteIPAddress in the response.
    it.skip(WEBKIT)('Page.Events.Response', async({page, server}) => {
      const responses = [];
      page.on('response', response => responses.push(response));
      await page.goto(server.EMPTY_PAGE);
      expect(responses.length).toBe(1);
      expect(responses[0].url()).toBe(server.EMPTY_PAGE);
      expect(responses[0].status()).toBe(200);
      expect(responses[0].ok()).toBe(true);
      expect(responses[0].request()).toBeTruthy();
      const remoteAddress = responses[0].remoteAddress();
      // Either IPv6 or IPv4, depending on environment.
      expect(remoteAddress.ip.includes('::1') || remoteAddress.ip === '127.0.0.1').toBe(true);
      expect(remoteAddress.port).toBe(server.PORT);
    });

    // FIXME: requires request interception.
    it.skip(WEBKIT)('Page.Events.RequestFailed', async({page, server}) => {
      await page.interception.enable();
      page.on('request', request => {
        if (request.url().endsWith('css'))
          page.interception.abort(request);
        else
          page.interception.continue(request);
      });
      const failedRequests = [];
      page.on('requestfailed', request => failedRequests.push(request));
      await page.goto(server.PREFIX + '/one-style.html');
      expect(failedRequests.length).toBe(1);
      expect(failedRequests[0].url()).toContain('one-style.css');
      expect(failedRequests[0].response()).toBe(null);
      expect(failedRequests[0].resourceType()).toBe('stylesheet');
      if (CHROME || WEBKIT)
        expect(failedRequests[0].failure().errorText).toBe('net::ERR_FAILED');
      else
        expect(failedRequests[0].failure().errorText).toBe('NS_ERROR_FAILURE');
      expect(failedRequests[0].frame()).toBeTruthy();
    });
    // FIXME: WebKit requestfinished comes after goto.
    it.skip(WEBKIT)('Page.Events.RequestFinished', async({page, server}) => {
      const requests = [];
      page.on('requestfinished', request => requests.push(request));
      await page.goto(server.EMPTY_PAGE);
      expect(requests.length).toBe(1);
      expect(requests[0].url()).toBe(server.EMPTY_PAGE);
      expect(requests[0].response()).toBeTruthy();
      expect(requests[0].frame() === page.mainFrame()).toBe(true);
      expect(requests[0].frame().url()).toBe(server.EMPTY_PAGE);
    });
    it.skip(WEBKIT)('should fire events in proper order', async({page, server}) => {
      const events = [];
      page.on('request', request => events.push('request'));
      page.on('response', response => events.push('response'));
      page.on('requestfinished', request => events.push('requestfinished'));
      await page.goto(server.EMPTY_PAGE);
      expect(events).toEqual(['request', 'response', 'requestfinished']);
    });
    it.skip(WEBKIT)('should support redirects', async({page, server}) => {
      const events = [];
      page.on('request', request => events.push(`${request.method()} ${request.url()}`));
      page.on('response', response => events.push(`${response.status()} ${response.url()}`));
      page.on('requestfinished', request => events.push(`DONE ${request.url()}`));
      page.on('requestfailed', request => events.push(`FAIL ${request.url()}`));
      server.setRedirect('/foo.html', '/empty.html');
      const FOO_URL = server.PREFIX + '/foo.html';
      const response = await page.goto(FOO_URL);
      expect(events).toEqual([
        `GET ${FOO_URL}`,
        `302 ${FOO_URL}`,
        `DONE ${FOO_URL}`,
        `GET ${server.EMPTY_PAGE}`,
        `200 ${server.EMPTY_PAGE}`,
        `DONE ${server.EMPTY_PAGE}`
      ]);

      // Check redirect chain
      const redirectChain = response.request().redirectChain();
      expect(redirectChain.length).toBe(1);
      expect(redirectChain[0].url()).toContain('/foo.html');
      expect(redirectChain[0].response().remoteAddress().port).toBe(server.PORT);
    });
  });

  describe('Request.isNavigationRequest', () => {
    it('should work', async({page, server}) => {
      const requests = new Map();
      page.on('request', request => requests.set(request.url().split('/').pop(), request));
      server.setRedirect('/rrredirect', '/frames/one-frame.html');
      await page.goto(server.PREFIX + '/rrredirect');
      expect(requests.get('rrredirect').isNavigationRequest()).toBe(true);
      expect(requests.get('one-frame.html').isNavigationRequest()).toBe(true);
      expect(requests.get('frame.html').isNavigationRequest()).toBe(true);
      expect(requests.get('script.js').isNavigationRequest()).toBe(false);
      expect(requests.get('style.css').isNavigationRequest()).toBe(false);
    });
    it.skip(WEBKIT)('should work with request interception', async({page, server}) => {
      const requests = new Map();
      page.on('request', request => {
        requests.set(request.url().split('/').pop(), request);
        page.interception.continue(request);
      });
      await page.interception.enable();
      server.setRedirect('/rrredirect', '/frames/one-frame.html');
      await page.goto(server.PREFIX + '/rrredirect');
      expect(requests.get('rrredirect').isNavigationRequest()).toBe(true);
      expect(requests.get('one-frame.html').isNavigationRequest()).toBe(true);
      expect(requests.get('frame.html').isNavigationRequest()).toBe(true);
      expect(requests.get('script.js').isNavigationRequest()).toBe(false);
      expect(requests.get('style.css').isNavigationRequest()).toBe(false);
    });
    it('should work when navigating to image', async({page, server}) => {
      const requests = [];
      page.on('request', request => requests.push(request));
      await page.goto(server.PREFIX + '/pptr.png');
      expect(requests[0].isNavigationRequest()).toBe(true);
    });
  });

  describe('Page.setExtraHTTPHeaders', function() {
    it('should work', async({page, server}) => {
      await page.setExtraHTTPHeaders({
        foo: 'bar'
      });
      const [request] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.EMPTY_PAGE),
      ]);
      expect(request.headers['foo']).toBe('bar');
    });
    it('should throw for non-string header values', async({page, server}) => {
      let error = null;
      try {
        await page.setExtraHTTPHeaders({ 'foo': 1 });
      } catch (e) {
        error = e;
      }
      expect(error.message).toBe('Expected value of header "foo" to be String, but "number" is found.');
    });
  });

  // FIXME: WebKit doesn't support network interception.
  describe.skip(FFOX || WEBKIT)('Interception.authenticate', function() {
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
};


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

const utils = require('./utils');
const { performance } = require('perf_hooks');

module.exports.addTests = function({testRunner, expect, playwright, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.goto', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(page.url()).toBe(server.EMPTY_PAGE);
    });
    it('should work cross-process', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(page.url()).toBe(server.EMPTY_PAGE);

      const url = server.CROSS_PROCESS_PREFIX + '/empty.html';
      let requestFrame;
      page.on('request', r => {
        if (r.url() === url)
          requestFrame = r.frame();
      });
      const response = await page.goto(url);
      expect(page.url()).toBe(url);
      expect(response.frame()).toBe(page.mainFrame());
      expect(requestFrame).toBe(page.mainFrame());
      expect(response.url()).toBe(url);
    });
    it('should capture iframe navigation request', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(page.url()).toBe(server.EMPTY_PAGE);

      let requestFrame;
      page.on('request', r => {
        if (r.url() === server.PREFIX + '/frames/frame.html')
          requestFrame = r.frame();
      });
      const response = await page.goto(server.PREFIX + '/frames/one-frame.html');
      expect(page.url()).toBe(server.PREFIX + '/frames/one-frame.html');
      expect(response.frame()).toBe(page.mainFrame());
      expect(response.url()).toBe(server.PREFIX + '/frames/one-frame.html');

      expect(page.frames().length).toBe(2);
      expect(requestFrame).toBe(page.frames()[1]);
    });
    it('should capture cross-process iframe navigation request', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(page.url()).toBe(server.EMPTY_PAGE);

      let requestFrame;
      page.on('request', r => {
        if (r.url() === server.CROSS_PROCESS_PREFIX + '/frames/frame.html')
          requestFrame = r.frame();
      });
      const response = await page.goto(server.CROSS_PROCESS_PREFIX + '/frames/one-frame.html');
      expect(page.url()).toBe(server.CROSS_PROCESS_PREFIX + '/frames/one-frame.html');
      expect(response.frame()).toBe(page.mainFrame());
      expect(response.url()).toBe(server.CROSS_PROCESS_PREFIX + '/frames/one-frame.html');

      expect(page.frames().length).toBe(2);
      expect(requestFrame).toBe(page.frames()[1]);
    });
    it('should work with anchor navigation', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      expect(page.url()).toBe(server.EMPTY_PAGE);
      await page.goto(server.EMPTY_PAGE + '#foo');
      expect(page.url()).toBe(server.EMPTY_PAGE + '#foo');
      await page.goto(server.EMPTY_PAGE + '#bar');
      expect(page.url()).toBe(server.EMPTY_PAGE + '#bar');
    });
    it('should work with redirects', async({page, server}) => {
      server.setRedirect('/redirect/1.html', '/redirect/2.html');
      server.setRedirect('/redirect/2.html', '/empty.html');
      await page.goto(server.PREFIX + '/redirect/1.html');
      expect(page.url()).toBe(server.EMPTY_PAGE);
    });
    it('should navigate to about:blank', async({page, server}) => {
      const response = await page.goto('about:blank');
      expect(response).toBe(null);
    });
    it('should return response when page changes its URL after load', async({page, server}) => {
      const response = await page.goto(server.PREFIX + '/historyapi.html');
      expect(response.status()).toBe(200);
    });
    it('should work with subframes return 204', async({page, server}) => {
      server.setRoute('/frames/frame.html', (req, res) => {
        res.statusCode = 204;
        res.end();
      });
      await page.goto(server.PREFIX + '/frames/one-frame.html');
    });
    !WEBKIT && it('should fail when server returns 204', async({page, server}) => {
      // Webkit just loads an empty page.
      server.setRoute('/empty.html', (req, res) => {
        res.statusCode = 204;
        res.end();
      });
      let error = null;
      await page.goto(server.EMPTY_PAGE).catch(e => error = e);
      expect(error).not.toBe(null);
      if (CHROME)
        expect(error.message).toContain('net::ERR_ABORTED');
      else
        expect(error.message).toContain('NS_BINDING_ABORTED');
    });
    it('should navigate to empty page with domcontentloaded', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE, {waitUntil: 'domcontentloaded'});
      expect(response.status()).toBe(200);
    });
    it.skip(WEBKIT)('should work when page calls history API in beforeunload', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        window.addEventListener('beforeunload', () => history.replaceState(null, 'initial', window.location.href), false);
      });
      const response = await page.goto(server.PREFIX + '/grid.html');
      expect(response.status()).toBe(200);
    });
    it('should navigate to empty page with networkidle0', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE, {waitUntil: 'networkidle0'});
      expect(response.status()).toBe(200);
    });
    it('should navigate to empty page with networkidle2', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE, {waitUntil: 'networkidle2'});
      expect(response.status()).toBe(200);
    });
    it('should fail when navigating to bad url', async({page, server}) => {
      let error = null;
      await page.goto('asdfasdf').catch(e => error = e);
      if (CHROME || WEBKIT)
        expect(error.message).toContain('Cannot navigate to invalid URL');
      else
        expect(error.message).toContain('Invalid url');
    });
    it('should fail when navigating to bad SSL', async({page, httpsServer}) => {
      // Make sure that network events do not emit 'undefined'.
      // @see https://crbug.com/750469
      page.on('request', request => expect(request).toBeTruthy());
      page.on('requestfinished', request => expect(request).toBeTruthy());
      page.on('requestfailed', request => expect(request).toBeTruthy());
      let error = null;
      await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
      expectSSLError(error.message);
    });
    it('should fail when navigating to bad SSL after redirects', async({page, server, httpsServer}) => {
      server.setRedirect('/redirect/1.html', '/redirect/2.html');
      server.setRedirect('/redirect/2.html', '/empty.html');
      let error = null;
      await page.goto(httpsServer.PREFIX + '/redirect/1.html').catch(e => error = e);
      expectSSLError(error.message);
    });
    it('should throw if networkidle is passed as an option', async({page, server}) => {
      let error = null;
      await page.goto(server.EMPTY_PAGE, {waitUntil: 'networkidle'}).catch(err => error = err);
      expect(error.message).toContain('Unsupported waitUntil option');
    });
    it('should fail when main resources failed to load', async({page, server}) => {
      let error = null;
      await page.goto('http://localhost:44123/non-existing-url').catch(e => error = e);
      if (CHROME)
        expect(error.message).toContain('net::ERR_CONNECTION_REFUSED');
      else if (WEBKIT)
        expect(error.message).toContain('Could not connect');
      else
        expect(error.message).toContain('NS_ERROR_CONNECTION_REFUSED');
    });
    it('should fail when exceeding maximum navigation timeout', async({page, server}) => {
      // Hang for request to the empty.html
      server.setRoute('/empty.html', (req, res) => { });
      let error = null;
      await page.goto(server.PREFIX + '/empty.html', {timeout: 1}).catch(e => error = e);
      const message = 'Navigation timeout of 1 ms exceeded';
      expect(error.message).toContain(message);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
    });
    it('should fail when exceeding default maximum navigation timeout', async({page, server}) => {
      // Hang for request to the empty.html
      server.setRoute('/empty.html', (req, res) => { });
      let error = null;
      page.setDefaultNavigationTimeout(1);
      await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
      const message = 'Navigation timeout of 1 ms exceeded';
      expect(error.message).toContain(message);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
    });
    it('should fail when exceeding default maximum timeout', async({page, server}) => {
      // Hang for request to the empty.html
      server.setRoute('/empty.html', (req, res) => { });
      let error = null;
      page.setDefaultTimeout(1);
      await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
      const message = 'Navigation timeout of 1 ms exceeded';
      expect(error.message).toContain(message);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
    });
    it('should prioritize default navigation timeout over default timeout', async({page, server}) => {
      // Hang for request to the empty.html
      server.setRoute('/empty.html', (req, res) => { });
      let error = null;
      page.setDefaultTimeout(0);
      page.setDefaultNavigationTimeout(1);
      await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
      const message = 'Navigation timeout of 1 ms exceeded';
      expect(error.message).toContain(message);
      expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
    });
    it('should disable timeout when its set to 0', async({page, server}) => {
      let error = null;
      let loaded = false;
      page.once('load', () => loaded = true);
      await page.goto(server.PREFIX + '/grid.html', {timeout: 0, waitUntil: ['load']}).catch(e => error = e);
      expect(error).toBe(null);
      expect(loaded).toBe(true);
    });
    it('should work when navigating to valid url', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
    });
    it.skip(FFOX)('should work when navigating to data url', async({page, server}) => {
      const response = await page.goto('data:text/html,hello');
      expect(response.ok()).toBe(true);
    });
    it('should work when navigating to 404', async({page, server}) => {
      const response = await page.goto(server.PREFIX + '/not-found');
      expect(response.ok()).toBe(false);
      expect(response.status()).toBe(404);
    });
    it('should return last response in redirect chain', async({page, server}) => {
      server.setRedirect('/redirect/1.html', '/redirect/2.html');
      server.setRedirect('/redirect/2.html', '/redirect/3.html');
      server.setRedirect('/redirect/3.html', server.EMPTY_PAGE);
      const response = await page.goto(server.PREFIX + '/redirect/1.html');
      expect(response.ok()).toBe(true);
      expect(response.url()).toBe(server.EMPTY_PAGE);
    });
    it('should wait for network idle to succeed navigation', async({page, server}) => {
      let responses = [];
      // Hold on to a bunch of requests without answering.
      server.setRoute('/fetch-request-a.js', (req, res) => responses.push(res));
      server.setRoute('/fetch-request-b.js', (req, res) => responses.push(res));
      server.setRoute('/fetch-request-c.js', (req, res) => responses.push(res));
      server.setRoute('/fetch-request-d.js', (req, res) => responses.push(res));
      const initialFetchResourcesRequested = Promise.all([
        server.waitForRequest('/fetch-request-a.js'),
        server.waitForRequest('/fetch-request-b.js'),
        server.waitForRequest('/fetch-request-c.js'),
      ]);
      const secondFetchResourceRequested = server.waitForRequest('/fetch-request-d.js');

      // Navigate to a page which loads immediately and then does a bunch of
      // requests via javascript's fetch method.
      const navigationPromise = page.goto(server.PREFIX + '/networkidle.html', {
        waitUntil: 'networkidle0',
      });
      // Track when the navigation gets completed.
      let navigationFinished = false;
      navigationPromise.then(() => navigationFinished = true);

      // Wait for the page's 'load' event.
      await new Promise(fulfill => page.once('load', fulfill));
      expect(navigationFinished).toBe(false);

      // Wait for the initial three resources to be requested.
      await initialFetchResourcesRequested;

      // Expect navigation still to be not finished.
      expect(navigationFinished).toBe(false);

      // Respond to initial requests.
      for (const response of responses) {
        response.statusCode = 404;
        response.end(`File not found`);
      }

      // Reset responses array
      responses = [];

      // Wait for the second round to be requested.
      await secondFetchResourceRequested;
      // Expect navigation still to be not finished.
      expect(navigationFinished).toBe(false);

      // Respond to requests.
      for (const response of responses) {
        response.statusCode = 404;
        response.end(`File not found`);
      }

      const now = performance.now();
      const response = await navigationPromise;
      expect(performance.now() - now).not.toBeLessThan(499);
      // Expect navigation to succeed.
      expect(response.ok()).toBe(true);
    });
    it('should wait for networkidle2 to succeed navigation', async({page, server}) => {
      let responses = [];
      // Hold on to a bunch of requests without answering.
      server.setRoute('/fetch-request-a.js', (req, res) => responses.push(res));
      server.setRoute('/fetch-request-b.js', (req, res) => responses.push(res));
      server.setRoute('/fetch-request-c.js', (req, res) => responses.push(res));
      server.setRoute('/fetch-request-d.js', (req, res) => responses.push(res));
      const initialFetchResourcesRequested = Promise.all([
        server.waitForRequest('/fetch-request-a.js'),
      ]);

      // Navigate to a page which loads immediately and then does a bunch of
      // requests via javascript's fetch method.
      const navigationPromise = page.goto(server.PREFIX + '/networkidle.html', {
        waitUntil: 'networkidle2',
      });
      // Track when the navigation gets completed.
      let navigationFinished = false;
      navigationPromise.then(() => navigationFinished = true);

      // Wait for the page's 'load' event.
      await new Promise(fulfill => page.once('load', fulfill));
      expect(navigationFinished).toBe(false);

      // Wait for the initial three resources to be requested.
      await initialFetchResourcesRequested;

      // Expect navigation still to be not finished.
      expect(navigationFinished).toBe(false);

      // Respond to initial requests.
      for (const response of responses) {
        response.statusCode = 404;
        response.end(`File not found`);
      }

      const now = performance.now();
      const response = await navigationPromise;
      expect(performance.now() - now).not.toBeLessThan(499);
      // Expect navigation to succeed with two outstanding network requests.
      expect(response.ok()).toBe(true);
    });
    it('should not leak listeners during navigation', async({page, server}) => {
      let warning = null;
      const warningHandler = w => warning = w;
      process.on('warning', warningHandler);
      for (let i = 0; i < 20; ++i)
        await page.goto(server.EMPTY_PAGE);
      process.removeListener('warning', warningHandler);
      expect(warning).toBe(null);
    });
    it.skip(WEBKIT)('should not leak listeners during bad navigation', async({page, server}) => {
      // FIXME: shows dialog in webkit.
      let warning = null;
      const warningHandler = w => warning = w;
      process.on('warning', warningHandler);
      for (let i = 0; i < 20; ++i)
        await page.goto('asdf').catch(e => {/* swallow navigation error */});
      process.removeListener('warning', warningHandler);
      expect(warning).toBe(null);
    });
    it('should not leak listeners during navigation of 11 pages', async({page, context, server}) => {
      let warning = null;
      const warningHandler = w => warning = w;
      process.on('warning', warningHandler);
      await Promise.all([...Array(20)].map(async() => {
        const page = await context.newPage();
        await page.goto(server.EMPTY_PAGE);
        await page.close();
      }));
      process.removeListener('warning', warningHandler);
      expect(warning).toBe(null);
    });
    it.skip(FFOX)('should navigate to dataURL and fire dataURL requests', async({page, server}) => {
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      const dataURL = 'data:text/html,<div>yo</div>';
      const response = await page.goto(dataURL);
      expect(response.status()).toBe(200);
      expect(requests.length).toBe(1);
      expect(requests[0].url()).toBe(dataURL);
    });
    it.skip(FFOX || WEBKIT)('should navigate to URL with hash and fire requests without hash', async({page, server}) => {
      const requests = [];
      page.on('request', request => !utils.isFavicon(request) && requests.push(request));
      const response = await page.goto(server.EMPTY_PAGE + '#hash');
      expect(response.status()).toBe(200);
      expect(response.url()).toBe(server.EMPTY_PAGE);
      expect(requests.length).toBe(1);
      expect(requests[0].url()).toBe(server.EMPTY_PAGE);
    });
    it('should work with self requesting page', async({page, server}) => {
      const response = await page.goto(server.PREFIX + '/self-request.html');
      expect(response.status()).toBe(200);
      expect(response.url()).toContain('self-request.html');
    });
    it('should fail when navigating and show the url at the error message', async function({page, server, httpsServer}) {
      const url = httpsServer.PREFIX + '/redirect/1.html';
      let error = null;
      try {
        await page.goto(url);
      } catch (e) {
        error = e;
      }
      expect(error.message).toContain(url);
    });
    it('should send referer', async({page, server}) => {
      const [request1, request2] = await Promise.all([
        server.waitForRequest('/grid.html'),
        server.waitForRequest('/digits/1.png'),
        page.goto(server.PREFIX + '/grid.html', {
          referer: 'http://google.com/',
        }),
      ]);
      expect(request1.headers['referer']).toBe('http://google.com/');
      // Make sure subresources do not inherit referer.
      expect(request2.headers['referer']).toBe(server.PREFIX + '/grid.html');
      expect(page.url()).toBe(server.PREFIX + '/grid.html');
    });
    it.skip(FFOX)('should use referer option when setExtraHTTPHeaders provides referer', async({page, server}) => {
      await page.setExtraHTTPHeaders({ 'referer': 'http://microsoft.com/' });
      const [request1, request2] = await Promise.all([
        server.waitForRequest('/grid.html'),
        server.waitForRequest('/digits/1.png'),
        page.goto(server.PREFIX + '/grid.html', {
          referer: 'http://google.com/',
        }),
      ]);
      expect(request1.headers['referer']).toBe('http://google.com/');
      // Make sure subresources use referer specified by setExtraHTTPHeaders.
      expect(request2.headers['referer']).toBe('http://microsoft.com/');
      expect(page.url()).toBe(server.PREFIX + '/grid.html');
    });
    it('should override referrer-policy', async({page, server}) => {
      server.setRoute('/grid.html', (req, res) => {
        res.setHeader('Referrer-Policy', 'no-referrer');
        server.serveFile(req, res, '/grid.html');
      });
      const [request1, request2] = await Promise.all([
        server.waitForRequest('/grid.html'),
        server.waitForRequest('/digits/1.png'),
        page.goto(server.PREFIX + '/grid.html', {
          referer: 'http://microsoft.com/',
        }),
      ]);
      expect(request1.headers['referer']).toBe('http://microsoft.com/');
      // Make sure subresources do not inherit referer.
      expect(request2.headers['referer']).toBe(undefined);
      expect(page.url()).toBe(server.PREFIX + '/grid.html');
    });
  });

  describe('Page.waitForNavigation', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      const [response] = await Promise.all([
        page.waitForNavigation(),
        page.evaluate(url => window.location.href = url, server.PREFIX + '/grid.html')
      ]);
      expect(response.ok()).toBe(true);
      expect(response.url()).toContain('grid.html');
    });
    it('should work with both domcontentloaded and load', async({page, server}) => {
      let response = null;
      server.setRoute('/one-style.css', (req, res) => response = res);
      const navigationPromise = page.goto(server.PREFIX + '/one-style.html');
      const domContentLoadedPromise = page.waitForNavigation({
        waitUntil: 'domcontentloaded'
      });

      let bothFired = false;
      const bothFiredPromise = page.waitForNavigation({
        waitUntil: ['load', 'domcontentloaded']
      }).then(() => bothFired = true);

      await server.waitForRequest('/one-style.css');
      await domContentLoadedPromise;
      expect(bothFired).toBe(false);
      response.end();
      await bothFiredPromise;
      await navigationPromise;
    });
    it('should work with clicking on anchor links', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`<a href='#foobar'>foobar</a>`);
      const [response] = await Promise.all([
        page.waitForNavigation(),
        page.click('a'),
      ]);
      expect(response).toBe(null);
      expect(page.url()).toBe(server.EMPTY_PAGE + '#foobar');
    });
    it('should work with clicking on links which do not commit navigation', async({page, server, httpsServer}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`<a href='${httpsServer.EMPTY_PAGE}'>foobar</a>`);
      const [error] = await Promise.all([
        page.waitForNavigation().catch(e => e),
        page.click('a'),
      ]);
      expectSSLError(error.message);
    });
    it('should work with history.pushState()', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`
        <a onclick='javascript:pushState()'>SPA</a>
        <script>
          function pushState() { history.pushState({}, '', 'wow.html') }
        </script>
      `);
      const [response] = await Promise.all([
        page.waitForNavigation(),
        page.click('a'),
      ]);
      expect(response).toBe(null);
      expect(page.url()).toBe(server.PREFIX + '/wow.html');
    });
    it('should work with history.replaceState()', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`
        <a onclick='javascript:replaceState()'>SPA</a>
        <script>
          function replaceState() { history.replaceState({}, '', '/replaced.html') }
        </script>
      `);
      const [response] = await Promise.all([
        page.waitForNavigation(),
        page.click('a'),
      ]);
      expect(response).toBe(null);
      expect(page.url()).toBe(server.PREFIX + '/replaced.html');
    });
    it('should work with DOM history.back()/history.forward()', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.setContent(`
        <a id=back onclick='javascript:goBack()'>back</a>
        <a id=forward onclick='javascript:goForward()'>forward</a>
        <script>
          function goBack() { history.back(); }
          function goForward() { history.forward(); }
          history.pushState({}, '', '/first.html');
          history.pushState({}, '', '/second.html');
        </script>
      `);
      expect(page.url()).toBe(server.PREFIX + '/second.html');
      const [backResponse] = await Promise.all([
        page.waitForNavigation(),
        page.click('a#back'),
      ]);
      expect(backResponse).toBe(null);
      expect(page.url()).toBe(server.PREFIX + '/first.html');
      const [forwardResponse] = await Promise.all([
        page.waitForNavigation(),
        page.click('a#forward'),
      ]);
      expect(forwardResponse).toBe(null);
      expect(page.url()).toBe(server.PREFIX + '/second.html');
    });
    it.skip(FFOX)('should work when subframe issues window.stop()', async({page, server}) => {
      server.setRoute('/frames/style.css', (req, res) => {});
      const navigationPromise = page.goto(server.PREFIX + '/frames/one-frame.html');
      const frame = await new Promise(f => page.once('frameattached', f));
      await new Promise(fulfill => page.on('framenavigated', f => {
        if (f === frame)
          fulfill();
      }));
      await Promise.all([
        frame.evaluate(() => window.stop()),
        navigationPromise
      ]);
    });
  });

  describe('Page.goBack', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.goto(server.PREFIX + '/grid.html');

      let response = await page.goBack();
      expect(response.ok()).toBe(true);
      expect(response.url()).toContain(server.EMPTY_PAGE);

      response = await page.goForward();
      expect(response.ok()).toBe(true);
      expect(response.url()).toContain('/grid.html');

      response = await page.goForward();
      expect(response).toBe(null);
    });
    it('should work with HistoryAPI', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => {
        history.pushState({}, '', '/first.html');
        history.pushState({}, '', '/second.html');
      });
      expect(page.url()).toBe(server.PREFIX + '/second.html');

      await page.goBack();
      expect(page.url()).toBe(server.PREFIX + '/first.html');
      await page.goBack();
      expect(page.url()).toBe(server.EMPTY_PAGE);
      await page.goForward();
      expect(page.url()).toBe(server.PREFIX + '/first.html');
    });
  });

  describe('Frame.goto', function() {
    it('should navigate subframes', async({page, server}) => {
      await page.goto(server.PREFIX + '/frames/one-frame.html');
      expect(page.frames()[0].url()).toContain('/frames/one-frame.html');
      expect(page.frames()[1].url()).toContain('/frames/frame.html');

      const response = await page.frames()[1].goto(server.EMPTY_PAGE);
      expect(response.ok()).toBe(true);
      expect(response.frame()).toBe(page.frames()[1]);
    });
    it('should reject when frame detaches', async({page, server}) => {
      await page.goto(server.PREFIX + '/frames/one-frame.html');

      server.setRoute('/empty.html', () => {});
      const navigationPromise = page.frames()[1].goto(server.EMPTY_PAGE).catch(e => e);
      await server.waitForRequest('/empty.html');

      await page.$eval('iframe', frame => frame.remove());
      const error = await navigationPromise;
      expect(error.message).toContain('frame was detached');
    });
    it('should return matching responses', async({page, server}) => {
      // Disable cache: otherwise, chromium will cache similar requests.
      await page.setCacheEnabled(false);
      await page.goto(server.EMPTY_PAGE);
      // Attach three frames.
      const frames = [
        await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE),
        await utils.attachFrame(page, 'frame2', server.EMPTY_PAGE),
        await utils.attachFrame(page, 'frame3', server.EMPTY_PAGE),
      ];
      // Navigate all frames to the same URL.
      const serverResponses = [];
      server.setRoute('/one-style.html', (req, res) => serverResponses.push(res));
      const navigations = [];
      for (let i = 0; i < 3; ++i) {
        navigations.push(frames[i].goto(server.PREFIX + '/one-style.html'));
        await server.waitForRequest('/one-style.html');
      }
      // Respond from server out-of-order.
      const serverResponseTexts = ['AAA', 'BBB', 'CCC'];
      for (const i of [1, 2, 0]) {
        serverResponses[i].end(serverResponseTexts[i]);
        const response = await navigations[i];
        expect(response.frame()).toBe(frames[i]);
        expect(await response.text()).toBe(serverResponseTexts[i]);
      }
    });
  });

  describe('Frame.waitForNavigation', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/frames/one-frame.html');
      const frame = page.frames()[1];
      const [response] = await Promise.all([
        frame.waitForNavigation(),
        frame.evaluate(url => window.location.href = url, server.PREFIX + '/grid.html')
      ]);
      expect(response.ok()).toBe(true);
      expect(response.url()).toContain('grid.html');
      expect(response.frame()).toBe(frame);
      expect(page.url()).toContain('/frames/one-frame.html');
    });
    it('should fail when frame detaches', async({page, server}) => {
      await page.goto(server.PREFIX + '/frames/one-frame.html');
      const frame = page.frames()[1];

      server.setRoute('/empty.html', () => {});
      let error = null;
      const navigationPromise = frame.waitForNavigation().catch(e => error = e);
      await Promise.all([
        server.waitForRequest('/empty.html'),
        frame.evaluate(() => window.location = '/empty.html')
      ]);
      await page.$eval('iframe', frame => frame.remove());
      await navigationPromise;
      expect(error.message).toContain('frame was detached');
    });
  });

  describe('Page.reload', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await page.evaluate(() => window._foo = 10);
      await page.reload();
      expect(await page.evaluate(() => window._foo)).toBe(undefined);
    });
  });

  function expectSSLError(errorMessage) {
    if (CHROME) {
      expect(errorMessage).toContain('net::ERR_CERT_AUTHORITY_INVALID');
    } else if (WEBKIT) {
      if (process.platform === 'darwin')
        expect(errorMessage).toContain('The certificate for this server is invalid');
      else
        expect(errorMessage).toContain('Unacceptable TLS certificate');
    } else {
      expect(errorMessage).toContain('SSL_ERROR_UNKNOWN');
    }
  }
};

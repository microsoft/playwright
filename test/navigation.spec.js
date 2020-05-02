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
const path = require('path');
const url = require('url');
const {FFOX, CHROMIUM, WEBKIT, MAC, WIN} = utils.testOptions(browserType);

describe('Page.goto', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    expect(page.url()).toBe(server.EMPTY_PAGE);
  });
  it('should work with file URL', async({page, server}) => {
    const fileurl = url.pathToFileURL(path.join(__dirname, 'assets', 'frames', 'two-frames.html')).href;
    await page.goto(fileurl);
    expect(page.url().toLowerCase()).toBe(fileurl.toLowerCase());
    expect(page.frames().length).toBe(3);
  });
  it('should use http for no protocol', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE.substring('http://'.length));
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
    const response = await page.goto(server.PREFIX + '/redirect/1.html');
    expect(response.status()).toBe(200);
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
  it('should fail when server returns 204', async({page, server}) => {
    // Webkit just loads an empty page.
    server.setRoute('/empty.html', (req, res) => {
      res.statusCode = 204;
      res.end();
    });
    let error = null;
    await page.goto(server.EMPTY_PAGE).catch(e => error = e);
    expect(error).not.toBe(null);
    if (CHROMIUM)
      expect(error.message).toContain('net::ERR_ABORTED');
    else if (WEBKIT)
      expect(error.message).toContain('Aborted: 204 No Content');
    else
      expect(error.message).toContain('NS_BINDING_ABORTED');
  });
  it('should navigate to empty page with domcontentloaded', async({page, server}) => {
    const response = await page.goto(server.EMPTY_PAGE, {waitUntil: 'domcontentloaded'});
    expect(response.status()).toBe(200);
  });
  it('should work when page calls history API in beforeunload', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => {
      window.addEventListener('beforeunload', () => history.replaceState(null, 'initial', window.location.href), false);
    });
    const response = await page.goto(server.PREFIX + '/grid.html');
    expect(response.status()).toBe(200);
  });
  it('should fail when navigating to bad url', async({page, server}) => {
    let error = null;
    await page.goto('asdfasdf').catch(e => error = e);
    if (CHROMIUM || WEBKIT)
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
  it('should not crash when navigating to bad SSL after a cross origin navigation', async({page, server, httpsServer}) => {
    await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
    await page.goto(httpsServer.EMPTY_PAGE).catch(e => void 0);
  });
  it('should not throw if networkidle0 is passed as an option', async({page, server}) => {
    let error = null;
    await page.goto(server.EMPTY_PAGE, {waitUntil: 'networkidle0'});
  });
  it('should throw if networkidle2 is passed as an option', async({page, server}) => {
    let error = null;
    await page.goto(server.EMPTY_PAGE, {waitUntil: 'networkidle2'}).catch(err => error = err);
    expect(error.message).toContain('Unsupported waitUntil option');
  });
  it('should fail when main resources failed to load', async({page, server}) => {
    let error = null;
    await page.goto('http://localhost:44123/non-existing-url').catch(e => error = e);
    if (CHROMIUM)
      expect(error.message).toContain('net::ERR_CONNECTION_REFUSED');
    else if (WEBKIT && WIN)
      expect(error.message).toContain(`Couldn\'t connect to server`);
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
    const message = 'Navigation timeout exceeded';
    expect(error.message).toContain(message);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should fail when exceeding default maximum navigation timeout', async({page, server}) => {
    // Hang for request to the empty.html
    server.setRoute('/empty.html', (req, res) => { });
    let error = null;
    page.context().setDefaultNavigationTimeout(2);
    page.setDefaultNavigationTimeout(1);
    await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
    const message = 'Navigation timeout exceeded';
    expect(error.message).toContain(message);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should fail when exceeding browser context navigation timeout', async({page, server}) => {
    // Hang for request to the empty.html
    server.setRoute('/empty.html', (req, res) => { });
    let error = null;
    page.context().setDefaultNavigationTimeout(2);
    await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
    const message = 'Navigation timeout exceeded';
    expect(error.message).toContain(message);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should fail when exceeding default maximum timeout', async({page, server}) => {
    // Hang for request to the empty.html
    server.setRoute('/empty.html', (req, res) => { });
    let error = null;
    page.context().setDefaultTimeout(2);
    page.setDefaultTimeout(1);
    await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
    const message = 'Navigation timeout exceeded';
    expect(error.message).toContain(message);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should fail when exceeding browser context timeout', async({page, server}) => {
    // Hang for request to the empty.html
    server.setRoute('/empty.html', (req, res) => { });
    let error = null;
    page.context().setDefaultTimeout(2);
    await page.goto(server.PREFIX + '/empty.html').catch(e => error = e);
    const message = 'Navigation timeout exceeded';
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
    const message = 'Navigation timeout exceeded';
    expect(error.message).toContain(message);
    expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  });
  it('should disable timeout when its set to 0', async({page, server}) => {
    let error = null;
    let loaded = false;
    page.once('load', () => loaded = true);
    await page.goto(server.PREFIX + '/grid.html', {timeout: 0, waitUntil: 'load'}).catch(e => error = e);
    expect(error).toBe(null);
    expect(loaded).toBe(true);
  });
  it('should work when navigating to valid url', async({page, server}) => {
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
  });
  it('should work when navigating to data url', async({page, server}) => {
    const response = await page.goto('data:text/html,hello');
    expect(response).toBe(null);
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
  it('should not leak listeners during navigation', async({page, server}) => {
    let warning = null;
    const warningHandler = w => warning = w;
    process.on('warning', warningHandler);
    for (let i = 0; i < 20; ++i)
      await page.goto(server.EMPTY_PAGE);
    process.removeListener('warning', warningHandler);
    expect(warning).toBe(null);
  });
  it('should not leak listeners during bad navigation', async({page, server}) => {
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
  it('should navigate to dataURL and not fire dataURL requests', async({page, server}) => {
    const requests = [];
    page.on('request', request => requests.push(request));
    const dataURL = 'data:text/html,<div>yo</div>';
    const response = await page.goto(dataURL);
    expect(response).toBe(null);
    expect(requests.length).toBe(0);
  });
  it('should navigate to URL with hash and fire requests without hash', async({page, server}) => {
    const requests = [];
    page.on('request', request => requests.push(request));
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
  it('should reject referer option when setExtraHTTPHeaders provides referer', async({page, server}) => {
    await page.setExtraHTTPHeaders({ 'referer': 'http://microsoft.com/' });
    let error;
    await page.goto(server.PREFIX + '/grid.html', {
      referer: 'http://google.com/',
    }).catch(e => error = e);
    expect(error.message).toBe('"referer" is already specified as extra HTTP header');
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
  it('should fail when canceled by another navigation', async({page, server}) => {
    server.setRoute('/one-style.html', (req, res) => {});
    const failed = page.goto(server.PREFIX + '/one-style.html').catch(e => e);
    await server.waitForRequest('/one-style.html');
    await page.goto(server.PREFIX + '/empty.html');
    const error = await failed;
    expect(error.message).toBeTruthy();
  });
  it.skip(true)('extraHttpHeaders should be pushed to provisional page', async({page, server}) => {
    // This test is flaky, because we cannot await page.setExtraHTTPHeaders.
    // We need a way to test our implementation by more than just public api.
    await page.goto(server.EMPTY_PAGE);
    const pagePath = '/one-style.html';
    server.setRoute(pagePath, async (req, res) => {
      page.setExtraHTTPHeaders({ foo: 'bar' });
      server.serveFile(req, res, pagePath);
    });
    const [htmlReq, cssReq] = await Promise.all([
      server.waitForRequest(pagePath),
      server.waitForRequest('/one-style.css'),
      page.goto(server.CROSS_PROCESS_PREFIX + pagePath)
    ]);
    expect(htmlReq.headers['foo']).toBe(undefined);
    expect(cssReq.headers['foo']).toBe('bar');
  });

  describe('network idle', function() {
    it('should navigate to empty page with networkidle', async({page, server}) => {
      const response = await page.goto(server.EMPTY_PAGE, { waitUntil: 'networkidle' });
      expect(response.status()).toBe(200);
    });

    /**
     * @param {import('../src/frames').Frame} frame
     * @param {TestServer} server
     * @param {() => Promise<void>} action
     * @param {boolean} isSetContent
     */
    async function networkIdleTest(frame, server, action, isSetContent) {
      const finishResponse = response => {
        response.statusCode = 404;
        response.end(`File not found`);
      };
      const waitForRequest = suffix => {
        return Promise.all([
          server.waitForRequest(suffix),
          frame._page.waitForRequest(server.PREFIX + suffix),
        ])
      }
      let responses = {};
      // Hold on to a bunch of requests without answering.
      server.setRoute('/fetch-request-a.js', (req, res) => responses.a = res);
      const initialFetchResourcesRequested = Promise.all([
        waitForRequest('/fetch-request-a.js'),
      ]);

      let secondFetchResourceRequested;
      server.setRoute('/fetch-request-d.js', (req, res) => responses.d = res);
      secondFetchResourceRequested = waitForRequest('/fetch-request-d.js');

      const waitForLoadPromise = isSetContent ? Promise.resolve() : frame.waitForNavigation({ waitUntil: 'load' });

      // Navigate to a page which loads immediately and then does a bunch of
      // requests via javascript's fetch method.
      const actionPromise = action();

      // Track when the action gets completed.
      let actionFinished = false;
      actionPromise.then(() => actionFinished = true);

      // Wait for the frame's 'load' event.
      await waitForLoadPromise;
      expect(actionFinished).toBe(false);

      // Wait for the initial three resources to be requested.
      await initialFetchResourcesRequested;
      expect(actionFinished).toBe(false);

      expect(responses.a).toBeTruthy();
      let timer;
      let timerTriggered = false;
      // Finishing response should trigger the second round.
      finishResponse(responses.a);

      // Wait for the second round to be requested.
      await secondFetchResourceRequested;
      expect(actionFinished).toBe(false);
      // Finishing the last response should trigger networkidle.
      timer = setTimeout(() => timerTriggered = true, 500);
      finishResponse(responses.d);

      const response = await actionPromise;
      clearTimeout(timer);
      expect(timerTriggered).toBe(true);
      if (!isSetContent)
        expect(response.ok()).toBe(true);
    }

    it('should wait for networkidle to succeed navigation', async({page, server}) => {
      await networkIdleTest(page.mainFrame(), server, () => {
        return page.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
      });
    });
    it('should wait for networkidle to succeed navigation with request from previous navigation', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      server.setRoute('/foo.js', () => {});
      await page.setContent(`<script>fetch('foo.js');</script>`);
      await networkIdleTest(page.mainFrame(), server, () => {
        return page.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' });
      });
    });
    it('should wait for networkidle in waitForNavigation', async({page, server}) => {
      await networkIdleTest(page.mainFrame(), server, () => {
        const promise = page.waitForNavigation({ waitUntil: 'networkidle' });
        page.goto(server.PREFIX + '/networkidle.html');
        return promise;
      });
    });
    it('should wait for networkidle in setContent', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await networkIdleTest(page.mainFrame(), server, () => {
        return page.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
      }, true);
    });
    it('should wait for networkidle in setContent with request from previous navigation', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      server.setRoute('/foo.js', () => {});
      await page.setContent(`<script>fetch('foo.js');</script>`);
      await networkIdleTest(page.mainFrame(), server, () => {
        return page.setContent(`<script src='networkidle.js'></script>`, { waitUntil: 'networkidle' });
      }, true);
    });
    it('should wait for networkidle when navigating iframe', async({page, server}) => {
      await page.goto(server.PREFIX + '/frames/one-frame.html');
      const frame = page.mainFrame().childFrames()[0];
      await networkIdleTest(frame, server, () => frame.goto(server.PREFIX + '/networkidle.html', { waitUntil: 'networkidle' }));
    });
    it('should wait for networkidle in setContent from the child frame', async({page, server}) => {
      await page.goto(server.EMPTY_PAGE);
      await networkIdleTest(page.mainFrame(), server, () => {
        return page.setContent(`<iframe src='networkidle.html'></iframe>`, { waitUntil: 'networkidle' });
      }, true);
    });
    it('should wait for networkidle from the child frame', async({page, server}) => {
      await networkIdleTest(page.mainFrame(), server, () => {
        return page.goto(server.PREFIX + '/networkidle-frame.html', { waitUntil: 'networkidle' });
      });
    });
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
    const bothFiredPromise = Promise.all([
      page.waitForNavigation({ waitUntil: 'load' }),
      domContentLoadedPromise
    ]).then(() => bothFired = true);

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
  it('should work when subframe issues window.stop()', async({page, server}) => {
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
  it('should work with url match', async({page, server}) => {
    let response1 = null;
    const response1Promise = page.waitForNavigation({ url: /one-style\.html/ }).then(response => response1 = response);
    let response2 = null;
    const response2Promise = page.waitForNavigation({ url: /\/frame.html/ }).then(response => response2 = response);
    let response3 = null;
    const response3Promise = page.waitForNavigation({ url: url => url.searchParams.get('foo') === 'bar' }).then(response => response3 = response);
    expect(response1).toBe(null);
    expect(response2).toBe(null);
    expect(response3).toBe(null);
    await page.goto(server.EMPTY_PAGE);
    expect(response1).toBe(null);
    expect(response2).toBe(null);
    expect(response3).toBe(null);
    await page.goto(server.PREFIX + '/frame.html');
    expect(response1).toBe(null);
    await response2Promise;
    expect(response2).not.toBe(null);
    expect(response3).toBe(null);
    await page.goto(server.PREFIX + '/one-style.html');
    await response1Promise;
    expect(response1).not.toBe(null);
    expect(response2).not.toBe(null);
    expect(response3).toBe(null);
    await page.goto(server.PREFIX + '/frame.html?foo=bar');
    await response3Promise;
    expect(response1).not.toBe(null);
    expect(response2).not.toBe(null);
    expect(response3).not.toBe(null);
    await page.goto(server.PREFIX + '/empty.html');
    expect(response1.url()).toBe(server.PREFIX + '/one-style.html');
    expect(response2.url()).toBe(server.PREFIX + '/frame.html');
    expect(response3.url()).toBe(server.PREFIX + '/frame.html?foo=bar');
  });
  it('should work with url match for same document navigations', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    let resolved = false;
    const waitPromise = page.waitForNavigation({ url: /third\.html/ }).then(() => resolved = true);
    expect(resolved).toBe(false);
    await page.evaluate(() => {
      history.pushState({}, '', '/first.html');
    });
    expect(resolved).toBe(false);
    await page.evaluate(() => {
      history.pushState({}, '', '/second.html');
    });
    expect(resolved).toBe(false);
    await page.evaluate(() => {
      history.pushState({}, '', '/third.html');
    });
    await waitPromise;
    expect(resolved).toBe(true);
  });
  it('should work for cross-process navigations', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const waitPromise = page.waitForNavigation({waitUntil: 'domcontentloaded'});
    const url = server.CROSS_PROCESS_PREFIX + '/empty.html';
    const gotoPromise = page.goto(url);
    const response = await waitPromise;
    expect(response.url()).toBe(url);
    expect(page.url()).toBe(url);
    expect(await page.evaluate('document.location.href')).toBe(url);
    await gotoPromise;
  });
});

describe('Page.waitForLoadState', () => {
  it('should pick up ongoing navigation', async({page, server}) => {
    let response = null;
    server.setRoute('/one-style.css', (req, res) => response = res);
    await Promise.all([
      server.waitForRequest('/one-style.css'),
      page.goto(server.PREFIX + '/one-style.html', {waitUntil: 'domcontentloaded'}),
    ]);
    const waitPromise = page.waitForLoadState();
    response.statusCode = 404;
    response.end('Not found');
    await waitPromise;
  });
  it('should respect timeout', async({page, server}) => {
    server.setRoute('/one-style.css', (req, res) => response = res);
    await page.goto(server.PREFIX + '/one-style.html', {waitUntil: 'domcontentloaded'});
    const error = await page.waitForLoadState('load', { timeout: 1 }).catch(e => e);
    expect(error.message).toBe('Navigation timeout exceeded');
  });
  it('should resolve immediately if loaded', async({page, server}) => {
    await page.goto(server.PREFIX + '/one-style.html');
    await page.waitForLoadState();
  });
  it('should resolve immediately if load state matches', async({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    server.setRoute('/one-style.css', (req, res) => response = res);
    await page.goto(server.PREFIX + '/one-style.html', {waitUntil: 'domcontentloaded'});
    await page.waitForLoadState('domcontentloaded');
  });
  it('should work with pages that have loaded before being connected to', async({page, context, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window._popup = window.open(document.location.href)),
    ]);
    // The url is about:blank in FF.
    // expect(popup.url()).toBe(server.EMPTY_PAGE);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(server.EMPTY_PAGE);
  });
  it('should wait for load state of empty url popup', async({browser, page}) => {
    const [popup, readyState] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => {
        const popup = window.open('');
        return popup.document.readyState;
      }),
    ]);
    await popup.waitForLoadState();
    expect(readyState).toBe(FFOX ? 'uninitialized' : 'complete');
    expect(await popup.evaluate(() => document.readyState)).toBe(FFOX ? 'uninitialized' : 'complete');
  });
  it('should wait for load state of about:blank popup ', async({browser, page}) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank') && 1),
    ]);
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => document.readyState)).toBe('complete');
  });
  it('should wait for load state of about:blank popup with noopener ', async({browser, page}) => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => window.open('about:blank', null, 'noopener') && 1),
    ]);
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => document.readyState)).toBe('complete');
  });
  it('should wait for load state of popup with network url ', async({browser, page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.open(url) && 1, server.EMPTY_PAGE),
    ]);
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => document.readyState)).toBe('complete');
  });
  it('should wait for load state of popup with network url and noopener ', async({browser, page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.open(url, null, 'noopener') && 1, server.EMPTY_PAGE),
    ]);
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => document.readyState)).toBe('complete');
  });
  it('should work with clicking target=_blank', async({browser, page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('a'),
    ]);
    await popup.waitForLoadState();
    expect(await popup.evaluate(() => document.readyState)).toBe('complete');
  });
  it('should wait for load state of newPage', async({browser, context, page, server}) => {
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      context.newPage(),
    ]);
    await newPage.waitForLoadState();
    expect(await newPage.evaluate(() => document.readyState)).toBe('complete');
  });
  it('should resolve after popup load', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    // Stall the 'load' by delaying css.
    let cssResponse;
    server.setRoute('/one-style.css', (req, res) => cssResponse = res);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      server.waitForRequest('/one-style.css'),
      page.evaluate(url => window.popup = window.open(url), server.PREFIX + '/one-style.html'),
    ]);
    let resolved = false;
    const loadSatePromise = popup.waitForLoadState().then(() => resolved = true);
    // Round trips!
    for (let i = 0; i < 5; i++)
      await page.evaluate('window');
    expect(resolved).toBe(false);
    cssResponse.end('');
    await loadSatePromise;
    expect(resolved).toBe(true);
    expect(popup.url()).toBe(server.PREFIX + '/one-style.html');
    await context.close();
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
    await page.goto(server.EMPTY_PAGE);
    // Attach three frames.
    const frames = [
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE),
      await utils.attachFrame(page, 'frame2', server.EMPTY_PAGE),
      await utils.attachFrame(page, 'frame3', server.EMPTY_PAGE),
    ];
    const serverResponses = [];
    server.setRoute('/0.html', (req, res) => serverResponses.push(res));
    server.setRoute('/1.html', (req, res) => serverResponses.push(res));
    server.setRoute('/2.html', (req, res) => serverResponses.push(res));
    const navigations = [];
    for (let i = 0; i < 3; ++i) {
      navigations.push(frames[i].goto(server.PREFIX + '/' + i + '.html'));
      await server.waitForRequest('/' + i + '.html');
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
    await Promise.all([
      frame.waitForNavigation().catch(e => error = e),
      frame.evaluate('window.location = "/empty.html"'),
      page.evaluate('setTimeout(() => document.querySelector("iframe").remove())'),
    ]).catch(e => error = e);
    expect(error.message).toContain('frame was detached');
  });
});

describe('Frame._waitForLodState', function() {
  it('should work', async({page, server}) => {
    await page.goto(server.PREFIX + '/frames/one-frame.html');
    const frame = page.frames()[1];

    const requestPromise = new Promise(resolve => page.route(server.PREFIX + '/one-style.css',resolve));
    await frame.goto(server.PREFIX + '/one-style.html', {waitUntil: 'domcontentloaded'});
    const request = await requestPromise;
    let resolved = false;
    const loadPromise = frame.waitForLoadState().then(() => resolved = true);
    // give the promise a chance to resolve, even though it shouldn't
    await page.evaluate('1');
    expect(resolved).toBe(false);
    request.continue();
    await loadPromise;
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

describe('Click navigation', function() {
  it('should work with _blank target', async({page, server}) => {
    server.setRoute('/empty.html', (req, res) => {
      res.end(`<a href="${server.EMPTY_PAGE}" target="_blank">Click me</a>`);
    });
    await page.goto(server.EMPTY_PAGE);
    await page.click('"Click me"');
  });
  it('should work with cross-process _blank target', async({page, server}) => {
    server.setRoute('/empty.html', (req, res) => {
      res.end(`<a href="${server.CROSS_PROCESS_PREFIX}/empty.html" target="_blank">Click me</a>`);
    });
    await page.goto(server.EMPTY_PAGE);
    await page.click('"Click me"');
  });
});

function expectSSLError(errorMessage) {
  if (CHROMIUM) {
    expect(errorMessage).toContain('net::ERR_CERT_AUTHORITY_INVALID');
  } else if (WEBKIT) {
    if (MAC)
      expect(errorMessage).toContain('The certificate for this server is invalid');
    else if (WIN)
      expect(errorMessage).toContain('SSL peer certificate or SSH remote key was not OK');
    else
      expect(errorMessage).toContain('Unacceptable TLS certificate');
  } else {
    expect(errorMessage).toContain('SSL_ERROR_UNKNOWN');
  }
}

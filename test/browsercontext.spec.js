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
const {FFOX, CHROMIUM, WEBKIT, MAC} = utils.testOptions(browserType);

describe('BrowserContext', function() {
  it('should create new context', async function({browser}) {
    expect(browser.contexts().length).toBe(0);
    const context = await browser.newContext();
    expect(browser.contexts().length).toBe(1);
    expect(browser.contexts().indexOf(context) !== -1).toBe(true);
    await context.close();
    expect(browser.contexts().length).toBe(0);
  });
  it('window.open should use parent tab context', async function({browser, server}) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(url => window.open(url), server.EMPTY_PAGE)
    ]);
    expect(popup.context()).toBe(context);
    await context.close();
  });
  it('should isolate localStorage and cookies', async function({browser, server}) {
    // Create two incognito contexts.
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    expect(context1.pages().length).toBe(0);
    expect(context2.pages().length).toBe(0);

    // Create a page in first incognito context.
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.evaluate(() => {
      localStorage.setItem('name', 'page1');
      document.cookie = 'name=page1';
    });

    expect(context1.pages().length).toBe(1);
    expect(context2.pages().length).toBe(0);

    // Create a page in second incognito context.
    const page2 = await context2.newPage();
    await page2.goto(server.EMPTY_PAGE);
    await page2.evaluate(() => {
      localStorage.setItem('name', 'page2');
      document.cookie = 'name=page2';
    });

    expect(context1.pages().length).toBe(1);
    expect(context2.pages().length).toBe(1);
    expect(context1.pages()[0]).toBe(page1);
    expect(context2.pages()[0]).toBe(page2);

    // Make sure pages don't share localstorage or cookies.
    expect(await page1.evaluate(() => localStorage.getItem('name'))).toBe('page1');
    expect(await page1.evaluate(() => document.cookie)).toBe('name=page1');
    expect(await page2.evaluate(() => localStorage.getItem('name'))).toBe('page2');
    expect(await page2.evaluate(() => document.cookie)).toBe('name=page2');

    // Cleanup contexts.
    await Promise.all([
      context1.close(),
      context2.close()
    ]);
    expect(browser.contexts().length).toBe(0);
  });
  it('should propagate default viewport to the page', async({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 456, height: 789 } });
    const page = await context.newPage();
    expect(page.viewportSize().width).toBe(456);
    expect(page.viewportSize().height).toBe(789);
    expect(await page.evaluate('window.innerWidth')).toBe(456);
    expect(await page.evaluate('window.innerHeight')).toBe(789);
    await context.close();
  });
  it('should make a copy of default viewport', async({ browser }) => {
    const viewport = { width: 456, height: 789 };
    const context = await browser.newContext({ viewport });
    viewport.width = 567;
    const page = await context.newPage();
    expect(page.viewportSize().width).toBe(456);
    expect(page.viewportSize().height).toBe(789);
    expect(await page.evaluate('window.innerWidth')).toBe(456);
    expect(await page.evaluate('window.innerHeight')).toBe(789);
    await context.close();
  });
  it('close() should work for empty context', async({ browser }) => {
    const context = await browser.newContext();
    await context.close();
  });
  it('close() should abort waitForEvent', async({ browser }) => {
    const context = await browser.newContext();
    const promise = context.waitForEvent('page').catch(e => e);
    await context.close();
    let error = await promise;
    expect(error.message).toContain('Context closed');
  });
});

describe('BrowserContext({userAgent})', function() {
  it('should work', async({browser, server}) => {
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
      await context.close();
    }
    {
      const context = await browser.newContext({ userAgent: 'foobar' });
      const page = await context.newPage();
      const [request] = await Promise.all([
        server.waitForRequest('/empty.html'),
        page.goto(server.EMPTY_PAGE),
      ]);
      expect(request.headers['user-agent']).toBe('foobar');
      await context.close();
    }
  });
  it('should work for subframes', async({browser, server}) => {
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
      await context.close();
    }
    {
      const context = await browser.newContext({ userAgent: 'foobar' });
      const page = await context.newPage();
      const [request] = await Promise.all([
        server.waitForRequest('/empty.html'),
        utils.attachFrame(page, 'frame1', server.EMPTY_PAGE),
      ]);
      expect(request.headers['user-agent']).toBe('foobar');
      await context.close();
    }
  });
  it('should emulate device user-agent', async({browser, server}) => {
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => navigator.userAgent)).not.toContain('iPhone');
      await context.close();
    }
    {
      const context = await browser.newContext({ userAgent: playwright.devices['iPhone 6'].userAgent });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/mobile.html');
      expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
      await context.close();
    }
  });
  it('should make a copy of default options', async({browser, server}) => {
    const options = { userAgent: 'foobar' };
    const context = await browser.newContext(options);
    options.userAgent = 'wrong';
    const page = await context.newPage();
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect(request.headers['user-agent']).toBe('foobar');
    await context.close();
  });
});

describe('BrowserContext({bypassCSP})', function() {
  it('should bypass CSP meta tag', async({browser, server}) => {
    // Make sure CSP prohibits addScriptTag.
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/csp.html');
      await page.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
      expect(await page.evaluate(() => window.__injected)).toBe(undefined);
      await context.close();
    }

    // By-pass CSP and try one more time.
    {
      const context = await browser.newContext({ bypassCSP: true });
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/csp.html');
      await page.addScriptTag({content: 'window.__injected = 42;'});
      expect(await page.evaluate(() => window.__injected)).toBe(42);
      await context.close();
    }
  });

  it('should bypass CSP header', async({browser, server}) => {
    // Make sure CSP prohibits addScriptTag.
    server.setCSP('/empty.html', 'default-src "self"');

    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
      expect(await page.evaluate(() => window.__injected)).toBe(undefined);
      await context.close();
    }

    // By-pass CSP and try one more time.
    {
      const context = await browser.newContext({ bypassCSP: true });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      await page.addScriptTag({content: 'window.__injected = 42;'});
      expect(await page.evaluate(() => window.__injected)).toBe(42);
      await context.close();
    }
  });

  it('should bypass after cross-process navigation', async({browser, server}) => {
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/csp.html');
    await page.addScriptTag({content: 'window.__injected = 42;'});
    expect(await page.evaluate(() => window.__injected)).toBe(42);

    await page.goto(server.CROSS_PROCESS_PREFIX + '/csp.html');
    await page.addScriptTag({content: 'window.__injected = 42;'});
    expect(await page.evaluate(() => window.__injected)).toBe(42);
    await context.close();
  });
  it('should bypass CSP in iframes as well', async({browser, server}) => {
    // Make sure CSP prohibits addScriptTag in an iframe.
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const frame = await utils.attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
      await frame.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
      expect(await frame.evaluate(() => window.__injected)).toBe(undefined);
      await context.close();
    }

    // By-pass CSP and try one more time.
    {
      const context = await browser.newContext({ bypassCSP: true });
      const page = await context.newPage();
      await page.goto(server.EMPTY_PAGE);
      const frame = await utils.attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
      await frame.addScriptTag({content: 'window.__injected = 42;'}).catch(e => void e);
      expect(await frame.evaluate(() => window.__injected)).toBe(42);
      await context.close();
    }
  });
});

describe('BrowserContext({javaScriptEnabled})', function() {
  it('should work', async({browser}) => {
    {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto('data:text/html, <script>var something = "forbidden"</script>');
      let error = null;
      await page.evaluate('something').catch(e => error = e);
      if (WEBKIT)
        expect(error.message).toContain('Can\'t find variable: something');
      else
        expect(error.message).toContain('something is not defined');
      await context.close();
    }

    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto('data:text/html, <script>var something = "forbidden"</script>');
      expect(await page.evaluate('something')).toBe('forbidden');
      await context.close();
    }
  });
  it('should be able to navigate after disabling javascript', async({browser, server}) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await context.close();
  });
});

describe('BrowserContext.pages()', function() {
  it('should return all of the pages', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const second = await context.newPage();
    const allPages = context.pages();
    expect(allPages.length).toBe(2);
    expect(allPages).toContain(page);
    expect(allPages).toContain(second);
    await context.close();
  });
  it('should close all belonging pages once closing context', async function({browser}) {
    const context = await browser.newContext();
    await context.newPage();
    expect(context.pages().length).toBe(1);

    await context.close();
    expect(context.pages().length).toBe(0);
  });
});

describe('BrowserContext.exposeFunction', () => {
  it('should work', async({browser, server}) => {
    const context = await browser.newContext();
    await context.exposeFunction('add', (a, b) => a + b);
    const page = await context.newPage();
    await page.exposeFunction('mul', (a, b) => a * b);
    const result = await page.evaluate(async function() {
      return { mul: await mul(9, 4), add: await add(9, 4) };
    });
    expect(result).toEqual({ mul: 36, add: 13 });
    await context.close();
  });
  it('should throw for duplicate registrations', async({browser, server}) => {
    const context = await browser.newContext();
    await context.exposeFunction('foo', () => {});
    await context.exposeFunction('bar', () => {});
    let error = await context.exposeFunction('foo', () => {}).catch(e => e);
    expect(error.message).toBe('Function "foo" has been already registered');
    const page = await context.newPage();
    error = await page.exposeFunction('foo', () => {}).catch(e => e);
    expect(error.message).toBe('Function "foo" has been already registered in the browser context');
    await page.exposeFunction('baz', () => {});
    error = await context.exposeFunction('baz', () => {}).catch(e => e);
    expect(error.message).toBe('Function "baz" has been already registered in one of the pages');
    await context.close();
  });
  it('should be callable from-inside addInitScript', async({browser, server}) => {
    const context = await browser.newContext();
    let args = [];
    await context.exposeFunction('woof', function(arg) {
      args.push(arg);
    });
    await context.addInitScript(() => woof('context'));
    const page = await context.newPage();
    await page.addInitScript(() => woof('page'));
    args = [];
    await page.reload();
    expect(args).toEqual(['context', 'page']);
    await context.close();
  });
});

describe('BrowserContext.route', () => {
  it('should intercept', async({browser, server}) => {
    const context = await browser.newContext();
    let intercepted = false;
    await context.route('**/empty.html', route => {
      intercepted = true;
      const request = route.request();
      expect(request.url()).toContain('empty.html');
      expect(request.headers()['user-agent']).toBeTruthy();
      expect(request.method()).toBe('GET');
      expect(request.postData()).toBe(null);
      expect(request.isNavigationRequest()).toBe(true);
      expect(request.resourceType()).toBe('document');
      expect(request.frame() === page.mainFrame()).toBe(true);
      expect(request.frame().url()).toBe('about:blank');
      route.continue();
    });
    const page = await context.newPage();
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
    expect(intercepted).toBe(true);
    await context.close();
  });
  it('should unroute', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    let intercepted = [];
    const handler1 = route => {
      intercepted.push(1);
      route.continue();
    };
    await context.route('**/empty.html', handler1);
    await context.route('**/empty.html', route => {
      intercepted.push(2);
      route.continue();
    });
    await context.route('**/empty.html', route => {
      intercepted.push(3);
      route.continue();
    });
    await context.route('**/*', route => {
      intercepted.push(4);
      route.continue();
    });
    await page.goto(server.EMPTY_PAGE);
    expect(intercepted).toEqual([1]);

    intercepted = [];
    await context.unroute('**/empty.html', handler1);
    await page.goto(server.EMPTY_PAGE);
    expect(intercepted).toEqual([2]);

    intercepted = [];
    await context.unroute('**/empty.html');
    await page.goto(server.EMPTY_PAGE);
    expect(intercepted).toEqual([4]);

    await context.close();
  });
  it('should yield to page.route', async({browser, server}) => {
    const context = await browser.newContext();
    await context.route('**/empty.html', route => {
      route.fulfill({ status: 200, body: 'context' });
    });
    const page = await context.newPage();
    await page.route('**/empty.html', route => {
      route.fulfill({ status: 200, body: 'page' });
    });
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
    expect(await response.text()).toBe('page');
    await context.close();
  });
});

describe('BrowserContext.setHTTPCredentials', function() {
  it('should work', async({browser, server}) => {
    server.setAuth('/empty.html', 'user', 'pass');
    const context = await browser.newContext();
    const page = await context.newPage();
    let response = await page.goto(server.EMPTY_PAGE);
    expect(response.status()).toBe(401);
    await context.setHTTPCredentials({
      username: 'user',
      password: 'pass'
    });
    response = await page.reload();
    expect(response.status()).toBe(200);
    await context.close();
  });
  it('should fail if wrong credentials', async({browser, server}) => {
    server.setAuth('/empty.html', 'user', 'pass');
    const context = await browser.newContext({
      httpCredentials: { username: 'foo', password: 'bar' }
    });
    const page = await context.newPage();
    let response = await page.goto(server.EMPTY_PAGE);
    expect(response.status()).toBe(401);
    await context.setHTTPCredentials({
      username: 'user',
      password: 'pass'
    });
    response = await page.goto(server.EMPTY_PAGE);
    expect(response.status()).toBe(200);
    await context.close();
  });
  it('should allow disable authentication', async({browser, server}) => {
    server.setAuth('/empty.html', 'user', 'pass');
    const context = await browser.newContext({
      httpCredentials: { username: 'user', password: 'pass' }
    });
    const page = await context.newPage();
    let response = await page.goto(server.EMPTY_PAGE);
    expect(response.status()).toBe(200);
    await context.setHTTPCredentials(null);
    // Navigate to a different origin to bust Chromium's credential caching.
    response = await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
    expect(response.status()).toBe(401);
    await context.close();
  });
  it('should return resource body', async({browser, server}) => {
    server.setAuth('/playground.html', 'user', 'pass');
    const context = await browser.newContext({
      httpCredentials: { username: 'user', password: 'pass' }
    });
    const page = await context.newPage();
    let response = await page.goto(server.PREFIX + '/playground.html');
    expect(response.status()).toBe(200);
    expect(await page.title()).toBe("Playground");
    expect((await response.body()).toString()).toContain("Playground");
    await context.close();
  });
});

describe('BrowserContext.setOffline', function() {
  it('should work with initial option', async({browser, server}) => {
    const context = await browser.newContext({offline: true});
    const page = await context.newPage();
    let error = null;
    await page.goto(server.EMPTY_PAGE).catch(e => error = e);
    expect(error).toBeTruthy();
    await context.setOffline(false);
    const response = await page.goto(server.EMPTY_PAGE);
    expect(response.status()).toBe(200);
    await context.close();
  });
  it('should emulate navigator.onLine', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
    await context.setOffline(true);
    expect(await page.evaluate(() => window.navigator.onLine)).toBe(false);
    await context.setOffline(false);
    expect(await page.evaluate(() => window.navigator.onLine)).toBe(true);
    await context.close();
  });
});

describe('Events.BrowserContext.Page', function() {
  it('should have url', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const [otherPage] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(url => window.open(url), server.EMPTY_PAGE)
    ]);
    expect(otherPage.url()).toBe(server.EMPTY_PAGE);
    await context.close();
  });
  it('should have url after domcontentloaded', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const [otherPage] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(url => window.open(url), server.EMPTY_PAGE)
    ]);
    await otherPage.waitForLoadState('domcontentloaded');
    expect(otherPage.url()).toBe(server.EMPTY_PAGE);
    await context.close();
  });
  it('should have about:blank url with domcontentloaded', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const [otherPage] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(url => window.open(url), 'about:blank')
    ]);
    await otherPage.waitForLoadState('domcontentloaded');
    expect(otherPage.url()).toBe('about:blank');
    await context.close();
  });
  it('should have about:blank for empty url with domcontentloaded', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const [otherPage] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(() => window.open())
    ]);
    await otherPage.waitForLoadState('domcontentloaded');
    expect(otherPage.url()).toBe('about:blank');
    await context.close();
  });
  it('should report when a new page is created and closed', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const [otherPage] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(url => window.open(url), server.CROSS_PROCESS_PREFIX + '/empty.html'),
    ]);
    // The url is about:blank in FF when 'page' event is fired.
    expect(otherPage.url()).toContain(server.CROSS_PROCESS_PREFIX);
    expect(await otherPage.evaluate(() => ['Hello', 'world'].join(' '))).toBe('Hello world');
    expect(await otherPage.$('body')).toBeTruthy();

    let allPages = context.pages();
    expect(allPages).toContain(page);
    expect(allPages).toContain(otherPage);

    let closeEventReceived;
    otherPage.once('close', () => closeEventReceived = true);
    await otherPage.close();
    expect(closeEventReceived).toBeTruthy();

    allPages = context.pages();
    expect(allPages).toContain(page);
    expect(allPages).not.toContain(otherPage);
    await context.close();
  });
  it('should report initialized pages', async({browser, server}) => {
    const context = await browser.newContext();
    const pagePromise = context.waitForEvent('page');
    context.newPage();
    const newPage = await pagePromise;
    expect(newPage.url()).toBe('about:blank');

    const popupPromise = context.waitForEvent('page');
    const evaluatePromise = newPage.evaluate(() => window.open('about:blank'));
    const popup = await popupPromise;
    expect(popup.url()).toBe('about:blank');
    await evaluatePromise;
    await context.close();
  });
  it('should not crash while redirecting of original request was missed', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    let serverResponse = null;
    server.setRoute('/one-style.css', (req, res) => serverResponse = res);
    // Open a new page. Use window.open to connect to the page later.
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.evaluate(url => window.open(url), server.PREFIX + '/one-style.html'),
      server.waitForRequest('/one-style.css')
    ]);
    // Issue a redirect.
    serverResponse.writeHead(302, { location: '/injectedstyle.css' });
    serverResponse.end();
    await newPage.waitForLoadState('domcontentloaded');
    expect(newPage.url()).toBe(server.PREFIX + '/one-style.html');
    // Cleanup.
    await context.close();
  });
  it('should have an opener', async({browser, server}) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.goto(server.PREFIX + '/popup/window-open.html')
    ]);
    expect(popup.url()).toBe(server.PREFIX + '/popup/popup.html');
    expect(await popup.opener()).toBe(page);
    expect(await page.opener()).toBe(null);
    await context.close();
  });
  it('should fire page lifecycle events', async function({browser, server}) {
    const context = await browser.newContext();
    const events = [];
    context.on('page', async page => {
      events.push('CREATED: ' + page.url());
      page.on('close', () => events.push('DESTROYED: ' + page.url()));
    });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.close();
    expect(events).toEqual([
      'CREATED: about:blank',
      `DESTROYED: ${server.EMPTY_PAGE}`
    ]);
    await context.close();
  });
  it.fail(WEBKIT)('should work with Shift-clicking', async({browser, server}) => {
    // WebKit: Shift+Click does not open a new window.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<a href="/one-style.html">yo</a>');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.click('a', { modifiers: ['Shift'] }),
    ]);
    expect(await popup.opener()).toBe(null);
    await context.close();
  });
  it.fail(WEBKIT || FFOX)('should work with Ctrl-clicking', async({browser, server}) => {
    // Firefox: reports an opener in this case.
    // WebKit: Ctrl+Click does not open a new tab.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.setContent('<a href="/one-style.html">yo</a>');
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.click('a', { modifiers: [ MAC ? 'Meta' : 'Control'] }),
    ]);
    expect(await popup.opener()).toBe(null);
    await context.close();
  });
});

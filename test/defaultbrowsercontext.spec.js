/**
 * Copyright 2017 Google Inc. All rights reserved.
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
const utils = require('./utils');
const {makeUserDataDir, removeUserDataDir} = utils;
const {FFOX, MAC, CHROMIUM, WEBKIT, WIN, USES_HOOKS} = utils.testOptions(browserType);

describe('launchPersistentContext()', function() {
  async function launch(state, options = {}) {
    state.userDataDir = await makeUserDataDir();
    state.context = await state.browserType.launchPersistentContext(state.userDataDir, {...state.defaultBrowserOptions, ...options});
    state.page = state.context.pages()[0];
    return state;
  }
  async function close(state) {
    await state.context.close();
    await removeUserDataDir(state.userDataDir);
    delete state.page;
    delete state.context;
    delete state.userDataDir;
  }

  it('context.cookies() should work', async state => {
    const { page, server } = await launch(state);
    await page.goto(server.EMPTY_PAGE);
    const documentCookie = await page.evaluate(() => {
      document.cookie = 'username=John Doe';
      return document.cookie;
    });
    expect(documentCookie).toBe('username=John Doe');
    expect(await page.context().cookies()).toEqual([{
      name: 'username',
      value: 'John Doe',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
    }]);
    await close(state);
  });
  /*
  it('context.addCookies() should work', async state => {
    const { page, server } = await launch(state);
    await page.goto(server.EMPTY_PAGE);
    await page.context().addCookies([{
      url: server.EMPTY_PAGE,
      name: 'username',
      value: 'John Doe'
    }]);
    expect(await page.evaluate(() => document.cookie)).toBe('username=John Doe');
    expect(await page.context().cookies()).toEqual([{
      name: 'username',
      value: 'John Doe',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
    }]);
    await close(state);
  });
  it('context.clearCookies() should work', async state => {
    const { page, server } = await launch(state);
    await page.goto(server.EMPTY_PAGE);
    await page.context().addCookies([{
      url: server.EMPTY_PAGE,
      name: 'cookie1',
      value: '1'
    }, {
      url: server.EMPTY_PAGE,
      name: 'cookie2',
      value: '2'
    }]);
    expect(await page.evaluate('document.cookie')).toBe('cookie1=1; cookie2=2');
    await page.context().clearCookies();
    await page.reload();
    expect(await page.context().cookies([])).toEqual([]);
    expect(await page.evaluate('document.cookie')).toBe('');
    await close(state);
  });
  it('should(not) block third party cookies', async state => {
    const { page, server, context } = await launch(state);
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(src => {
      let fulfill;
      const promise = new Promise(x => fulfill = x);
      const iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      iframe.onload = fulfill;
      iframe.src = src;
      return promise;
    }, server.CROSS_PROCESS_PREFIX + '/grid.html');
    const documentCookie = await page.frames()[1].evaluate(() => {
      document.cookie = 'username=John Doe';
      return document.cookie;
    });
    await page.waitForTimeout(2000);
    const allowsThirdParty = CHROMIUM || FFOX;
    expect(documentCookie).toBe(allowsThirdParty ? 'username=John Doe' : '');
    const cookies = await context.cookies(server.CROSS_PROCESS_PREFIX + '/grid.html');
    if (allowsThirdParty) {
      expect(cookies).toEqual([
        {
          "domain": "127.0.0.1",
          "expires": -1,
          "httpOnly": false,
          "name": "username",
          "path": "/",
          "sameSite": "None",
          "secure": false,
          "value": "John Doe"
        }
      ]);
    } else {
      expect(cookies).toEqual([]);
    }
    await close(state);
  });
  it('should support viewport option', async state => {
    let { page, context } = await launch(state, {viewport: { width: 456, height: 789 }});
    await utils.verifyViewport(page, 456, 789);
    page = await context.newPage();
    await utils.verifyViewport(page, 456, 789);
    await close(state);
  });
  it('should support deviceScaleFactor option', async state => {
    const { page } = await launch(state, {deviceScaleFactor: 3});
    expect(await page.evaluate('window.devicePixelRatio')).toBe(3);
    await close(state);
  });
  it('should support userAgent option', async state => {
    const { page, server } = await launch(state, {userAgent: 'foobar'});
    expect(await page.evaluate(() => navigator.userAgent)).toBe('foobar');
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect(request.headers['user-agent']).toBe('foobar');
    await close(state);
  });
  it('should support bypassCSP option', async state => {
    const { page, server } = await launch(state, {bypassCSP: true});
    await page.goto(server.PREFIX + '/csp.html');
    await page.addScriptTag({content: 'window.__injected = 42;'});
    expect(await page.evaluate(() => window.__injected)).toBe(42);
    await close(state);
  });
  it('should support javascriptEnabled option', async state => {
    const { page } = await launch(state, {javaScriptEnabled: false});
    await page.goto('data:text/html, <script>var something = "forbidden"</script>');
    let error = null;
    await page.evaluate('something').catch(e => error = e);
    if (WEBKIT)
      expect(error.message).toContain('Can\'t find variable: something');
    else
      expect(error.message).toContain('something is not defined');
    await close(state);
  });
  it('should support httpCredentials option', async state => {
    const { page, server } = await launch(state, {httpCredentials: { username: 'user', password: 'pass' }});
    server.setAuth('/playground.html', 'user', 'pass');
    const response = await page.goto(server.PREFIX + '/playground.html');
    expect(response.status()).toBe(200);
    await close(state);
  });
  it('should support offline option', async state => {
    const { page, server } = await launch(state, {offline: true});
    const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
    expect(error).toBeTruthy();
    await close(state);
  });
  it.skip(true)('should support acceptDownloads option', async state => {
    // TODO: unskip once we support downloads in persistent context.
    const { page, server } = await launch(state, {acceptDownloads: true});
    server.setRoute('/download', (req, res) => {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment');
      res.end(`Hello world`);
    });
    await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
    const [ download ] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a')
    ]);
    const path = await download.path();
    expect(fs.existsSync(path)).toBeTruthy();
    expect(fs.readFileSync(path).toString()).toBe('Hello world');
    await close(state);
  });
  it('should support hasTouch option', async state => {
    const { page, server } = await launch(state, {hasTouch: true});
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
    await close(state);
  });
  it.skip(FFOX)('should work in persistent context', async state => {
    // Firefox does not support mobile.
    const { page, server } = await launch(state, {viewport: {width: 320, height: 480}, isMobile: true});
    await page.goto(server.PREFIX + '/empty.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(980);
    await close(state);
  });
  it('should support colorScheme option', async state => {
    const { page } = await launch(state, {colorScheme: 'dark'});
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
    expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
    await close(state);
  });
  it('should support timezoneId option', async state => {
    const { page } = await launch(state, {timezoneId: 'America/Jamaica'});
    expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');
    await close(state);
  });
  it('should support locale option', async state => {
    const { page } = await launch(state, {locale: 'fr-CH'});
    expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
    await close(state);
  });
  it('should support geolocation and permissions options', async state => {
    const { page, server } = await launch(state, {geolocation: {longitude: 10, latitude: 10}, permissions: ['geolocation']});
    await page.goto(server.EMPTY_PAGE);
    const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
      resolve({latitude: position.coords.latitude, longitude: position.coords.longitude});
    })));
    expect(geolocation).toEqual({latitude: 10, longitude: 10});
    await close(state);
  });
  it('should support ignoreHTTPSErrors option', async state => {
    const { page, httpsServer } = await launch(state, {ignoreHTTPSErrors: true});
    let error = null;
    const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
    expect(error).toBe(null);
    expect(response.ok()).toBe(true);
    await close(state);
  });
  it('should support extraHTTPHeaders option', async state => {
    const { page, server } = await launch(state, {extraHTTPHeaders: { foo: 'bar' }});
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect(request.headers['foo']).toBe('bar');
    await close(state);
  });
  it('should accept userDataDir', async state => {
    const { userDataDir, context } = await launch(state);
    // Note: we need an open page to make sure its functional.
    expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
    await context.close();
    expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
  });
  it.slow()('should restore state from userDataDir', async({browserType, defaultBrowserOptions, server}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
    const page = await browserContext.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => localStorage.hey = 'hello');
    await browserContext.close();

    const browserContext2 = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
    const page2 = await browserContext2.newPage();
    await page2.goto(server.EMPTY_PAGE);
    expect(await page2.evaluate(() => localStorage.hey)).toBe('hello');
    await browserContext2.close();

    const userDataDir2 = await makeUserDataDir();
    const browserContext3 = await browserType.launchPersistentContext(userDataDir2, defaultBrowserOptions);
    const page3 = await browserContext3.newPage();
    await page3.goto(server.EMPTY_PAGE);
    expect(await page3.evaluate(() => localStorage.hey)).not.toBe('hello');
    await browserContext3.close();

    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
    await removeUserDataDir(userDataDir2);
  });
  it.slow().fail(CHROMIUM && (WIN || MAC))('should restore cookies from userDataDir', async({browserType, defaultBrowserOptions,  server}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
    const page = await browserContext.newPage();
    await page.goto(server.EMPTY_PAGE);
    const documentCookie = await page.evaluate(() => {
      document.cookie = 'doSomethingOnlyOnce=true; expires=Fri, 31 Dec 9999 23:59:59 GMT';
      return document.cookie;
    });
    expect(documentCookie).toBe('doSomethingOnlyOnce=true');
    await browserContext.close();

    const browserContext2 = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
    const page2 = await browserContext2.newPage();
    await page2.goto(server.EMPTY_PAGE);
    expect(await page2.evaluate(() => document.cookie)).toBe('doSomethingOnlyOnce=true');
    await browserContext2.close();

    const userDataDir2 = await makeUserDataDir();
    const browserContext3 = await browserType.launchPersistentContext(userDataDir2, defaultBrowserOptions);
    const page3 = await browserContext3.newPage();
    await page3.goto(server.EMPTY_PAGE);
    expect(await page3.evaluate(() => document.cookie)).not.toBe('doSomethingOnlyOnce=true');
    await browserContext3.close();

    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
    await removeUserDataDir(userDataDir2);
  });
  it('should have default URL when launching browser', async state => {
    const { context } = await launch(state);
    const urls = context.pages().map(page => page.url());
    expect(urls).toEqual(['about:blank']);
    await close(state);
  });
  it.skip(FFOX)('should throw if page argument is passed', async ({browserType, defaultBrowserOptions, server}) => {
    const userDataDir = await makeUserDataDir();
    const options = {...defaultBrowserOptions, args: [server.EMPTY_PAGE] };
    const error = await browserType.launchPersistentContext(userDataDir, options).catch(e => e);
    expect(error.message).toContain('can not specify page');
    await removeUserDataDir(userDataDir);
  });
  it('should have passed URL when launching with ignoreDefaultArgs: true', async ({playwrightPath, browserType, defaultBrowserOptions, server}) => {
    const userDataDir = await makeUserDataDir();
    const args = require(playwrightPath)[browserType.name()]._defaultArgs(defaultBrowserOptions, 'persistent', userDataDir, 0).filter(a => a !== 'about:blank');
    const options = {
      ...defaultBrowserOptions,
      args: [...args, server.EMPTY_PAGE],
      ignoreDefaultArgs: true,
    };
    const browserContext = await browserType.launchPersistentContext(userDataDir, options);
    if (!browserContext.pages().length)
      await browserContext.waitForEvent('page');
    await browserContext.pages()[0].waitForLoadState();
    const gotUrls = browserContext.pages().map(page => page.url());
    expect(gotUrls).toEqual([server.EMPTY_PAGE]);
    await browserContext.close();
    await removeUserDataDir(userDataDir);
  });
  it.skip(USES_HOOKS)('should handle timeout', async({browserType, defaultBrowserOptions}) => {
    const userDataDir = await makeUserDataDir();
    const options = { ...defaultBrowserOptions, timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
    const error = await browserType.launchPersistentContext(userDataDir, options).catch(e => e);
    expect(error.message).toContain(`Timeout 5000ms exceeded during browserType.launchPersistentContext.`);
    await removeUserDataDir(userDataDir);
  });
  it.skip(USES_HOOKS)('should handle exception', async({browserType, defaultBrowserOptions}) => {
    const userDataDir = await makeUserDataDir();
    const e = new Error('Dummy');
    const options = { ...defaultBrowserOptions, __testHookBeforeCreateBrowser: () => { throw e; } };
    const error = await browserType.launchPersistentContext(userDataDir, options).catch(e => e);
    expect(error.message).toContain('Dummy');
    await removeUserDataDir(userDataDir);
  });
  it('should fire close event for a persistent context', async(state) => {
    const {context} = await launch(state);
    let closed = false;
    context.on('close', () => closed = true);
    await close(state);
    expect(closed).toBe(true);
  });
  it.skip(!CHROMIUM)('coverage should work', async state => {
    const { page, server } = await launch(state);
    await page.coverage.startJSCoverage();
    await page.goto(server.PREFIX + '/jscoverage/simple.html', { waitUntil: 'load' });
    const coverage = await page.coverage.stopJSCoverage();
    expect(coverage.length).toBe(1);
    expect(coverage[0].url).toContain('/jscoverage/simple.html');
    expect(coverage[0].functions.find(f => f.functionName === 'foo').ranges[0].count).toEqual(1);
    await close(state);
  });
  it.skip(CHROMIUM)('coverage should be missing', async state => {
    const { page } = await launch(state);
    expect(page.coverage).toBe(null);
    await close(state);
  });
  */
});

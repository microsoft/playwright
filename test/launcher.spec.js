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

const path = require('path');
const fs = require('fs');
const utils = require('./utils');
const { makeUserDataDir, removeUserDataDir } = utils;
const {FFOX, CHROMIUM, WEBKIT, WIN} = utils.testOptions(browserType);

describe('Playwright', function() {
  describe('browserType.launch', function() {
    it('should reject all promises when browser is closed', async({browserType, defaultBrowserOptions}) => {
      const browser = await browserType.launch(defaultBrowserOptions);
      const page = await (await browser.newContext()).newPage();
      let error = null;
      const neverResolves = page.evaluate(() => new Promise(r => {})).catch(e => error = e);
      await page.evaluate(() => new Promise(f => setTimeout(f, 0)));
      await browser.close();
      await neverResolves;
      expect(error.message).toContain('Protocol error');
    });
    it('should throw if userDataDir option is passed', async({browserType, defaultBrowserOptions}) => {
      let waitError = null;
      const options = Object.assign({}, defaultBrowserOptions, {userDataDir: 'random-path'});
      await browserType.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('launchPersistentContext');
    });
    it('should throw if page argument is passed', async({browserType, defaultBrowserOptions}) => {
      let waitError = null;
      const options = Object.assign({}, defaultBrowserOptions, { args: ['http://example.com'] });
      await browserType.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('can not specify page');
    });
    it('should reject if executable path is invalid', async({browserType, defaultBrowserOptions}) => {
      let waitError = null;
      const options = Object.assign({}, defaultBrowserOptions, {executablePath: 'random-invalid-path'});
      await browserType.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('Failed to launch');
    });
  });

  describe('browserType.launchPersistentContext', function() {
    it('should have default URL when launching browser', async ({browserType, defaultBrowserOptions}) => {
      const userDataDir = await makeUserDataDir();
      const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
      const urls = browserContext.pages().map(page => page.url());
      expect(urls).toEqual(['about:blank']);
      await browserContext.close();
      await removeUserDataDir(userDataDir);
    });
    it('should have custom URL when launching browser', async ({browserType, defaultBrowserOptions, server}) => {
      const userDataDir = await makeUserDataDir();
      const options = Object.assign({}, defaultBrowserOptions);
      options.args = [server.EMPTY_PAGE].concat(options.args || []);
      const browserContext = await browserType.launchPersistentContext(userDataDir, options);
      const pages = browserContext.pages();
      expect(pages.length).toBe(1);
      const page = pages[0];
      if (page.url() !== server.EMPTY_PAGE) {
        await page.waitForNavigation();
      }
      expect(page.url()).toBe(server.EMPTY_PAGE);
      await browserContext.close();
      await removeUserDataDir(userDataDir);
    });
  });

  describe('browserType.launchServer', function() {
    it('should return child_process instance', async ({browserType, defaultBrowserOptions}) => {
      const browserServer = await browserType.launchServer(defaultBrowserOptions);
      expect(browserServer.process().pid).toBeGreaterThan(0);
      await browserServer.close();
    });
    it('should fire close event', async ({browserType, defaultBrowserOptions}) => {
      const browserServer = await browserType.launchServer(defaultBrowserOptions);
      await Promise.all([
        new Promise(f => browserServer.on('close', f)),
        browserServer.close(),
      ]);
    });
  });

  describe('browserType.executablePath', function() {
    it('should work', async({browserType}) => {
      const executablePath = browserType.executablePath();
      expect(fs.existsSync(executablePath)).toBe(true);
      expect(fs.realpathSync(executablePath)).toBe(executablePath);
    });
  });

  describe('browserType.name', function() {
    it('should work', async({browserType}) => {
      if (WEBKIT)
        expect(browserType.name()).toBe('webkit');
      else if (FFOX)
        expect(browserType.name()).toBe('firefox');
      else if (CHROMIUM)
        expect(browserType.name()).toBe('chromium');
      else
        throw new Error('Unknown browser');
    });
  });
});

describe('Top-level requires', function() {
  it('should require top-level Errors', async() => {
    const Errors = require(path.join(utils.projectRoot(), '/lib/errors.js'));
    expect(Errors.TimeoutError).toBe(playwright.errors.TimeoutError);
  });
  it('should require top-level DeviceDescriptors', async() => {
    const Devices = require(path.join(utils.projectRoot(), '/lib/deviceDescriptors.js')).DeviceDescriptors;
    expect(Devices['iPhone 6']).toBeTruthy();
    expect(Devices['iPhone 6']).toBe(playwright.devices['iPhone 6']);
  });
});

describe('Browser.isConnected', () => {
  it('should set the browser connected state', async ({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    expect(remote.isConnected()).toBe(true);
    await remote.close();
    expect(remote.isConnected()).toBe(false);
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should throw when used after isConnected returns false', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    await Promise.all([
      browserServer.close(),
      new Promise(f => remote.once('disconnected', f)),
    ]);
    expect(remote.isConnected()).toBe(false);
    const error = await page.evaluate('1 + 1').catch(e => e);
    expect(error.message).toContain('has been closed');
  });
});

describe('Browser.disconnect', function() {
  it('should reject navigation when browser closes', async({browserType, defaultBrowserOptions, server}) => {
    server.setRoute('/one-style.css', () => {});
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
    await server.waitForRequest('/one-style.css');
    await remote.close();
    const error = await navigationPromise;
    expect(error.message).toContain('Navigation failed because browser has disconnected!');
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should reject waitForSelector when browser closes', async({browserType, defaultBrowserOptions, server}) => {
    server.setRoute('/empty.html', () => {});
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    const watchdog = page.waitForSelector('div', { timeout: 60000 }).catch(e => e);

    // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
    await page.waitForSelector('body');

    await remote.close();
    const error = await watchdog;
    expect(error.message).toContain('Protocol error');
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should throw if used after disconnect', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    await remote.close();
    const error = await page.evaluate('1 + 1').catch(e => e);
    expect(error.message).toContain('has been closed');
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should emit close events on pages and contexts', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const context = await remote.newContext();
    const page = await context.newPage();
    let pageClosed = false;
    page.on('close', e => pageClosed = true);
    await Promise.all([
      new Promise(f => context.on('close', f)),
      browserServer.close()
    ]);
    expect(pageClosed).toBeTruthy();
  });
});

describe('Browser.close', function() {
  it('should terminate network waiters', async({browserType, defaultBrowserOptions, server}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const newPage = await remote.newPage();
    const results = await Promise.all([
      newPage.waitForRequest(server.EMPTY_PAGE).catch(e => e),
      newPage.waitForResponse(server.EMPTY_PAGE).catch(e => e),
      browserServer.close()
    ]);
    for (let i = 0; i < 2; i++) {
      const message = results[i].message;
      expect(message).toContain('Target closed');
      expect(message).not.toContain('Timeout');
    }
  });
  it('should fire close event for all contexts', async({browserType, defaultBrowserOptions}) => {
    const browser = await browserType.launch(defaultBrowserOptions);
    const context = await browser.newContext();
    let closed = false;
    context.on('close', () => closed = true);
    await browser.close();
    expect(closed).toBe(true);
  });
});

describe('browserType.launch |webSocket| option', function() {
  it('should support the webSocket option', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const browserContext = await browser.newContext();
    expect(browserContext.pages().length).toBe(0);
    expect(browserServer.wsEndpoint()).not.toBe(null);
    const page = await browserContext.newPage();
    expect(await page.evaluate('11 * 11')).toBe(121);
    await page.close();
    await browser.close();
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should fire "disconnected" when closing with webSocket', async({browserType, defaultBrowserOptions}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
    const closedPromise = new Promise(f => browserServer.on('close', f));
    browserServer.kill();
    await Promise.all([
      disconnectedEventPromise,
      closedPromise,
    ]);
  });
});

describe('browserType.connect', function() {
  it.slow()('should be able to reconnect to a browser', async({browserType, defaultBrowserOptions, server}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    {
      const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await page.goto(server.EMPTY_PAGE);
      await browser.close();
    }
    {
      const browser = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await page.goto(server.EMPTY_PAGE);
      await browser.close();
    }
    await browserServer._checkLeaks();
    await browserServer.close();
  });
});

describe('browserType.launchPersistentContext', function() {
  it('userDataDir option', async({browserType, defaultBrowserOptions}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
    // Open a page to make sure its functional.
    await browserContext.newPage();
    expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
    await browserContext.close();
    expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
  });
  it.slow()('userDataDir option should restore state', async({browserType, defaultBrowserOptions, server}) => {
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
  // TODO: Flaky! See https://github.com/microsoft/playwright/pull/1795/checks?check_run_id=587685496
  it.slow().fail(WIN && CHROMIUM)('userDataDir option should restore cookies', async({browserType, defaultBrowserOptions,  server}) => {
    const userDataDir = await makeUserDataDir();
    const browserContext = await browserType.launchPersistentContext(userDataDir, defaultBrowserOptions);
    const page = await browserContext.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(() => document.cookie = 'doSomethingOnlyOnce=true; expires=Fri, 31 Dec 9999 23:59:59 GMT');
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
    expect(await page3.evaluate(() => localStorage.hey)).not.toBe('doSomethingOnlyOnce=true');
    await browserContext3.close();

    // This might throw. See https://github.com/GoogleChrome/puppeteer/issues/2778
    await removeUserDataDir(userDataDir);
    await removeUserDataDir(userDataDir2);
  });
});

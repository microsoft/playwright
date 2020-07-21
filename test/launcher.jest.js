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
const {FFOX, CHROMIUM, WEBKIT, WIN, USES_HOOKS, CHANNEL} = testOptions;

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
    it.skip(FFOX)('should throw if page argument is passed', async({browserType, defaultBrowserOptions}) => {
      let waitError = null;
      const options = Object.assign({}, defaultBrowserOptions, { args: ['http://example.com'] });
      await browserType.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('can not specify page');
    });
    it.fail(true)('should reject if launched browser fails immediately', async({browserType, defaultBrowserOptions}) => {
      // I'm getting ENCONRESET on this one.
      const options = Object.assign({}, defaultBrowserOptions, {executablePath: path.join(__dirname, 'assets', 'dummy_bad_browser_executable.js')});
      let waitError = null;
      await browserType.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('== logs ==');
    });
    it('should reject if executable path is invalid', async({browserType, defaultBrowserOptions}) => {
      let waitError = null;
      const options = Object.assign({}, defaultBrowserOptions, {executablePath: 'random-invalid-path'});
      await browserType.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('Failed to launch');
    });
    it.skip(USES_HOOKS)('should handle timeout', async({browserType, defaultBrowserOptions}) => {
      const options = { ...defaultBrowserOptions, timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
      const error = await browserType.launch(options).catch(e => e);
      expect(error.message).toContain(`browserType.launch: Timeout 5000ms exceeded.`);
      expect(error.message).toContain(`[browser] <launching>`);
      expect(error.message).toContain(`[browser] <launched> pid=`);
    });
    it.skip(USES_HOOKS)('should handle exception', async({browserType, defaultBrowserOptions}) => {
      const e = new Error('Dummy');
      const options = { ...defaultBrowserOptions, __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
      const error = await browserType.launch(options).catch(e => e);
      expect(error.message).toContain('Dummy');
    });
    it.skip(USES_HOOKS)('should report launch log', async({browserType, defaultBrowserOptions}) => {
      const e = new Error('Dummy');
      const options = { ...defaultBrowserOptions, __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
      const error = await browserType.launch(options).catch(e => e);
      expect(error.message).toContain('<launching>');
    });
    it.slow()('should accept objects as options', async({browserType, defaultBrowserOptions}) => {
      const browser = await browserType.launch({ ...defaultBrowserOptions, process });
      await browser.close();
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
  it('should require top-level Errors', async({playwright}) => {
    const Errors = require(path.join(utils.projectRoot(), '/lib/errors.js'));
    expect(String(Errors.TimeoutError)).toContain('TimeoutError');
  });
  it('should require top-level DeviceDescriptors', async({playwright}) => {
    const Devices = require(path.join(utils.projectRoot(), '/lib/deviceDescriptors.js')).DeviceDescriptors;
    expect(Devices['iPhone 6']).toBeTruthy();
    expect(Devices['iPhone 6']).toEqual(playwright.devices['iPhone 6']);
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
    expect(error.message).toContain('Navigation failed because page was closed!');
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should reject waitForSelector when browser closes', async({browserType, defaultBrowserOptions, server}) => {
    server.setRoute('/empty.html', () => {});
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const remote = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    const watchdog = page.waitForSelector('div', { state: 'attached', timeout: 60000 }).catch(e => e);

    // Make sure the previous waitForSelector has time to make it to the browser before we disconnect.
    await page.waitForSelector('body', { state: 'attached' });

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
      expect(message).toContain('Page closed');
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
  it('should be callable twice', async({browserType, defaultBrowserOptions}) => {
    const browser = await browserType.launch(defaultBrowserOptions);
    await Promise.all([
      browser.close(),
      browser.close(),
    ]);
    await browser.close();
  });
});

describe('browserType.launchServer', function() {
  it('should work', async({browserType, defaultBrowserOptions}) => {
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
  it('should fire "disconnected" when closing the server', async({browserType, defaultBrowserOptions}) => {
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
  it('should fire "close" event during kill', async({browserType, defaultBrowserOptions}) => {
    const order = [];
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const closedPromise = new Promise(f => browserServer.on('close', () => {
      order.push('closed');
      f();
    }));
    await Promise.all([
      browserServer.kill().then(() => order.push('killed')),
      closedPromise,
    ]);
    expect(order).toEqual(['closed', 'killed']);
  });
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
  it.fail(USES_HOOKS || (CHROMIUM && WIN)).slow()('should handle exceptions during connect', async({browserType, defaultBrowserOptions, server}) => {
    const browserServer = await browserType.launchServer(defaultBrowserOptions);
    const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy') };
    const error = await browserType.connect({ wsEndpoint: browserServer.wsEndpoint(), __testHookBeforeCreateBrowser }).catch(e => e);
    await browserServer._checkLeaks();
    await browserServer.close();
    expect(error.message).toContain('Dummy');
  });
});

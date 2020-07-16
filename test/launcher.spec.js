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
const {WIN, LINUX, MAC, HEADLESS, USES_HOOKS} = utils = require('./utils');
const {FIREFOX, CHROMIUM, WEBKIT, launchEnv} = require('playwright-runner');
const {serverEnv} = require('./environments/server');
const {it} = launchEnv.mixin(serverEnv);

describe('Playwright', function() {
  describe('browserType.launch', function() {
    it('should reject all promises when browser is closed', async ({launcher}) => {
      const browser = await launcher.launch();
      const page = await (await browser.newContext()).newPage();
      let error = null;
      const neverResolves = page.evaluate(() => new Promise(r => {})).catch(e => error = e);
      await page.evaluate(() => new Promise(f => setTimeout(f, 0)));
      await browser.close();
      await neverResolves;
      expect(error.message).toContain('Protocol error');
    });
    it('should throw if userDataDir option is passed', async ({launcher}) => {
      let waitError = null;
      const options = {userDataDir: 'random-path'};
      await launcher.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('launchPersistentContext');
    });
    it.skip(FIREFOX)('should throw if page argument is passed', async ({launcher}) => {
      let waitError = null;
      const options = { args: ['http://example.com'] };
      await launcher.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('can not specify page');
    });
    it('should reject if executable path is invalid', async ({launcher}) => {
      let waitError = null;
      const options = {executablePath: 'random-invalid-path'};
      await launcher.launch(options).catch(e => waitError = e);
      expect(waitError.message).toContain('Failed to launch');
    });
    it.skip(USES_HOOKS)('should handle timeout', async ({launcher}) => {
      const options = { timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
      const error = await launcher.launch(options).catch(e => e);
      expect(error.message).toContain(`Timeout 5000ms exceeded during browserType.launch.`);
      expect(error.message).toContain(`[browser] <launching>`);
      expect(error.message).toContain(`[browser] <launched> pid=`);
    });
    it.skip(USES_HOOKS)('should handle exception', async ({launcher}) => {
      const e = new Error('Dummy');
      const options = { __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
      const error = await launcher.launch(options).catch(e => e);
      expect(error).toBe(e);
    });
    it.skip(USES_HOOKS)('should report launch log', async ({launcher}) => {
      const e = new Error('Dummy');
      const options = { __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
      const error = await launcher.launch(options).catch(e => e);
      expect(error.message).toContain('<launching>');
    });
  });

  describe('browserType.launchServer', function() {
    it('should return child_process instance', async ({launcher}) => {
      const browserServer = await launcher.launchServer();
      expect(browserServer.process().pid).toBeGreaterThan(0);
      await browserServer.close();
    });
    it('should fire close event', async ({launcher}) => {
      const browserServer = await launcher.launchServer();
      await Promise.all([
        new Promise(f => browserServer.on('close', f)),
        browserServer.close(),
      ]);
    });
  });

  describe('browserType.executablePath', function() {
    it('should work', async ({launcher}) => {
      const executablePath = launcher.executablePath();
      expect(fs.existsSync(executablePath)).toBe(true);
      expect(fs.realpathSync(executablePath)).toBe(executablePath);
    });
  });

  describe('browserType.name', function() {
    it('should work', async ({launcher}) => {
      if (WEBKIT)
        expect(launcher.name()).toBe('webkit');
      else if (FIREFOX)
        expect(launcher.name()).toBe('firefox');
      else if (CHROMIUM)
        expect(launcher.name()).toBe('chromium');
      else
        throw new Error('Unknown browser');
    });
  });
});

describe('Browser.isConnected', () => {
  it('should set the browser connected state', async ({launcher}) => {
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
    expect(remote.isConnected()).toBe(true);
    await remote.close();
    expect(remote.isConnected()).toBe(false);
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should throw when used after isConnected returns false', async ({launcher}) => {
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
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
  it('should reject navigation when browser closes', async ({launcher, server}) => {
    server.setRoute('/one-style.css', () => {});
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    const navigationPromise = page.goto(server.PREFIX + '/one-style.html', {timeout: 60000}).catch(e => e);
    await server.waitForRequest('/one-style.css');
    await remote.close();
    const error = await navigationPromise;
    expect(error.message).toContain('Navigation failed because page was closed!');
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should reject waitForSelector when browser closes', async ({launcher, server}) => {
    server.setRoute('/empty.html', () => {});
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
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
  it('should throw if used after disconnect', async ({launcher}) => {
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const page = await remote.newPage();
    await remote.close();
    const error = await page.evaluate('1 + 1').catch(e => e);
    expect(error.message).toContain('has been closed');
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it('should emit close events on pages and contexts', async ({launcher}) => {
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
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
  it('should terminate network waiters', async ({launcher, server}) => {
    const browserServer = await launcher.launchServer();
    const remote = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
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
  it('should fire close event for all contexts', async ({launcher}) => {
    const browser = await launcher.launch();
    const context = await browser.newContext();
    let closed = false;
    context.on('close', () => closed = true);
    await browser.close();
    expect(closed).toBe(true);
  });
  it('should be callable twice', async ({launcher}) => {
    const browser = await launcher.launch();
    await Promise.all([
      browser.close(),
      browser.close(),
    ]);
    await browser.close();
  });
});

describe('browserType.launchServer', function() {
  it('should work', async ({launcher}) => {
    const browserServer = await launcher.launchServer();
    const browser = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
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
  it('should fire "disconnected" when closing the server', async ({launcher}) => {
    const browserServer = await launcher.launchServer();
    const browser = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
    const disconnectedEventPromise = new Promise(resolve => browser.once('disconnected', resolve));
    const closedPromise = new Promise(f => browserServer.on('close', f));
    browserServer.kill();
    await Promise.all([
      disconnectedEventPromise,
      closedPromise,
    ]);
  });
  it('should fire "close" event during kill', async ({launcher}) => {
    const order = [];
    const browserServer = await launcher.launchServer();
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
});

describe('launcher.connect', function() {
  it.slow('should be able to reconnect to a browser', async ({launcher, server}) => {
    const browserServer = await launcher.launchServer();
    {
      const browser = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await page.goto(server.EMPTY_PAGE);
      await browser.close();
    }
    {
      const browser = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint() });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      await page.goto(server.EMPTY_PAGE);
      await browser.close();
    }
    await browserServer._checkLeaks();
    await browserServer.close();
  });
  it.skip(USES_HOOKS).slow('should handle exceptions during connect', async ({launcher, server}) => {
    const browserServer = await launcher.launchServer();
    const __testHookBeforeCreateBrowser = () => { throw new Error('Dummy'); };
    const error = await launcher.connect({ wsEndpoint: browserServer.wsEndpoint(), __testHookBeforeCreateBrowser }).catch(e => e);
    await browserServer._checkLeaks();
    await browserServer.close();
    expect(error.message).toContain('Dummy');
  });
});

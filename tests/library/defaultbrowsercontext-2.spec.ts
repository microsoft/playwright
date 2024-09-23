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

import { playwrightTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import path from 'path';

it('should support hasTouch option', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ hasTouch: true });
  await page.goto(server.PREFIX + '/mobile.html');
  expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
});

it('should work in persistent context', async ({ server, launchPersistent, browserName }) => {
  it.skip(browserName === 'firefox', 'Firefox does not support mobile');

  const { page } = await launchPersistent({ viewport: { width: 320, height: 480 }, isMobile: true });
  await page.goto(server.PREFIX + '/empty.html');
  expect(await page.evaluate(() => window.innerWidth)).toBe(980);
});

it('should support colorScheme option', async ({ launchPersistent }) => {
  const { page } = await launchPersistent({ colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
});

it('should support reducedMotion option', async ({ launchPersistent }) => {
  const { page } = await launchPersistent({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: no-preference)').matches)).toBe(false);
});

it('should support forcedColors option', async ({ launchPersistent, browserName }) => {
  const { page } = await launchPersistent({ forcedColors: 'active' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(forced-colors: none)').matches)).toBe(false);
});

it('should support timezoneId option', async ({ launchPersistent, browserName }) => {
  const { page } = await launchPersistent({ locale: 'en-US', timezoneId: 'America/Jamaica' });
  expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');
});

it('should support locale option', async ({ launchPersistent }) => {
  const { page } = await launchPersistent({ locale: 'fr-FR' });
  expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
});

it('should support geolocation and permissions options', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ geolocation: { longitude: 10, latitude: 10 }, permissions: ['geolocation'] });
  await page.goto(server.EMPTY_PAGE);
  const geolocation = await page.evaluate(() => new Promise(resolve => navigator.geolocation.getCurrentPosition(position => {
    resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude });
  })));
  expect(geolocation).toEqual({ latitude: 10, longitude: 10 });
});

it('should support ignoreHTTPSErrors option', async ({ httpsServer, launchPersistent }) => {
  const { page } = await launchPersistent({ ignoreHTTPSErrors: true });
  let error = null;
  const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
  expect(error).toBe(null);
  expect(response.ok()).toBe(true);
});

it('should support extraHTTPHeaders option', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ extraHTTPHeaders: { foo: 'bar' } });
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect(request.headers['foo']).toBe('bar');
});

it('should accept userDataDir', async ({ createUserDataDir, browserType }) => {
  const userDataDir = await createUserDataDir();
  const context = await browserType.launchPersistentContext(userDataDir);
  expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
  await context.close();
  expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
});

it('should restore state from userDataDir', async ({ browserType, server, createUserDataDir, isMac, browserName }) => {
  it.slow();

  const userDataDir = await createUserDataDir();
  const browserContext = await browserType.launchPersistentContext(userDataDir);
  const page = await browserContext.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => localStorage.hey = 'hello');
  await browserContext.close();

  const browserContext2 = await browserType.launchPersistentContext(userDataDir);
  const page2 = await browserContext2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(() => localStorage.hey)).toBe('hello');
  await browserContext2.close();

  const userDataDir2 = await createUserDataDir();
  const browserContext3 = await browserType.launchPersistentContext(userDataDir2);
  const page3 = await browserContext3.newPage();
  await page3.goto(server.EMPTY_PAGE);
  expect(await page3.evaluate(() => localStorage.hey)).not.toBe('hello');
  await browserContext3.close();
});

it('should create userDataDir if it does not exist', async ({ createUserDataDir, browserType }) => {
  const userDataDir = path.join(await createUserDataDir(), 'nonexisting');
  const context = await browserType.launchPersistentContext(userDataDir);
  await context.close();
  expect(fs.readdirSync(userDataDir).length).toBeGreaterThan(0);
});

it('should have default URL when launching browser', async ({ launchPersistent }) => {
  const { context } = await launchPersistent();
  const urls = context.pages().map(page => page.url());
  expect(urls).toEqual(['about:blank']);
});

it('should throw if page argument is passed', async ({ browserType, server, createUserDataDir, browserName }) => {
  it.skip(browserName === 'firefox');

  const options = { args: [server.EMPTY_PAGE] };
  const error = await browserType.launchPersistentContext(await createUserDataDir(), options).catch(e => e);
  expect(error.message).toContain('can not specify page');
});

it('should have passed URL when launching with ignoreDefaultArgs: true', async ({ browserType, server, createUserDataDir, toImpl, mode, browserName }) => {
  it.skip(mode !== 'default');

  const userDataDir = await createUserDataDir();
  const args = toImpl(browserType).defaultArgs((browserType as any)._defaultLaunchOptions, 'persistent', userDataDir, 0).filter(a => a !== 'about:blank');
  const options = {
    args: browserName === 'firefox' ? [...args, '-new-tab', server.EMPTY_PAGE] : [...args, server.EMPTY_PAGE],
    ignoreDefaultArgs: true,
  };
  const browserContext = await browserType.launchPersistentContext(userDataDir, options);
  if (!browserContext.pages().length)
    await browserContext.waitForEvent('page');
  await browserContext.pages()[0].waitForLoadState();
  const gotUrls = browserContext.pages().map(page => page.url());
  expect(gotUrls).toEqual([server.EMPTY_PAGE]);
  await browserContext.close();
});

it('should handle timeout', async ({ browserType, createUserDataDir, mode }) => {
  it.skip(mode !== 'default');

  const options: any = { timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
  const error = await browserType.launchPersistentContext(await createUserDataDir(), options).catch(e => e);
  expect(error.message).toContain(`browserType.launchPersistentContext: Timeout 5000ms exceeded.`);
});

it('should handle exception', async ({ browserType, createUserDataDir, mode }) => {
  it.skip(mode !== 'default');

  const e = new Error('Dummy');
  const options: any = { __testHookBeforeCreateBrowser: () => { throw e; } };
  const error = await browserType.launchPersistentContext(await createUserDataDir(), options).catch(e => e);
  expect(error.message).toContain('Dummy');
});

it('should fire close event for a persistent context', async ({ launchPersistent }) => {
  const { context } = await launchPersistent();
  let closed = false;
  context.on('close', () => closed = true);
  await context.close();
  expect(closed).toBe(true);
});

it('coverage should work', async ({ server, launchPersistent, browserName }) => {
  it.skip(browserName !== 'chromium');

  const { page } = await launchPersistent();
  await page.coverage.startJSCoverage();
  await page.goto(server.PREFIX + '/jscoverage/simple.html', { waitUntil: 'load' });
  const coverage = await page.coverage.stopJSCoverage();
  expect(coverage.length).toBe(1);
  expect(coverage[0].url).toContain('/jscoverage/simple.html');
  expect(coverage[0].functions.find(f => f.functionName === 'foo').ranges[0].count).toEqual(1);
});

it('should respect selectors', async ({ playwright, launchPersistent }) => {
  const { page } = await launchPersistent();

  const defaultContextCSS = () => ({
    query(root, selector) {
      return root.querySelector(selector);
    },
    queryAll(root: HTMLElement, selector: string) {
      return Array.from(root.querySelectorAll(selector));
    }
  });
  await playwright.selectors.register('defaultContextCSS', defaultContextCSS);

  await page.setContent(`<div>hello</div>`);
  expect(await page.innerHTML('css=div')).toBe('hello');
  expect(await page.innerHTML('defaultContextCSS=div')).toBe('hello');
});

it('should connect to a browser with the default page', async ({ browserType, createUserDataDir, mode }) => {
  it.skip(mode !== 'default');

  const options: any = { __testHookOnConnectToBrowser: () => new Promise(f => setTimeout(f, 3000)) };
  const context = await browserType.launchPersistentContext(await createUserDataDir(), options);
  expect(context.pages().length).toBe(1);
  await context.close();
});

it('should support har option', async ({ launchPersistent, asset }) => {
  const path = asset('har-fulfill.har');
  const { page } = await launchPersistent();
  await page.routeFromHAR(path);
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  // HAR contains a POST for the css file that should not be used.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

it('user agent is up to date', async ({ launchPersistent, browser, mode }) => {
  it.skip(mode !== 'default');
  const { userAgent } = await (browser as any)._channel.defaultUserAgentForTest();
  const { context, page } = await launchPersistent();
  expect(await page.evaluate(() => navigator.userAgent)).toBe(userAgent);
  await context.close();
});

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

import { browserTest as it, expect } from '../config/browserTest';

it('should have url', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [otherPage] = await Promise.all([
    context.waitForEvent('page'),
    page.evaluate(url => window.open(url), server.EMPTY_PAGE)
  ]);
  expect(otherPage.url()).toBe(server.EMPTY_PAGE);
  await context.close();
});

it('should have url after domcontentloaded', async ({ browser, server }) => {
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

it('should have about:blank url with domcontentloaded', async ({ browser, server }) => {
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

it('should have about:blank for empty url with domcontentloaded', async ({ browser, server }) => {
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

it('should report when a new page is created and closed', async ({ browser, server }) => {
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

it('should report initialized pages', async ({ browser, server }) => {
  const context = await browser.newContext();
  const pagePromise = context.waitForEvent('page');
  void context.newPage();
  const newPage = await pagePromise;
  expect(newPage.url()).toBe('about:blank');

  const popupPromise = context.waitForEvent('page');
  const evaluatePromise = newPage.evaluate(() => window.open('about:blank'));
  const popup = await popupPromise;
  expect(popup.url()).toBe('about:blank');
  await evaluatePromise;
  await context.close();
});

it('should not crash while redirecting of original request was missed', async ({ browser, server }) => {
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

it('should have an opener', async ({ browser, server }) => {
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

it('should fire page lifecycle events', async function({ browser, server }) {
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

it('should work with Shift-clicking', async ({ browser, server, browserName }) => {
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

it('should work with Ctrl-clicking', async ({ browser, server, browserName }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.click('a', { modifiers: ['ControlOrMeta'] }),
  ]);
  expect(await popup.opener()).toBe(browserName === 'firefox' ? page : null);
  await context.close();
});

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

import { test as it, expect } from './pageTest';
import type { Route } from 'playwright-core';

it('should pick up ongoing navigation', async ({ page, server }) => {
  let response = null;
  server.setRoute('/one-style.css', (req, res) => response = res);
  await Promise.all([
    server.waitForRequest('/one-style.css'),
    page.goto(server.PREFIX + '/one-style.html', { waitUntil: 'domcontentloaded' }),
  ]);
  const waitPromise = page.waitForLoadState();
  response.statusCode = 404;
  response.end('Not found');
  await waitPromise;
});

it('should respect timeout', async ({ page, server }) => {
  server.setRoute('/one-style.css', (req, res) => void 0);
  await page.goto(server.PREFIX + '/one-style.html', { waitUntil: 'domcontentloaded' });
  const error = await page.waitForLoadState('load', { timeout: 1 }).catch(e => e);
  expect(error.message).toContain('page.waitForLoadState: Timeout 1ms exceeded.');
  expect(error.stack.split('\n')[1]).toContain(__filename);
});

it('should resolve immediately if loaded', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/one-style.html');
  await page.waitForLoadState();
});

it('should throw for bad state', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/one-style.html');
  // @ts-expect-error 'bad' is not a valid load state
  const error = await page.waitForLoadState('bad').catch(e => e);
  expect(error.message).toContain(`state: expected one of (load|domcontentloaded|networkidle|commit)`);
});

it('should resolve immediately if load state matches', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/one-style.css', (req, res) => void 0);
  await page.goto(server.PREFIX + '/one-style.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
});

it('should work with pages that have loaded before being connected to', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window['_popup'] = window.open(document.location.href)),
  ]);
  // The url is about:blank in FF.
  // expect(popup.url()).toBe(server.EMPTY_PAGE);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(server.EMPTY_PAGE);
});

it('should wait for load state of empty url popup', async ({ page, browserName }) => {
  const [popup, readyState] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => {
      const popup = window.open('');
      return popup.document.readyState;
    }),
  ]);
  await popup.waitForLoadState();
  expect(readyState).toBe(browserName === 'firefox' ? 'uninitialized' : 'complete');
  expect(await popup.evaluate(() => document.readyState)).toBe(browserName === 'firefox' ? 'uninitialized' : 'complete');
});

it('should wait for load state of about:blank popup ', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('about:blank') && 1),
  ]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => document.readyState)).toBe('complete');
});

it('should wait for load state of about:blank popup with noopener ', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('about:blank', null, 'noopener') && 1),
  ]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => document.readyState)).toBe('complete');
});

it('should wait for load state of popup with network url ', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url) && 1, server.EMPTY_PAGE),
  ]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => document.readyState)).toBe('complete');
});

it('should wait for load state of popup with network url and noopener ', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url, null, 'noopener') && 1, server.EMPTY_PAGE),
  ]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => document.readyState)).toBe('complete');
});

it('should work with clicking target=_blank', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel="opener" href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  await popup.waitForLoadState();
  expect(await popup.evaluate(() => document.readyState)).toBe('complete');
});

it('should wait for load state of newPage', async ({ page, isElectron }) => {
  it.fixme(isElectron, 'BrowserContext.newPage does not work in Electron');

  const [newPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.context().newPage(),
  ]);
  await newPage.waitForLoadState();
  expect(await newPage.evaluate(() => document.readyState)).toBe('complete');
});

it('should resolve after popup load', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  // Stall the 'load' by delaying css.
  let cssResponse;
  server.setRoute('/one-style.css', (req, res) => cssResponse = res);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    server.waitForRequest('/one-style.css'),
    page.evaluate(url => window['popup'] = window.open(url), server.PREFIX + '/one-style.html'),
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
});

it('should work for frame', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.frames()[1];

  const requestPromise = new Promise<Route>(resolve => page.route(server.PREFIX + '/one-style.css', resolve));
  await frame.goto(server.PREFIX + '/one-style.html', { waitUntil: 'domcontentloaded' });
  const request = await requestPromise;
  let resolved = false;
  const loadPromise = frame.waitForLoadState().then(() => resolved = true);
  // give the promise a chance to resolve, even though it shouldn't
  await page.evaluate('1');
  expect(resolved).toBe(false);
  await request.continue();
  await loadPromise;
});

it('should work with javascript: iframe', async ({ page, server, browserName }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<iframe src="javascript:false"></iframe>`, { waitUntil: 'commit' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');
});

it('should work with broken data-url iframe', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<iframe src="data:text/html"></iframe>`, { waitUntil: 'commit' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');
});

it('should work with broken blob-url iframe', async ({ page, server, browserName }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<iframe src="blob:"></iframe>`, { waitUntil: 'commit' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle');
});

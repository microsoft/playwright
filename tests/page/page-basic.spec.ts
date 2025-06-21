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

import { test as it, expect } from './pageTest';

it('should fire load when expected', async ({ page }) => {
  await Promise.all([
    page.goto('about:blank'),
    page.waitForEvent('load'),
  ]);
});

it('async stacks should work', async ({ page, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    req.socket.end();
  });
  let error = null;
  await page.goto(server.EMPTY_PAGE).catch(e => error = e);
  expect(error).not.toBe(null);
  expect(error.stack).toContain(__filename);
});

it('should provide access to the opener page', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('about:blank')),
  ]);
  const opener = await popup.opener();
  expect(opener).toBe(page);
});

it('should fire domcontentloaded when expected', async ({ page }) => {
  const navigatedPromise = page.goto('about:blank');
  await page.waitForEvent('domcontentloaded');
  await navigatedPromise;
});

it('should pass self as argument to domcontentloaded event', async ({ page }) => {
  const [eventArg] = await Promise.all([
    new Promise(f => page.on('domcontentloaded', f)),
    page.goto('about:blank')
  ]);
  expect(eventArg).toBe(page);
});

it('should pass self as argument to load event', async ({ page }) => {
  const [eventArg] = await Promise.all([
    new Promise(f => page.on('load', f)),
    page.goto('about:blank')
  ]);
  expect(eventArg).toBe(page);
});

it('page.url should work', async ({ page, server }) => {
  expect(page.url()).toBe('about:blank');
  await page.goto(server.EMPTY_PAGE);
  expect(page.url()).toBe(server.EMPTY_PAGE);
});

it('page.url should include hashes', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE + '#hash');
  expect(page.url()).toBe(server.EMPTY_PAGE + '#hash');
  await page.evaluate(() => {
    window.location.hash = 'dynamic';
  });
  expect(page.url()).toBe(server.EMPTY_PAGE + '#dynamic');
});

it('page.title should return the page title', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/title.html');
  expect(await page.title()).toBe('Woof-Woof');
});

it('page.close should work with window.close', async function({ page }) {
  const newPagePromise = page.waitForEvent('popup');
  await page.evaluate(() => window['newPage'] = window.open('about:blank'));
  const newPage = await newPagePromise;
  const closedPromise = new Promise(x => newPage.on('close', x));
  await page.evaluate(() => window['newPage'].close());
  await closedPromise;
});

it('page.frame should respect name', async function({ page }) {
  await page.setContent(`<iframe name=target></iframe>`);
  expect(page.frame({ name: 'bogus' })).toBe(null);
  const frame = page.frame({ name: 'target' });
  expect(frame).toBeTruthy();
  expect(frame === page.mainFrame().childFrames()[0]).toBeTruthy();
});

it('page.frame should respect url', async function({ page, server }) {
  await page.setContent(`<iframe src="${server.EMPTY_PAGE}"></iframe>`);
  expect(page.frame({ url: /bogus/ })).toBe(null);
  expect(page.frame({ url: /empty/ }).url()).toBe(server.EMPTY_PAGE);
});

it('should have sane user agent', async ({ page, browserName, isElectron, isAndroid }) => {
  it.skip(isAndroid);
  it.skip(isElectron);

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const [
    part1,
    /* part2 */,
    part3,
    part4,
    part5,
  ] = userAgent.split(/[()]/).map(part => part.trim());
  // First part is always "Mozilla/5.0"
  expect(part1).toBe('Mozilla/5.0');
  // Second part in parenthesis is platform - ignore it.

  // Third part for Firefox is the last one and encodes engine and browser versions.
  if (browserName === 'firefox') {
    const [engine, browser] = part3.split(' ');
    expect(engine.startsWith('Gecko')).toBe(true);
    expect(browser.startsWith('Firefox')).toBe(true);
    expect(part4).toBe(undefined);
    expect(part5).toBe(undefined);
    return;
  }
  // For both options.CHROMIUM and options.WEBKIT, third part is the AppleWebKit version.
  expect(part3.startsWith('AppleWebKit/')).toBe(true);
  expect(part4).toBe('KHTML, like Gecko');
  // 5th part encodes real browser name and engine version.
  const [engine, browser] = part5.split(' ');
  expect(browser.startsWith('Safari/')).toBe(true);
  if (browserName === 'chromium')
    expect(engine.includes('Chrome/')).toBe(true);
  else
    expect(engine.startsWith('Version/')).toBe(true);
});

it('page.press should work', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/textarea.html');
  await page.press('textarea', 'a');
  expect(await page.evaluate(() => document.querySelector('textarea').value)).toBe('a');
});

it('page.press should work for Enter', async ({ page }) => {
  await page.setContent(`<input onkeypress="console.log('press')"></input>`);
  const messages = [];
  page.on('console', message => messages.push(message));
  await page.press('input', 'Enter');
  expect(messages[0].text()).toBe('press');
});

it('frame.press should work', async ({ page, server }) => {
  await page.setContent(`<iframe name=inner src="${server.PREFIX}/input/textarea.html"></iframe>`);
  const frame = page.frame('inner');
  await frame.press('textarea', 'a');
  expect(await frame.evaluate(() => document.querySelector('textarea').value)).toBe('a');
});

it('has navigator.webdriver set to true', async ({ page }) => {
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
});

it('should iterate over page properties', async ({ page }) => {
  const props = [];
  for (const prop in page) {
    if (page[prop] && typeof page[prop] === 'object')
      props.push(page[prop][Symbol.iterator]);
  }
});

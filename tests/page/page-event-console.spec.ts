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
import util from 'util';

it('should work @smoke', async ({ page, browserName }) => {
  let message = null;
  page.once('console', m => message = m);
  await Promise.all([
    page.evaluate(() => console.log('hello', 5, { foo: 'bar' })),
    page.waitForEvent('console')
  ]);
  if (browserName !== 'firefox')
    expect(message.text()).toEqual('hello 5 {foo: bar}');
  else
    expect(message.text()).toEqual('hello 5 JSHandle@object');
  expect(message.type()).toEqual('log');
  expect(await message.args()[0].jsonValue()).toEqual('hello');
  expect(await message.args()[1].jsonValue()).toEqual(5);
  expect(await message.args()[2].jsonValue()).toEqual({ foo: 'bar' });
});

it('should emit same log twice', async ({ page }) => {
  const messages = [];
  page.on('console', m => messages.push(m.text()));
  await page.evaluate(() => {
    for (let i = 0; i < 2; ++i)
      console.log('hello');
  });
  expect(messages).toEqual(['hello', 'hello']);
});

it('should use text() for inspection', async ({ page }) => {
  let text;
  const inspect = value => {
    text = util.inspect(value);
  };
  page.on('console', inspect);
  await page.evaluate(() => console.log('Hello world'));
  expect(text).toEqual('Hello world');
});

it('should work for different console API calls', async ({ page }) => {
  const messages = [];
  page.on('console', msg => messages.push(msg));
  // All console events will be reported before `page.evaluate` is finished.
  await page.evaluate(() => {
    // A pair of time/timeEnd generates only one Console API call.
    console.time('calling console.time');
    console.timeEnd('calling console.time');
    console.trace('calling console.trace');
    console.dir('calling console.dir');
    console.warn('calling console.warn');
    console.error('calling console.error');
    console.info('calling console.info');
    console.debug('calling console.debug');
    console.log(Promise.resolve('should not wait until resolved!'));
  });
  // WebKit uses console.debug() to report binding calls, make sure they don't get reported.
  await page.exposeBinding('foobar', async (_, value) => page.evaluate(value => console.log(value), value));
  await page.evaluate(() => window['foobar']('Using bindings'));

  expect(messages.map(msg => msg.type())).toEqual([
    'timeEnd', 'trace', 'dir', 'warning', 'error', 'info', 'debug', 'log', 'log'
  ]);
  expect(messages[0].text()).toContain('calling console.time');
  expect(messages.slice(1).map(msg => msg.text())).toEqual([
    'calling console.trace',
    'calling console.dir',
    'calling console.warn',
    'calling console.error',
    'calling console.info',
    'calling console.debug',
    'Promise',
    'Using bindings',
  ]);
});

it('should format the message correctly with time/timeLog/timeEnd', async ({ page, browserName }) => {
  it.fixme(browserName === 'firefox', 'https://github.com/microsoft/playwright/issues/10580');
  const messages = [];
  page.on('console', msg => messages.push(msg));
  await page.evaluate(async () => {
    console.time('foo time');
    await new Promise(x => window.builtins.setTimeout(x, 100));
    console.timeLog('foo time');
    await new Promise(x => window.builtins.setTimeout(x, 100));
    console.timeEnd('foo time');
  });
  expect(messages.length).toBe(2);
  if (browserName === 'webkit')
    expect(messages[0].type()).toBe('timeEnd');
  else if (browserName === 'chromium')
    expect(messages[0].type()).toBe('log');
  expect(messages[1].type()).toBe('timeEnd');

  // WebKit has a space before the unit: https://bugs.webkit.org/show_bug.cgi?id=233556
  expect(messages[0].text()).toMatch(/foo time: \d+.\d+ ?ms/);
  expect(messages[1].text()).toMatch(/foo time: \d+.\d+ ?ms/);
});

it('should not fail for window object', async ({ page, browserName }) => {
  let message = null;
  page.once('console', msg => message = msg);
  await Promise.all([
    page.evaluate(() => console.error(window)),
    page.waitForEvent('console')
  ]);
  if (browserName !== 'firefox')
    expect(message.text()).toEqual('Window');
  else
    expect(message.text()).toEqual('JSHandle@object');
});

it('should trigger correct Log', async ({ page, server, browserName, isWindows }) => {
  it.skip(browserName === 'webkit' && isWindows, 'Upstream issue https://bugs.webkit.org/show_bug.cgi?id=229515');
  await page.goto('about:blank');
  const [message] = await Promise.all([
    page.waitForEvent('console'),
    page.evaluate(async url => fetch(url).catch(e => {}), server.EMPTY_PAGE)
  ]);
  expect(message.text()).toContain('Access-Control-Allow-Origin');
  expect(message.type()).toEqual('error');
});

it('should have location for console API calls', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [message] = await Promise.all([
    page.waitForEvent('console', m => m.text().startsWith('here:')),
    page.goto(server.PREFIX + '/consolelog.html'),
  ]);
  expect(message.type()).toBe('log');
  const location = message.location();
  // Engines have different column notion.
  delete location.columnNumber;
  expect(location).toEqual({
    url: server.PREFIX + '/consolelog.html',
    lineNumber: 7,
  });
});

it('should not throw when there are console messages in detached iframes', async ({ page, server }) => {
  // @see https://github.com/GoogleChrome/puppeteer/issues/3865
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(async () => {
      // 1. Create a popup that Playwright is not connected to.
      const win = window.open('');
      window['_popup'] = win;
      if (window.document.readyState !== 'complete')
        await new Promise(f => window.addEventListener('load', f));
      // 2. In this popup, create an iframe that console.logs a message.
      win.document.body.innerHTML = `<iframe src='/consolelog.html'></iframe>`;
      const frame = win.document.querySelector('iframe');
      if (!frame.contentDocument || frame.contentDocument.readyState !== 'complete')
        await new Promise(f => frame.addEventListener('load', f));
      // 3. After that, remove the iframe.
      frame.remove();
    }),
  ]);
  // 4. Connect to the popup and make sure it doesn't throw.
  expect(await popup.evaluate('1 + 1')).toBe(2);
});

it('should use object previews for arrays and objects', async ({ page, browserName }) => {
  let text: string;
  page.on('console', message => {
    text = message.text();
  });
  await page.evaluate(() => console.log([1, 2, 3], { a: 1 }, window));

  if (browserName !== 'firefox')
    expect(text).toEqual('[1, 2, 3] {a: 1} Window');
  else
    expect(text).toEqual('Array JSHandle@object JSHandle@object');
});

it('should use object previews for errors', async ({ page, browserName }) => {
  let text: string;
  page.on('console', message => {
    text = message.text();
  });
  await page.evaluate(() => console.log(new Error('Exception')));
  if (browserName === 'chromium')
    expect(text).toContain('.evaluate');
  if (browserName === 'webkit')
    expect(text).toEqual('Error: Exception');
  if (browserName === 'firefox')
    expect(text).toEqual('Error');
});

it('do not update console count on unhandled rejections', async ({ page }) => {
  const messages: string[] = [];
  const consoleEventListener = m => messages.push(m.text());
  page.addListener('console', consoleEventListener);

  await page.evaluate(() => {
    const fail = async () => Promise.reject(new Error('error'));
    console.log('begin');
    void fail();
    void fail();
    fail().catch(() => {
      console.log('end');
    });
  });

  await expect.poll(() => messages).toEqual(['begin', 'end']);
});

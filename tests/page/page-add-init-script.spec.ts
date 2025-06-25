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

it('should evaluate before anything else on the page', async ({ page, server }) => {
  await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should work with a path', async ({ page, server, asset }) => {
  await page.addInitScript({ path: asset('injectedfile.js') });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should work with content @smoke', async ({ page, server }) => {
  await page.addInitScript({ content: 'window["injected"] = 123' });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('should throw without path and content', async ({ page }) => {
  // @ts-expect-error foo is not a real option of addInitScript
  const error = await page.addInitScript({ foo: 'bar' }).catch(e => e);
  expect(error.message).toContain('Either path or content property must be present');
});

it('should work with trailing comments', async ({ page, asset }) => {
  await page.addInitScript({ content: '// comment' });
  await page.addInitScript({ content: 'window.secret = 42;' });
  await page.goto('data:text/html,<html></html>');
  expect(await page.evaluate('secret')).toBe(42);
});

it('should support multiple scripts', async ({ page, server }) => {
  await page.addInitScript(function() {
    window['script1'] = 1;
  });
  await page.addInitScript(function() {
    window['script2'] = 2;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['script1'])).toBe(1);
  expect(await page.evaluate(() => window['script2'])).toBe(2);
});

it('should work with CSP', async ({ page, server }) => {
  server.setCSP('/empty.html', 'script-src ' + server.PREFIX);
  await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/empty.html');
  expect(await page.evaluate(() => window['injected'])).toBe(123);

  // Make sure CSP works.
  await page.addScriptTag({ content: 'window.e = 10;' }).catch(e => void e);
  expect(await page.evaluate(() => window['e'])).toBe(undefined);
});

it('should work after a cross origin navigation', async ({ page, server }) => {
  await page.goto(server.CROSS_PROCESS_PREFIX);
  await page.addInitScript(function() {
    window['injected'] = 123;
  });
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
});

it('init script should run only once in iframe', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26992' });
  const messages = [];
  page.on('console', event => {
    if (event.text().startsWith('init script:'))
      messages.push(event.text());
  });
  await page.addInitScript(() => console.log('init script:', location.pathname || 'no url yet'));
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  expect(messages).toEqual([
    'init script: /frames/one-frame.html',
    'init script: ' + (browserName === 'firefox' ? 'no url yet' : '/frames/frame.html'),
  ]);
});

it('init script should not observe playwright internals', async ({ server, page, trace, isAndroid }) => {
  it.skip(!!process.env.PW_CLOCK, 'clock installs globalThis.__pwClock');
  it.skip(trace === 'on', 'tracing installs __playwright_snapshot_streamer');
  it.fixme(isAndroid, 'There is probably context reuse between this test and some other test that installs a binding');

  await page.addInitScript(() => {
    window['check'] = () => {
      const keys = Reflect.ownKeys(globalThis).map(k => k.toString());
      return keys.find(name => name.includes('playwright') || name.includes('_pw')) || 'none';
    };
    window['found'] = window['check']();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => window['found'])).toBe('none');
  expect(await page.evaluate(() => window['check']())).toBe('none');
});

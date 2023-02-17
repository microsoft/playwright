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
import { verifyViewport } from '../config/utils';
import fs from 'fs';

it('context.cookies() should work @smoke', async ({ server, launchPersistent, defaultSameSiteCookieValue }) => {
  const { page } = await launchPersistent();
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
    sameSite: defaultSameSiteCookieValue,
  }]);
});

it('context.addCookies() should work', async ({ server, launchPersistent, browserName, isWindows }) => {
  const { page } = await launchPersistent();
  await page.goto(server.EMPTY_PAGE);
  await page.context().addCookies([{
    url: server.EMPTY_PAGE,
    name: 'username',
    value: 'John Doe',
    sameSite: 'Lax',
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
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]);
});

it('context.clearCookies() should work', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent();
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
});

it('should(not) block third party cookies', async ({ server, launchPersistent, browserName, allowsThirdParty }) => {
  const { page, context } = await launchPersistent();
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
  expect(documentCookie).toBe(allowsThirdParty ? 'username=John Doe' : '');
  const cookies = await context.cookies(server.CROSS_PROCESS_PREFIX + '/grid.html');
  if (allowsThirdParty) {
    expect(cookies).toEqual([
      {
        'domain': '127.0.0.1',
        'expires': -1,
        'httpOnly': false,
        'name': 'username',
        'path': '/',
        'sameSite': 'None',
        'secure': false,
        'value': 'John Doe'
      }
    ]);
  } else {
    expect(cookies).toEqual([]);
  }
});

it('should support viewport option', async ({ launchPersistent }) => {
  const { page, context } = await launchPersistent({ viewport: { width: 456, height: 789 } });
  await verifyViewport(page, 456, 789);
  const page2 = await context.newPage();
  await verifyViewport(page2, 456, 789);
});

it('should support deviceScaleFactor option', async ({ launchPersistent }) => {
  const { page } = await launchPersistent({ deviceScaleFactor: 3 });
  expect(await page.evaluate('window.devicePixelRatio')).toBe(3);
});

it('should support userAgent option', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ userAgent: 'foobar' });
  expect(await page.evaluate(() => navigator.userAgent)).toBe('foobar');
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect(request.headers['user-agent']).toBe('foobar');
});

it('should support bypassCSP option', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ bypassCSP: true });
  await page.goto(server.PREFIX + '/csp.html');
  await page.addScriptTag({ content: 'window["__injected"] = 42;' });
  expect(await page.evaluate('__injected')).toBe(42);
});

it('should support javascriptEnabled option', async ({ launchPersistent, browserName }) => {
  const { page } = await launchPersistent({ javaScriptEnabled: false });
  await page.goto('data:text/html, <script>var something = "forbidden"</script>');
  let error = null;
  await page.evaluate('something').catch(e => error = e);
  if (browserName === 'webkit')
    expect(error.message).toContain('Can\'t find variable: something');
  else
    expect(error.message).toContain('something is not defined');
});

it('should support httpCredentials option', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ httpCredentials: { username: 'user', password: 'pass' } });
  server.setAuth('/playground.html', 'user', 'pass');
  const response = await page.goto(server.PREFIX + '/playground.html');
  expect(response.status()).toBe(200);
});

it('should support offline option', async ({ server, launchPersistent }) => {
  const { page } = await launchPersistent({ offline: true });
  const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
  expect(error).toBeTruthy();
});

it('should support acceptDownloads option', async ({ server, launchPersistent, mode }) => {
  it.skip(mode !== 'default', 'download.path() is not available in remote mode');

  const { page } = await launchPersistent();
  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });
  await page.setContent(`<a href="${server.PREFIX}/download">download</a>`);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a')
  ]);
  const path = await download.path();
  expect(fs.existsSync(path)).toBeTruthy();
  expect(fs.readFileSync(path).toString()).toBe('Hello world');
});

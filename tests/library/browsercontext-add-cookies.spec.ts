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

import type { IncomingHttpHeaders } from 'http';
import type { Cookie } from '@playwright/test';
import { contextTest as it, playwrightTest, expect } from '../config/browserTest';

it('should work @smoke', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await context.addCookies([{
    url: server.EMPTY_PAGE,
    name: 'password',
    value: '123456',
  }]);
  expect(await page.evaluate(() => document.cookie)).toEqual('password=123456');
});

it('should work with expires=-1', async ({ context, page }) => {
  await context.addCookies([{
    name: 'username',
    value: 'John Doe',
    domain: 'www.example.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);
  await page.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page.goto('https://www.example.com');
  expect(await page.evaluate(() => document.cookie)).toEqual('username=John Doe');
});

it('should add cookies with empty value', async ({ context, page, server }) => {
  await context.addCookies([{
    name: 'marker',
    value: '',
    domain: 'www.example.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);
  await page.route('**/*', route => {
    route.fulfill({ body: '<html></html>' }).catch(() => {});
  });
  await page.goto('https://www.example.com');
  expect(await page.evaluate(() => document.cookie)).toEqual('marker=');
});

it('should roundtrip cookie', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  // @see https://en.wikipedia.org/wiki/Year_2038_problem
  const date = +(new Date('1/1/2038'));
  const documentCookie = await page.evaluate(timestamp => {
    const date = new Date(timestamp);
    document.cookie = `username=John Doe;expires=${date.toUTCString()}`;
    return document.cookie;
  }, date);
  expect(documentCookie).toBe('username=John Doe');
  const cookies = await context.cookies();
  await context.clearCookies();
  expect(await context.cookies()).toEqual([]);
  await context.addCookies(cookies);
  // Slightly different rounding on chromium win.
  const normalizedExpires = (cookies: Cookie[]) => cookies.map(c => ({ ...c, expires: Math.floor(c.expires) }));
  expect(normalizedExpires(await context.cookies())).toEqual(normalizedExpires(cookies));
});

it('should send cookie header', async ({ server, context }) => {
  let cookie = '';
  server.setRoute('/empty.html', (req, res) => {
    cookie = req.headers.cookie!;
    res.end();
  });
  await context.addCookies([{ url: server.EMPTY_PAGE, name: 'cookie', value: 'value' }]);
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(cookie).toBe('cookie=value');
});

it('should isolate cookies in browser contexts', async ({ context, server, browser }) => {
  const anotherContext = await browser.newContext();
  await context.addCookies([{ url: server.EMPTY_PAGE, name: 'isolatecookie', value: 'page1value' }]);
  await anotherContext.addCookies([{ url: server.EMPTY_PAGE, name: 'isolatecookie', value: 'page2value' }]);

  const cookies1 = await context.cookies();
  const cookies2 = await anotherContext.cookies();
  expect(cookies1.length).toBe(1);
  expect(cookies2.length).toBe(1);
  expect(cookies1[0].name).toBe('isolatecookie');
  expect(cookies1[0].value).toBe('page1value');
  expect(cookies2[0].name).toBe('isolatecookie');
  expect(cookies2[0].value).toBe('page2value');
  await anotherContext.close();
});

it('should isolate session cookies', async ({ context, server, browser }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', 'session=value');
    res.end();
  });
  {
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/setcookie.html');
  }
  {
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const cookies = await context.cookies();
    expect(cookies.length).toBe(1);
    expect(cookies.map(c => c.value).join(',')).toBe('value');
  }
  {
    const context2 = await browser.newContext();
    const page = await context2.newPage();
    await page.goto(server.EMPTY_PAGE);
    const cookies = await context2.cookies();
    expect(cookies[0] && cookies[0].name).toBe(undefined);
    await context2.close();
  }
});

it('should isolate persistent cookies', async ({ context, server, browser }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', 'persistent=persistent-value; max-age=3600');
    res.end();
  });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/setcookie.html');

  const context1 = context;
  const context2 = await browser.newContext();
  const [page1, page2] = await Promise.all([context1.newPage(), context2.newPage()]);
  await Promise.all([page1.goto(server.EMPTY_PAGE), page2.goto(server.EMPTY_PAGE)]);
  const [cookies1, cookies2] = await Promise.all([context1.cookies(), context2.cookies()]);
  expect(cookies1.length).toBe(1);
  expect(cookies1[0].name).toBe('persistent');
  expect(cookies1[0].value).toBe('persistent-value');
  expect(cookies2.length).toBe(0);
  await context2.close();
});

it('should isolate send cookie header', async ({ server, context, browser }) => {
  let cookie = '';
  server.setRoute('/empty.html', (req, res) => {
    cookie = req.headers.cookie || '';
    res.end();
  });
  await context.addCookies([{ url: server.EMPTY_PAGE, name: 'sendcookie', value: 'value' }]);
  {
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(cookie).toBe('sendcookie=value');
  }
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(cookie).toBe('');
    await context.close();
  }
});

playwrightTest('should isolate cookies between launches', async ({ browserType, server }) => {
  playwrightTest.slow();

  const browser1 = await browserType.launch();
  const context1 = await browser1.newContext();
  await context1.addCookies([{ url: server.EMPTY_PAGE, name: 'cookie-in-context-1', value: 'value', expires: Date.now() / 1000 + 10000 }]);
  await browser1.close();

  const browser2 = await browserType.launch();
  const context2 = await browser2.newContext();
  const cookies = await context2.cookies();
  expect(cookies.length).toBe(0);
  await browser2.close();
});

it('should set multiple cookies', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await context.addCookies([{
    url: server.EMPTY_PAGE,
    name: 'multiple-1',
    value: '123456'
  }, {
    url: server.EMPTY_PAGE,
    name: 'multiple-2',
    value: 'bar'
  }]);
  expect(await page.evaluate(() => {
    const cookies = document.cookie.split(';');
    return cookies.map(cookie => cookie.trim()).sort();
  })).toEqual([
    'multiple-1=123456',
    'multiple-2=bar',
  ]);
});

it('should have |expires| set to |-1| for session cookies', async ({ context, server }) => {
  await context.addCookies([{
    url: server.EMPTY_PAGE,
    name: 'expires',
    value: '123456'
  }]);
  const cookies = await context.cookies();
  expect(cookies[0].expires).toBe(-1);
});

it('should set cookie with reasonable defaults', async ({ context, server, defaultSameSiteCookieValue }) => {
  await context.addCookies([{
    url: server.EMPTY_PAGE,
    name: 'defaults',
    value: '123456',
  }]);
  const cookies = await context.cookies();
  expect(cookies.sort((a, b) => a.name.localeCompare(b.name))).toEqual([{
    name: 'defaults',
    value: '123456',
    domain: 'localhost',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: defaultSameSiteCookieValue,
  }]);
});

it('should set a cookie with a path', async ({ context, page, server, browserName, isWindows }) => {
  await page.goto(server.PREFIX + '/grid.html');
  await context.addCookies([{
    domain: 'localhost',
    path: '/grid.html',
    name: 'gridcookie',
    value: 'GRID',
    sameSite: 'Lax',
  }]);
  expect(await context.cookies()).toEqual([{
    name: 'gridcookie',
    value: 'GRID',
    domain: 'localhost',
    path: '/grid.html',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]);
  expect(await page.evaluate('document.cookie')).toBe('gridcookie=GRID');
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate('document.cookie')).toBe('');
  await page.goto(server.PREFIX + '/grid.html');
  expect(await page.evaluate('document.cookie')).toBe('gridcookie=GRID');
});

it('should not set a cookie with blank page URL', async function({ context, server }) {
  let error = null;
  try {
    await context.addCookies([
      { url: server.EMPTY_PAGE, name: 'example-cookie', value: 'best' },
      { url: 'about:blank', name: 'example-cookie-blank', value: 'best' }
    ]);
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain(
      `Blank page can not have cookie "example-cookie-blank"`
  );
});

it('should not set a cookie on a data URL page', async function({ context }) {
  let error = null;
  try {
    await context.addCookies([{ url: 'data:,Hello%2C%20World!', name: 'example-cookie', value: 'best' }]);
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('Data URL page can not have cookie "example-cookie"');
});

it('should default to setting secure cookie for HTTPS websites', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const SECURE_URL = 'https://example.com';
  await context.addCookies([{
    url: SECURE_URL,
    name: 'foo',
    value: 'bar',
  }]);
  const [cookie] = await context.cookies(SECURE_URL);
  expect(cookie.secure).toBe(true);
});

it('should be able to set unsecure cookie for HTTP website', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const HTTP_URL = 'http://example.com';
  await context.addCookies([{
    url: HTTP_URL,
    name: 'foo',
    value: 'bar',
  }]);
  const [cookie] = await context.cookies(HTTP_URL);
  expect(cookie.secure).toBe(false);
});

it('should set a cookie on a different domain', async ({ context, page, server, browserName, isWindows }) => {
  await page.goto(server.EMPTY_PAGE);
  await context.addCookies([{
    url: 'https://www.example.com',
    name: 'example-cookie',
    value: 'best',
    sameSite: 'Lax',
  }]);
  expect(await page.evaluate('document.cookie')).toBe('');
  expect(await context.cookies('https://www.example.com')).toEqual([{
    name: 'example-cookie',
    value: 'best',
    domain: 'www.example.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]);
});

it('should set cookies for a frame', async ({ context, page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await context.addCookies([
    { url: server.PREFIX, name: 'frame-cookie', value: 'value' }
  ]);
  await page.evaluate(src => {
    let fulfill!: (value: unknown) => void;
    const promise = new Promise(x => fulfill = x);
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    iframe.onload = fulfill;
    iframe.src = src;
    return promise;
  }, server.PREFIX + '/grid.html');

  expect(await page.frames()[1].evaluate('document.cookie')).toBe('frame-cookie=value');
});

it('should(not) block third party cookies', async ({ context, page, server, browserName, allowsThirdParty }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(src => {
    let fulfill!: (value: unknown) => void;
    const promise = new Promise(x => fulfill = x);
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    iframe.onload = fulfill;
    iframe.src = src;
    return promise;
  }, server.CROSS_PROCESS_PREFIX + '/grid.html');
  await page.frames()[1].evaluate(`document.cookie = 'username=John Doe'`);
  await page.waitForTimeout(2000);
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

it('should not block third party SameSite=None cookies', async ({ contextFactory, httpsServer, browserName }) => {
  it.skip(browserName === 'webkit', 'No third party cookies in WebKit');
  it.skip(process.env.PW_CLOCK === 'frozen');
  const context = await contextFactory({
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  httpsServer.setRoute('/empty.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html'
    });
    res.end(`<iframe src="${httpsServer.CROSS_PROCESS_PREFIX}/grid.html"></iframe>`);
  });

  httpsServer.setRoute('/grid.html', (req, res) => {
    res.writeHead(200, {
      'Set-Cookie': ['a=b; Path=/; Max-Age=3600; SameSite=None; Secure'],
      'Content-Type': 'text/html'
    });
    res.end(`Hello world
    <script>
    setTimeout(() => fetch('/json'), 1000);
    </script>`);
  });

  const cookie = new Promise(f => {
    httpsServer.setRoute('/json', (req, res) => {
      f(req.headers.cookie);
      res.end();
    });
  });

  await page.goto(httpsServer.EMPTY_PAGE);
  expect(await cookie).toBe('a=b');
});

it('should allow unnamed cookies', async ({ page, context, server, browserName, platform }) => {
  server.setRoute('/cookies', (req, res) => {
    res.write(req.headers.cookie ?? 'undefined-on-server');
    res.end();
  });
  await context.addCookies([{
    url: server.EMPTY_PAGE,
    name: '',
    value: 'unnamed-via-add-cookies',
  }]);
  // Round-trip behavior
  const resp = await page.goto(server.PREFIX + '/cookies');
  if (browserName === 'webkit' && platform === 'darwin') {
    expect.soft(await resp!.text()).toBe('undefined-on-server');
    expect.soft(await page.evaluate('document.cookie')).toBe('');
  } else {
    expect.soft(await resp!.text()).toBe('unnamed-via-add-cookies');
    expect.soft(await page.evaluate('document.cookie')).toBe('unnamed-via-add-cookies');
  }
  // Within PW behavior
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => document.cookie = '=unnamed-via-js;');
  await context.addCookies(await context.cookies());
  if (browserName === 'webkit' && platform === 'darwin')
    expect.soft(await page.evaluate('document.cookie')).toBe('');
  else
    expect.soft(await page.evaluate('document.cookie')).toBe('unnamed-via-js');
});

it('should set secure cookies on secure WebSocket', async ({ contextFactory, httpsServer }) => {
  let resolveReceivedWebSocketHeaders = (headers: IncomingHttpHeaders) => { };
  const receivedWebSocketHeaders = new Promise<IncomingHttpHeaders>(resolve => resolveReceivedWebSocketHeaders = resolve);
  httpsServer.onceWebSocketConnection((ws, req) => resolveReceivedWebSocketHeaders(req.headers));
  const context = await contextFactory({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(httpsServer.EMPTY_PAGE);
  await context.addCookies([{ domain: 'localhost', path: '/', name: 'foo', value: 'bar', secure: true }]);
  await page.evaluate(port => new WebSocket(`wss://localhost:${port}/ws`), httpsServer.PORT);
  const headers = await receivedWebSocketHeaders;
  expect(headers.cookie).toBe('foo=bar');
});

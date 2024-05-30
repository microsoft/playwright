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

import { contextTest as it, expect } from '../config/browserTest';

it('should return no cookies in pristine browser context', async ({ context, page, server }) => {
  expect(await context.cookies()).toEqual([]);
});

it('should get a cookie @smoke', async ({ context, page, server, defaultSameSiteCookieValue }) => {
  await page.goto(server.EMPTY_PAGE);
  const documentCookie = await page.evaluate(() => {
    document.cookie = 'username=John Doe';
    return document.cookie;
  });
  expect(documentCookie).toBe('username=John Doe');
  expect(await context.cookies()).toEqual([{
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

it('should get a non-session cookie', async ({ context, page, server, defaultSameSiteCookieValue }) => {
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
  expect(cookies.length).toBe(1);
  expect(cookies[0]).toEqual({
    name: 'username',
    value: 'John Doe',
    domain: 'localhost',
    path: '/',
    // We will check this separately.
    expires: expect.anything(),
    httpOnly: false,
    secure: false,
    sameSite: defaultSameSiteCookieValue,
  });
  // Browsers start to cap cookies with 400 days max expires value.
  // See https://github.com/httpwg/http-extensions/pull/1732
  // Chromium patch: https://chromium.googlesource.com/chromium/src/+/aaa5d2b55478eac2ee642653dcd77a50ac3faff6
  // We want to make sure that expires date is at least 400 days in future.
  const FOUR_HUNDRED_DAYS = 1000 * 60 * 60 * 24 * 400;
  const FIVE_MINUTES = 1000 * 60 * 5; // relax condition a bit to make sure test is not flaky.
  expect(cookies[0].expires).toBeGreaterThan((Date.now() + FOUR_HUNDRED_DAYS - FIVE_MINUTES) / 1000);
});

it('should properly report httpOnly cookie', async ({ context, page, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value;HttpOnly; Path=/');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0].httpOnly).toBe(true);
});

it('should properly report "Strict" sameSite cookie', async ({ context, page, server, browserName, platform }) => {
  it.fail(browserName === 'webkit' && platform === 'win32');

  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value;SameSite=Strict');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0].sameSite).toBe('Strict');
});

it('should properly report "Lax" sameSite cookie', async ({ context, page, server, browserName, platform }) => {
  it.fail(browserName === 'webkit' && platform === 'win32');

  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value;SameSite=Lax');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0].sameSite).toBe('Lax');
});

it('should get multiple cookies', async ({ context, page, server, defaultSameSiteCookieValue }) => {
  await page.goto(server.EMPTY_PAGE);
  const documentCookie = await page.evaluate(() => {
    document.cookie = 'username=John Doe';
    document.cookie = 'password=1234';
    return document.cookie.split('; ').sort().join('; ');
  });
  const cookies = new Set(await context.cookies());
  expect(documentCookie).toBe('password=1234; username=John Doe');
  expect(cookies).toEqual(new Set([
    {
      name: 'password',
      value: '1234',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: defaultSameSiteCookieValue,
    },
    {
      name: 'username',
      value: 'John Doe',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: defaultSameSiteCookieValue,
    },
  ]));
});

it('should get cookies from multiple urls', async ({ context, browserName, isWindows }) => {
  await context.addCookies([{
    url: 'https://foo.com',
    name: 'doggo',
    value: 'woofs',
    sameSite: 'None',
  }, {
    url: 'https://bar.com',
    name: 'catto',
    value: 'purrs',
    sameSite: 'Lax',
  }, {
    url: 'https://baz.com',
    name: 'birdo',
    value: 'tweets',
    sameSite: 'Lax',
  }]);
  const cookies = new Set(await context.cookies(['https://foo.com', 'https://baz.com']));
  expect(cookies).toEqual(new Set([{
    name: 'birdo',
    value: 'tweets',
    domain: 'baz.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }, {
    name: 'doggo',
    value: 'woofs',
    domain: 'foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  }]));
});

it('should work with subdomain cookie', async ({ context, browserName, isWindows }) => {
  await context.addCookies([{
    domain: '.foo.com',
    path: '/',
    name: 'doggo',
    value: 'woofs',
    sameSite: 'Lax',
    secure: true
  }]);
  expect(await context.cookies('https://foo.com')).toEqual([{
    name: 'doggo',
    value: 'woofs',
    domain: '.foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]);
  expect(await context.cookies('https://sub.foo.com')).toEqual([{
    name: 'doggo',
    value: 'woofs',
    domain: '.foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]);
});

it('should return cookies with empty value', async ({ context, page, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=;Path=/');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies).toEqual([
    expect.objectContaining({
      name: 'name',
      value: ''
    })
  ]);
});

it('should return secure cookies based on HTTP(S) protocol', async ({ context, browserName, isWindows }) => {
  await context.addCookies([{
    url: 'https://foo.com',
    name: 'doggo',
    value: 'woofs',
    sameSite: 'Lax',
    secure: true
  }, {
    url: 'http://foo.com',
    name: 'catto',
    value: 'purrs',
    sameSite: 'Lax',
    secure: false
  }]);
  const cookies = new Set(await context.cookies('https://foo.com'));
  expect(cookies).toEqual(new Set([{
    name: 'catto',
    value: 'purrs',
    domain: 'foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }, {
    name: 'doggo',
    value: 'woofs',
    domain: 'foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]));
  expect(await context.cookies('http://foo.com/')).toEqual([{
    name: 'catto',
    value: 'purrs',
    domain: 'foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
  }]);
});

it('should add cookies with an expiration', async ({ context }) => {
  const expires = Math.floor((Date.now() / 1000)) + 3600;
  await context.addCookies([{
    url: 'https://foo.com',
    name: 'doggo',
    value: 'woofs',
    sameSite: 'None',
    expires,
  }]);
  const cookies = await context.cookies(['https://foo.com']);
  expect(cookies.length).toBe(1);
  expect(cookies).toEqual([{
    name: 'doggo',
    value: 'woofs',
    domain: 'foo.com',
    path: '/',
    expires,
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  }]);
  {
    // Rollover to 5-digit year
    await context.addCookies([{
      url: 'https://foo.com',
      name: 'doggo',
      value: 'woofs',
      sameSite: 'None',
      expires: 253402300799, // Fri, 31 Dec 9999 23:59:59 +0000 (UTC)
    }]);
    await expect(context.addCookies([{
      url: 'https://foo.com',
      name: 'doggo',
      value: 'woofs',
      sameSite: 'None',
      expires: 253402300800, // Sat,  1 Jan 1000 00:00:00 +0000 (UTC)
    }])).rejects.toThrow(/Cookie should have a valid expires/);
  }

  await expect(context.addCookies([{
    url: 'https://foo.com',
    name: 'doggo',
    value: 'woofs',
    sameSite: 'None',
    expires: -42,
  }])).rejects.toThrow(/Cookie should have a valid expires/);
});

it('should be able to send third party cookies via an iframe', async ({ browser, httpsServer, browserName, isMac }) => {
  it.fixme(browserName === 'webkit' && isMac);
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16937' });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
  });
  try {
    const page = await context.newPage();
    await page.goto(httpsServer.EMPTY_PAGE);
    await context.addCookies([{
      domain: new URL(httpsServer.CROSS_PROCESS_PREFIX).hostname,
      path: '/',
      name: 'cookie1',
      value: 'yes',
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    }]);
    const [response] = await Promise.all([
      httpsServer.waitForRequest('/grid.html'),
      page.setContent(`<iframe src="${httpsServer.CROSS_PROCESS_PREFIX}/grid.html"></iframe>`)
    ]);
    expect(response.headers['cookie']).toBe('cookie1=yes');
  } finally {
    await context.close();
  }
});

it('should support requestStorageAccess', async ({ page, server, channel, browserName, isMac, isLinux, isWindows }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/17285' });
  it.skip(browserName === 'chromium', 'requestStorageAccess API is not available in Chromium');
  it.skip(channel === 'firefox-beta', 'hasStorageAccess returns true, but no cookie is sent');

  server.setRoute('/set-cookie.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value; Path=/');
    res.end();
  });
  // Navigate once to the domain as top level.
  await page.goto(server.CROSS_PROCESS_PREFIX + '/set-cookie.html');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<iframe src="${server.CROSS_PROCESS_PREFIX + '/empty.html'}"></iframe>`);

  const frame = page.frames()[1];
  if (browserName === 'firefox') {
    expect(await frame.evaluate(() => document.hasStorageAccess())).toBeTruthy();
    {
      const [serverRequest] = await Promise.all([
        server.waitForRequest('/title.html'),
        frame.evaluate(() => fetch('/title.html'))
      ]);
      expect(serverRequest.headers.cookie).toBe('name=value');
    }
  } else {
    if (isLinux && browserName === 'webkit')
      expect(await frame.evaluate(() => document.hasStorageAccess())).toBeTruthy();
    else
      expect(await frame.evaluate(() => document.hasStorageAccess())).toBeFalsy();
    {
      const [serverRequest] = await Promise.all([
        server.waitForRequest('/title.html'),
        frame.evaluate(() => fetch('/title.html'))
      ]);
      if (isWindows && browserName === 'webkit')
        expect(serverRequest.headers.cookie).toBe('name=value');
      else
        expect(serverRequest.headers.cookie).toBeFalsy();
    }
    expect(await frame.evaluate(() => document.requestStorageAccess().then(() => true, e => false))).toBeTruthy();
    expect(await frame.evaluate(() => document.hasStorageAccess())).toBeTruthy();
    {
      const [serverRequest] = await Promise.all([
        server.waitForRequest('/title.html'),
        frame.evaluate(() => fetch('/title.html'))
      ]);
      if (isLinux && browserName === 'webkit')
        expect(serverRequest.headers.cookie).toBe(undefined);
      else
        expect(serverRequest.headers.cookie).toBe('name=value');
    }
  }
});

it('should parse cookie with large Max-Age correctly', async ({ server, page, defaultSameSiteCookieValue, browserName, platform }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30305' });
  it.fixme(browserName === 'webkit' && platform === 'linux', 'https://github.com/microsoft/playwright/issues/30305');

  server.setRoute('/foobar', (req, res) => {
    res.setHeader('set-cookie', [
      'cookie1=value1; Path=/; Expires=Thu, 08 Sep 2270 15:06:12 GMT; Max-Age=7776000000'
    ]);
    res.statusCode = 200;
    res.end();
  });
  await page.goto(server.PREFIX + '/foobar');
  expect(await page.evaluate(() => document.cookie)).toBe('cookie1=value1');
  expect(await page.context().cookies()).toEqual([
    {
      name: 'cookie1',
      value: 'value1',
      domain: 'localhost',
      path: '/',
      expires: expect.any(Number),
      httpOnly: false,
      secure: false,
      sameSite: defaultSameSiteCookieValue,
    },
  ]);
});

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

import { contextTest as it, expect } from './config/browserTest';

it('should return no cookies in pristine browser context', async ({ context, page, server }) => {
  expect(await context.cookies()).toEqual([]);
});

it('should get a cookie', async ({ context, page, server, browserName, browserMajorVersion }) => {
  await page.goto(server.EMPTY_PAGE);
  const documentCookie = await page.evaluate(() => {
    document.cookie = 'username=John Doe';
    return document.cookie;
  });
  expect(documentCookie).toBe('username=John Doe');
  const defaultSameSiteCookieValue = browserName === 'chromium' || (browserName === 'firefox' && browserMajorVersion >= 96) ? 'Lax' : 'None';
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

it('should get a non-session cookie', async ({ context, page, server, browserName, browserMajorVersion }) => {
  await page.goto(server.EMPTY_PAGE);
  // @see https://en.wikipedia.org/wiki/Year_2038_problem
  const date = +(new Date('1/1/2038'));
  const documentCookie = await page.evaluate(timestamp => {
    const date = new Date(timestamp);
    document.cookie = `username=John Doe;expires=${date.toUTCString()}`;
    return document.cookie;
  }, date);
  expect(documentCookie).toBe('username=John Doe');
  const defaultSameSiteCookieValue = browserName === 'chromium' || (browserName === 'firefox' && browserMajorVersion >= 96) ? 'Lax' : 'None';
  expect(await context.cookies()).toEqual([{
    name: 'username',
    value: 'John Doe',
    domain: 'localhost',
    path: '/',
    expires: date / 1000,
    httpOnly: false,
    secure: false,
    sameSite: defaultSameSiteCookieValue,
  }]);
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

it('should get multiple cookies', async ({ context, page, server, browserName, browserMajorVersion }) => {
  await page.goto(server.EMPTY_PAGE);
  const documentCookie = await page.evaluate(() => {
    document.cookie = 'username=John Doe';
    document.cookie = 'password=1234';
    return document.cookie.split('; ').sort().join('; ');
  });
  const cookies = new Set(await context.cookies());
  const defaultSameSiteCookieValue = browserName === 'chromium' || (browserName === 'firefox' && browserMajorVersion >= 96) ? 'Lax' : 'None';
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

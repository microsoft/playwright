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

import { it, expect } from './fixtures';

it('should return no cookies in pristine browser context', async ({context, page, server}) => {
  expect(await context.cookies()).toEqual([]);
});

it('should get a cookie', async ({context, page, server}) => {
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
    sameSite: 'None',
  }]);
});

it('should get a non-session cookie', async ({context, page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  // @see https://en.wikipedia.org/wiki/Year_2038_problem
  const date = +(new Date('1/1/2038'));
  const documentCookie = await page.evaluate(timestamp => {
    const date = new Date(timestamp);
    document.cookie = `username=John Doe;expires=${date.toUTCString()}`;
    return document.cookie;
  }, date);
  expect(documentCookie).toBe('username=John Doe');
  expect(await context.cookies()).toEqual([{
    name: 'username',
    value: 'John Doe',
    domain: 'localhost',
    path: '/',
    expires: date / 1000,
    httpOnly: false,
    secure: false,
    sameSite: 'None',
  }]);
});

it('should properly report httpOnly cookie', async ({context, page, server}) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value;HttpOnly; Path=/');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0].httpOnly).toBe(true);
});

it('should properly report "Strict" sameSite cookie', (test, { browserName, platform }) => {
  test.fail(browserName === 'webkit' && platform === 'win32');
}, async ({context, page, server}) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value;SameSite=Strict');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0].sameSite).toBe('Strict');
});

it('should properly report "Lax" sameSite cookie', (test, { browserName, platform }) => {
  test.fail(browserName === 'webkit' && platform === 'win32');
}, async ({context, page, server}) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value;SameSite=Lax');
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0].sameSite).toBe('Lax');
});

it('should get multiple cookies', async ({context, page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  const documentCookie = await page.evaluate(() => {
    document.cookie = 'username=John Doe';
    document.cookie = 'password=1234';
    return document.cookie.split('; ').sort().join('; ');
  });
  const cookies = await context.cookies();
  cookies.sort((a, b) => a.name.localeCompare(b.name));
  expect(documentCookie).toBe('password=1234; username=John Doe');
  expect(cookies).toEqual([
    {
      name: 'password',
      value: '1234',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
    },
    {
      name: 'username',
      value: 'John Doe',
      domain: 'localhost',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: false,
      sameSite: 'None',
    },
  ]);
});

it('should get cookies from multiple urls', async ({context}) => {
  await context.addCookies([{
    url: 'https://foo.com',
    name: 'doggo',
    value: 'woofs',
  }, {
    url: 'https://bar.com',
    name: 'catto',
    value: 'purrs',
  }, {
    url: 'https://baz.com',
    name: 'birdo',
    value: 'tweets',
  }]);
  const cookies = await context.cookies(['https://foo.com', 'https://baz.com']);
  cookies.sort((a, b) => a.name.localeCompare(b.name));
  expect(cookies).toEqual([{
    name: 'birdo',
    value: 'tweets',
    domain: 'baz.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  }, {
    name: 'doggo',
    value: 'woofs',
    domain: 'foo.com',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: true,
    sameSite: 'None',
  }]);
});

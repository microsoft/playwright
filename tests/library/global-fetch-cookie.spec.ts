/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import type { LookupAddress } from 'dns';
import fs from 'fs';
import type { APIRequestContext } from 'playwright-core';
import { expect, playwrightTest } from '../config/browserTest';

export type GlobalFetchFixtures = {
  request: APIRequestContext;
};

const it = playwrightTest.extend<GlobalFetchFixtures>({
  request: async ({ playwright }, use) => {
    const request = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    await use(request);
    await request.dispose();
  },
});

type PromiseArg<T> = T extends Promise<infer R> ? R : never;
type StorageStateType = PromiseArg<ReturnType<APIRequestContext['storageState']>>;

it.skip(({ mode }) => mode !== 'default');

const __testHookLookup = (hostname: string): LookupAddress[] => {
  if (hostname.endsWith('localhost') || hostname.endsWith('one.com') || hostname.endsWith('two.com'))
    return [{ address: '127.0.0.1', family: 4 }];
  else
    throw new Error(`Failed to resolve hostname: ${hostname}`);
};

it('should store cookie from Set-Cookie header', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b', 'c=d; max-age=3600; domain=b.one.com; path=/input', 'e=f; domain=b.one.com; path=/input/subfolder']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`, {  __testHookLookup } as any);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/input/button.html'),
    request.get(`http://b.one.com:${server.PORT}/input/button.html`, {  __testHookLookup } as any)
  ]);
  expect(serverRequest.headers.cookie).toBe('c=d');
});

it('addCookies should add cookies to the cookie jar', async ({ request, server }) => {
  await request.addCookies([
    { name: 'a', value: 'b', url: server.EMPTY_PAGE },
    { name: 'c', value: 'd', domain: 'localhost', path: '/input', httpOnly: true, sameSite: 'Strict' },
    { name: 'e', value: 'f', domain: 'other.com', path: '/' },
  ]);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/input/button.html'),
    request.get(`${server.PREFIX}/input/button.html`)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=b; c=d');
  const state = await request.storageState();
  expect(state.cookies).toEqual([
    { name: 'a', value: 'b', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
    { name: 'c', value: 'd', domain: 'localhost', path: '/input', expires: -1, httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'e', value: 'f', domain: 'other.com', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
  ]);
});

it('addCookies should validate cookies', async ({ request }) => {
  const error = await request.addCookies([{ name: 'a', value: 'b' }]).catch(e => e);
  expect(error.message).toContain('Cookie should have a url or a domain/path pair');
});

it('cookies should return cookies filtered by urls', async ({ request, server }) => {
  await request.addCookies([
    { name: 'a', value: 'b', domain: 'localhost', path: '/' },
    { name: 'c', value: 'd', domain: 'localhost', path: '/input' },
    { name: 'e', value: 'f', domain: '.one.com', path: '/' },
    { name: 'g', value: 'h', domain: 'two.com', path: '/', secure: true },
  ]);
  expect((await request.cookies()).map(c => c.name)).toEqual(['a', 'c', 'e', 'g']);
  expect((await request.cookies(server.EMPTY_PAGE)).map(c => c.name)).toEqual(['a']);
  expect((await request.cookies(`${server.PREFIX}/input/button.html`)).map(c => c.name)).toEqual(['a', 'c']);
  expect((await request.cookies(['http://sub.one.com/', 'http://two.com/'])).map(c => c.name)).toEqual(['e']);
  expect((await request.cookies(['http://sub.one.com/', 'https://two.com/'])).map(c => c.name)).toEqual(['e', 'g']);
  expect(await request.cookies('http://other.com/')).toEqual([]);
});

it('cookies should not match subdomains for host-only cookies or prefix-only paths', async ({ request }) => {
  await request.addCookies([
    { name: 'a', value: '1', domain: 'example.com', path: '/api' },
  ]);
  expect((await request.cookies('https://example.com/api/x')).map(c => c.name)).toEqual(['a']);
  expect(await request.cookies('https://sub.example.com/api/x')).toEqual([]);
  expect(await request.cookies('https://example.com/apiv2')).toEqual([]);
});

it('should not send Path=/foo/ cookie to /foo', async ({ request, server }) => {
  server.setRoute('/foo/set', (req, res) => {
    res.setHeader('Set-Cookie', 'b=1; Path=/foo/');
    res.end();
  });
  await request.get(`${server.PREFIX}/foo/set`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/foo'),
    request.get(`${server.PREFIX}/foo`)
  ]);
  expect(serverRequest.headers.cookie).toBeUndefined();
  expect(await request.cookies(`${server.PREFIX}/foo`)).toEqual([]);
  expect((await request.cookies(`${server.PREFIX}/foo/`)).map(c => c.name)).toEqual(['b']);
  expect((await request.cookies(`${server.PREFIX}/foo/bar`)).map(c => c.name)).toEqual(['b']);
});

it('cookies should include cookies from Set-Cookie header', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b; HttpOnly; SameSite=Strict', 'c=d; path=/input']);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  expect(await request.cookies()).toEqual([
    { name: 'a', value: 'b', domain: 'localhost', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Strict' },
    { name: 'c', value: 'd', domain: 'localhost', path: '/input', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' },
  ]);
});

it('clearCookies should remove all cookies', async ({ request, server }) => {
  await request.addCookies([
    { name: 'a', value: 'b', url: server.EMPTY_PAGE },
    { name: 'c', value: 'd', domain: 'one.com', path: '/' },
  ]);
  await request.clearCookies();
  expect(await request.cookies()).toEqual([]);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE),
  ]);
  expect(serverRequest.headers.cookie).toBeUndefined();
});

it('clearCookies should filter by name, domain and path', async ({ request }) => {
  await request.addCookies([
    { name: 'session', value: '1', domain: 'one.com', path: '/' },
    { name: 'session', value: '2', domain: 'two.com', path: '/' },
    { name: 'session', value: '3', domain: 'two.com', path: '/api' },
    { name: 'other', value: '4', domain: 'one.com', path: '/' },
  ]);
  const values = async () => (await request.cookies()).map(c => c.value).sort();

  await request.clearCookies({ name: 'session', domain: 'two.com', path: '/api' });
  expect(await values()).toEqual(['1', '2', '4']);

  await request.clearCookies({ domain: /one\.com$/ });
  expect(await values()).toEqual(['2']);

  await request.clearCookies({ name: /^sess/ });
  expect(await values()).toEqual([]);
});

it('should filter outgoing cookies by path', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; path=/input/subfolder', 'b=v; path=/input', 'c=v;']);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/input/button.html'),
    request.get(`${server.PREFIX}/input/button.html`)
  ]);
  expect(serverRequest.headers.cookie).toBe('b=v; c=v');
});

it('should filter outgoing cookies by domain', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; domain=one.com', 'b=v; domain=.b.one.com', 'c=v; domain=other.com']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`, {  __testHookLookup } as any);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://www.b.one.com:${server.PORT}/empty.html`, {  __testHookLookup } as any)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');

  const [serverRequest2] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://two.com:${server.PORT}/empty.html`, {  __testHookLookup } as any)
  ]);
  expect(serverRequest2.headers.cookie).toBeFalsy();
});

it('should do case-insensitive match of cookie domain', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; domain=One.com', 'b=v; domain=.B.oNe.com']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`, {  __testHookLookup } as any);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://www.b.one.com:${server.PORT}/empty.html`, {  __testHookLookup } as any)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should do case-insensitive match of request domain', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; domain=one.com', 'b=v; domain=.b.one.com']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`, {  __testHookLookup } as any);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://WWW.B.ONE.COM:${server.PORT}/empty.html`, {  __testHookLookup } as any)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should send secure cookie over https', async ({ request, server, httpsServer }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; secure', 'b=v']);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    httpsServer.waitForRequest('/empty.html'),
    request.get(httpsServer.EMPTY_PAGE)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should send secure cookie over http for localhost', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; secure', 'b=v']);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should send secure cookie over http for subdomains of localhost', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; secure', 'b=v']);
    res.end();
  });
  const prefix = `http://a.b.localhost:${server.PORT}`;
  await request.get(`${prefix}/setcookie.html`, {  __testHookLookup } as any);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`${prefix}/empty.html`)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should send not expired cookies', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    res.setHeader('Set-Cookie', ['a=v', `b=v; expires=${tomorrow.toUTCString()}`]);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should remove expired cookies', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v', `b=v; expires=${new Date().toUTCString()}`]);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v');
});

it('should remove cookie with negative max-age', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; max-age=100000', `b=v; max-age=100000`, 'c=v']);
    res.end();
  });
  server.setRoute('/removecookie.html', (req, res) => {
    const maxAge = -2 * Date.now();
    res.setHeader('Set-Cookie', [`a=v; max-age=${maxAge}`, `b=v; max-age=-1`]);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  await request.get(`${server.PREFIX}/removecookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  expect(serverRequest.headers.cookie).toBe('c=v');
});

it('should remove cookie with expires far in the past', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; max-age=1000000']);
    res.end();
  });
  server.setRoute('/removecookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [`a=v; expires=1 Jan 1000 00:00:00 +0000 (UTC)`]);
    res.end();
  });
  await request.get(`${server.PREFIX}/setcookie.html`);
  await request.get(`${server.PREFIX}/removecookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  expect(serverRequest.headers.cookie).toBeFalsy();
});

it('should store cookie from Set-Cookie header even if it contains equal signs', async ({ request, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11612' });

  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['f=value == value=; secure; httpOnly; path=/some=value']);
    res.end();
  });

  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`, {  __testHookLookup } as any);
  const state = await request.storageState();
  expect(state).toEqual({
    'cookies': [
      {
        domain: 'a.b.one.com',
        expires: -1,
        name: 'f',
        path: '/some=value',
        sameSite: 'Lax',
        httpOnly: true,
        secure: true,
        value: 'value == value=',
      }
    ],
    'origins': []
  });
});

it('should override cookie from Set-Cookie header', async ({ request, server }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [`a=old; expires=${tomorrow.toUTCString()}`]);
    res.end();
  });

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrowInSeconds = Math.floor(dayAfterTomorrow.valueOf() / 1000);
  server.setRoute('/updatecookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [`a=new; expires=${dayAfterTomorrow.toUTCString()}`]);
    res.end();
  });

  await request.get(`${server.PREFIX}/setcookie.html`);
  await request.get(`${server.PREFIX}/updatecookie.html`);

  const state = await request.storageState();

  expect(state.cookies).toHaveLength(1);
  expect(state.cookies[0].name).toBe(`a`);
  expect(state.cookies[0].value).toBe(`new`);
  expect(state.cookies[0].expires).toBe(dayAfterTomorrowInSeconds);
});

it('should override cookie from Set-Cookie header even if it expired', async ({ request, server }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', [`a=ok`, `b=ok; expires=${tomorrow.toUTCString()}`]);
    res.end();
  });

  server.setRoute('/unsetsetcookie.html', (req, res) => {
    const pastDateString = new Date(1970, 0, 1, 0, 0, 0, 0).toUTCString();
    res.setHeader('Set-Cookie', [`a=; expires=${pastDateString}`, `b=; expires=${pastDateString}`]);
    res.end();
  });

  await request.get(`${server.PREFIX}/setcookie.html`);
  await request.get(`${server.PREFIX}/unsetsetcookie.html`);

  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);

  expect(serverRequest.headers.cookie).toBeFalsy();
});

it('should export cookies to storage state', async ({ request, server }) => {
  const expires = new Date('12/31/2100 PST');
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b', `c=d; expires=${expires.toUTCString()}; domain=b.one.com; path=/input`, 'e=f; domain=b.one.com; path=/input/subfolder']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`, {  __testHookLookup } as any);
  const state = await request.storageState();
  expect(state).toEqual({
    'cookies': [
      {
        'name': 'a',
        'value': 'b',
        'domain': 'a.b.one.com',
        'path': '/',
        'expires': -1,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      },
      {
        'name': 'c',
        'value': 'd',
        'domain': '.b.one.com',
        'path': '/input',
        'expires': +expires / 1000,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      },
      {
        'name': 'e',
        'value': 'f',
        'domain': '.b.one.com',
        'path': '/input/subfolder',
        'expires': -1,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      }
    ],
    'origins': []
  });
});

it('should preserve origin storage on import/export of storage state', async ({ playwright, server }) => {
  const storageState: StorageStateType = {
    cookies: [
      {
        'name': 'a',
        'value': 'b',
        'domain': 'a.b.one.com',
        'path': '/',
        'expires': -1,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      }
    ],
    origins: [
      {
        origin: 'https://www.example.com',
        localStorage: [{
          name: 'name1',
          value: 'value1'
        }],
        ...{
          opfs: [
            {
              path: 'hello.txt',
              type: 'file',
              base64: 'SGVsbG8sIHdvcmxkIQ==',
            },
            {
              path: 'empty',
              type: 'directory',
            },
          ],
          indexedDB: [
            {
              name: 'db',
              version: 5,
              stores: [
                {
                  name: 'store',
                  keyPath: 'id',
                  autoIncrement: false,
                  indexes: [],
                  records: [
                    {
                      value: { id: 'foo', name: 'John Doe' }
                    }
                  ],
                }
              ]
            }
          ]
        },
      },
    ]
  };
  const request = await playwright.request.newContext({ storageState });
  await request.get(server.EMPTY_PAGE);
  const exportedState = await request.storageState({ indexedDB: true, opfs: true });
  expect(exportedState).toEqual(storageState);
  await request.dispose();
});

it('should send cookies from storage state', async ({ playwright, server }) => {
  const expires = new Date('12/31/2099 PST');
  const storageState: StorageStateType = {
    'cookies': [
      {
        'name': 'a',
        'value': 'b',
        'domain': 'a.b.one.com',
        'path': '/',
        'expires': -1,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      },
      {
        'name': 'c',
        'value': 'd',
        'domain': '.b.one.com',
        'path': '/first/',
        'expires': +expires / 1000,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      },
      {
        'name': 'e',
        'value': 'f',
        'domain': '.b.one.com',
        'path': '/first/second',
        'expires': -1,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      }
    ],
    'origins': []
  };
  const request = await playwright.request.newContext({ storageState });
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/first/second/third/not_found.html'),
    request.get(`http://www.a.b.one.com:${server.PORT}/first/second/third/not_found.html`, {  __testHookLookup } as any)
  ]);
  expect(serverRequest.headers.cookie).toBe('c=d; e=f');
});

it('storage state should round-trip through file', async ({ playwright, server }, testInfo) => {
  const storageState: StorageStateType = {
    'cookies': [
      {
        'name': 'a',
        'value': 'b',
        'domain': 'a.b.one.com',
        'path': '/',
        'expires': -1,
        'httpOnly': false,
        'secure': false,
        'sameSite': 'Lax'
      }
    ],
    'origins': []
  };

  const request1 = await playwright.request.newContext({ storageState });
  const path = testInfo.outputPath('storage-state.json');
  const state1 = await request1.storageState({ path });
  expect(state1).toEqual(storageState);

  const written = await fs.promises.readFile(path, 'utf8');
  expect(JSON.stringify(state1, undefined, 2)).toBe(written);

  const request2 = await playwright.request.newContext({ storageState: path });
  const state2 = await request2.storageState();
  expect(state2).toEqual(storageState);
});

it('should work with empty storage state', async ({ playwright, server }, testInfo) => {
  const storageState = testInfo.outputPath('storage-state.json');
  await fs.promises.writeFile(storageState, '{}');
  const request1 = await playwright.request.newContext({ storageState });

  const state1 = await request1.storageState();
  expect(state1).toEqual({ cookies: [], origins: [] });
  await expect(await request1.get(server.EMPTY_PAGE)).toBeOK();
  await request1.dispose();
});

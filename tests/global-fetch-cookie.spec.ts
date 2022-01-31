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

import fs from 'fs';
import http from 'http';
import type { APIRequestContext } from 'playwright-core';
import { expect, playwrightTest } from './config/browserTest';

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

let prevAgent: http.Agent;
it.beforeAll(() => {
  prevAgent = http.globalAgent;
  http.globalAgent = new http.Agent({
    // @ts-expect-error
    lookup: (hostname, options, callback) => {
      if (hostname === 'localhost' || hostname.endsWith('one.com') || hostname.endsWith('two.com'))
        callback(null, '127.0.0.1', 4);
      else
        throw new Error(`Failed to resolve hostname: ${hostname}`);
    }
  });
});

it.afterAll(() => {
  http.globalAgent = prevAgent;
});

it('should store cookie from Set-Cookie header', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b', 'c=d; max-age=3600; domain=b.one.com; path=/input', 'e=f; domain=b.one.com; path=/input/subfolder']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/input/button.html'),
    request.get(`http://b.one.com:${server.PORT}/input/button.html`)
  ]);
  expect(serverRequest.headers.cookie).toBe('c=d');
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
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://www.b.one.com:${server.PORT}/empty.html`)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');

  const [serverRequest2] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://two.com:${server.PORT}/empty.html`)
  ]);
  expect(serverRequest2.headers.cookie).toBeFalsy();
});

it('should do case-insensitive match of cookie domain', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; domain=One.com', 'b=v; domain=.B.oNe.com']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://www.b.one.com:${server.PORT}/empty.html`)
  ]);
  expect(serverRequest.headers.cookie).toBe('a=v; b=v');
});

it('should do case-insensitive match of request domain', async ({ request, server }) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=v; domain=one.com', 'b=v; domain=.b.one.com']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`);
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(`http://WWW.B.ONE.COM:${server.PORT}/empty.html`)
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

it('should store cookie from Set-Cookie header even if it contains equal signs', async ({ request, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11612' });

  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['f=value == value=; secure; httpOnly; path=/some=value']);
    res.end();
  });

  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`);
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

it('should export cookies to storage state', async ({ request, server }) => {
  const expires = new Date('12/31/2100 PST');
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['a=b', `c=d; expires=${expires.toUTCString()}; domain=b.one.com; path=/input`, 'e=f; domain=b.one.com; path=/input/subfolder']);
    res.end();
  });
  await request.get(`http://a.b.one.com:${server.PORT}/setcookie.html`);
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

it('should preserve local storage on import/export of storage state', async ({ playwright, server }) => {
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
        }]
      },
    ]
  };
  const request = await playwright.request.newContext({ storageState });
  await request.get(server.EMPTY_PAGE);
  const exportedState = await request.storageState();
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
    request.get(`http://www.a.b.one.com:${server.PORT}/first/second/third/not_found.html`)
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

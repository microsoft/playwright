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

import http from 'http';
import { FetchRequest } from '../index';
import { expect, playwrightTest } from './config/browserTest';

export type GlobalFetchFixtures = {
   request: FetchRequest;
 };

const it = playwrightTest.extend<GlobalFetchFixtures>({
  request: async ({ playwright }, use) => {
    const request = await playwright._newRequest({ ignoreHTTPSErrors: true });
    await use(request);
    await request.dispose();
  },
});

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


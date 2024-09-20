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

import os from 'os';
import * as util from 'util';
import { getPlaywrightVersion } from '../../packages/playwright-core/lib/utils/userAgent';
import { expect, playwrightTest as base } from '../config/browserTest';
import { kTargetClosedErrorMessage } from 'tests/config/errors';

const it = base.extend({
  context: async ({}, use) => {
    throw new Error('global fetch tests should not use context');
  }
});

it.skip(({ mode }) => mode !== 'default');

for (const method of ['fetch', 'delete', 'get', 'head', 'patch', 'post', 'put'] as const) {
  it(`${method} should work @smoke`, async ({ playwright, server }) => {
    const request = await playwright.request.newContext();
    const response = await request[method](server.PREFIX + '/simple.json');
    expect(response.url()).toBe(server.PREFIX + '/simple.json');
    expect(response.status()).toBe(200);
    expect(response.statusText()).toBe('OK');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toBe('application/json; charset=utf-8');
    expect(response.headersArray()).toContainEqual({ name: 'Content-Type', value: 'application/json; charset=utf-8' });
    expect(await response.text()).toBe('head' === method ? '' : '{"foo": "bar"}\n');
    await request.dispose();
  });
}


it(`should dispose global request`, async function({ playwright, server }) {
  const request = await playwright.request.newContext();
  const response = await request.get(server.PREFIX + '/simple.json');
  expect(await response.json()).toEqual({ foo: 'bar' });
  await request.dispose();
  const error = await response.body().catch(e => e);
  expect(error.message).toContain('Response has been disposed');
  await request.dispose();
});

it('should support global userAgent option', async ({ playwright, server }) => {
  const request = await playwright.request.newContext({ userAgent: 'My Agent' });
  const [serverRequest, response] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  expect(response.ok()).toBeTruthy();
  expect(response.url()).toBe(server.EMPTY_PAGE);
  expect(serverRequest.headers['user-agent']).toBe('My Agent');
  await request.dispose();
});

it('should support global timeout option', async ({ playwright, server }) => {
  const request = await playwright.request.newContext({ timeout: 100 });
  server.setRoute('/empty.html', (req, res) => {});
  const error = await request.get(server.EMPTY_PAGE).catch(e => e);
  expect(error.message).toContain('Request timed out after 100ms');
  await request.dispose();
});

it('should propagate extra http headers with redirects', async ({ playwright, server }) => {
  server.setRedirect('/a/redirect1', '/b/c/redirect2');
  server.setRedirect('/b/c/redirect2', '/simple.json');
  const request = await playwright.request.newContext({ extraHTTPHeaders: { 'My-Secret': 'Value' } });
  const [req1, req2, req3] = await Promise.all([
    server.waitForRequest('/a/redirect1'),
    server.waitForRequest('/b/c/redirect2'),
    server.waitForRequest('/simple.json'),
    request.get(`${server.PREFIX}/a/redirect1`),
  ]);
  expect(req1.headers['my-secret']).toBe('Value');
  expect(req2.headers['my-secret']).toBe('Value');
  expect(req3.headers['my-secret']).toBe('Value');
  await request.dispose();
});

it('should support global httpCredentials option', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const request1 = await playwright.request.newContext();
  const response1 = await request1.get(server.EMPTY_PAGE);
  expect(response1.status()).toBe(401);
  await request1.dispose();

  const request2 = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass' } });
  const response2 = await request2.get(server.EMPTY_PAGE);
  expect(response2.status()).toBe(200);
  await request2.dispose();
});

it('should return error with wrong credentials', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'wrong' } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(401);
  await request.dispose();
});

it('should work with correct credentials and matching origin', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  await request.dispose();
});

it('should work with correct credentials and matching origin case insensitive', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX.toUpperCase() } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  await request.dispose();
});

it('should return error with correct credentials and mismatching scheme', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX.replace('http://', 'https://') } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(401);
  await request.dispose();
});

it('should return error with correct credentials and mismatching hostname', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const hostname = new URL(server.PREFIX).hostname;
  const origin = server.PREFIX.replace(hostname, 'mismatching-hostname');
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass', origin: origin } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(401);
  await request.dispose();
});

it('should return error with correct credentials and mismatching port', async ({ playwright, server }) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const origin = server.PREFIX.replace(server.PORT.toString(), (server.PORT + 1).toString());
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass', origin: origin } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(401);
  await request.dispose();
});

it('should support WWW-Authenticate: Basic', async ({ playwright, server }) => {
  let credentials;
  server.setRoute('/empty.html', (req, res) => {
    if (!req.headers.authorization) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic' });
      res.end('HTTP Error 401 Unauthorized: Access is denied');
      return;
    }
    credentials = Buffer.from((req.headers.authorization).split(' ')[1] || '', 'base64').toString();
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end();
  });
  const request = await playwright.request.newContext({ httpCredentials: { username: 'user', password: 'pass' } });
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  expect(credentials).toBe('user:pass');
  await request.dispose();
});

it('should support HTTPCredentials.send', async ({ playwright, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30534' });
  const request = await playwright.request.newContext({
    httpCredentials: { username: 'user', password: 'pass', origin: server.PREFIX.toUpperCase(), send: 'always' }
  });
  {
    const [serverRequest, response] = await Promise.all([
      server.waitForRequest('/empty.html'),
      request.get(server.EMPTY_PAGE)
    ]);
    expect(serverRequest.headers.authorization).toBe('Basic ' + Buffer.from('user:pass').toString('base64'));
    expect(response.status()).toBe(200);
  }
  {
    const [serverRequest, response] = await Promise.all([
      server.waitForRequest('/empty.html'),
      request.get(server.CROSS_PROCESS_PREFIX + '/empty.html')
    ]);
    // Not sent to another origin.
    expect(serverRequest.headers.authorization).toBe(undefined);
    expect(response.status()).toBe(200);
  }
  await request.dispose();
});

it('should support global ignoreHTTPSErrors option', async ({ playwright, httpsServer }) => {
  const request = await playwright.request.newContext({ ignoreHTTPSErrors: true });
  const response = await request.get(httpsServer.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  await request.dispose();
});

it('should propagate ignoreHTTPSErrors on redirects', async ({ playwright, httpsServer }) => {
  httpsServer.setRedirect('/redir', '/empty.html');
  const request = await playwright.request.newContext();
  const response = await request.get(httpsServer.PREFIX + '/redir', { ignoreHTTPSErrors: true });
  expect(response.status()).toBe(200);
  await request.dispose();
});

it('should resolve url relative to global baseURL option', async ({ playwright, server }) => {
  const request = await playwright.request.newContext({ baseURL: server.PREFIX });
  const response = await request.get('/empty.html');
  expect(response.url()).toBe(server.EMPTY_PAGE);
  await request.dispose();
});

it('should set playwright as user-agent', async ({ playwright, server, isWindows, isLinux, isMac }) => {
  const request = await playwright.request.newContext();
  const [serverRequest] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE)
  ]);
  const userAgentMasked = serverRequest.headers['user-agent']
      .replace(os.arch(), '<ARCH>')
      .replace(getPlaywrightVersion(), 'X.X.X')
      .replace(/\d+/g, 'X');

  const tokens = [];
  if (process.env.CI)
    tokens.push('CI/X');
  const suffix = tokens.length ? ` ${tokens.join(' ')}` : '';

  if (isWindows)
    expect(userAgentMasked).toBe('Playwright/X.X.X (<ARCH>; windows X.X) node/X.X' + suffix);
  else if (isLinux)
    // on ubuntu: distro is 'ubuntu' and version is 'X.X'
    // on manjaro: distro is 'Manjaro' and version is 'unknown'
    expect(userAgentMasked.replace(/<ARCH>; \w+ [^)]+/, '<ARCH>; distro version')).toBe('Playwright/X.X.X (<ARCH>; distro version) node/X.X' + suffix);
  else if (isMac)
    expect(userAgentMasked).toBe('Playwright/X.X.X (<ARCH>; macOS X.X) node/X.X' + suffix);
  await request.dispose();
});

it('should be able to construct with context options', async ({ playwright, browserType, server }) => {
  const request = await playwright.request.newContext((browserType as any)._defaultContextOptions);
  const response = await request.get(server.EMPTY_PAGE);
  expect(response.ok()).toBeTruthy();
  await request.dispose();
});

it('should return empty body', async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  const response = await request.get(server.EMPTY_PAGE);
  const body = await response.body();
  expect(body.length).toBe(0);
  expect(await response.text()).toBe('');
  await request.dispose();
});

it('should abort requests when context is disposed', async ({ playwright, server }) => {
  const connectionClosed = new Promise(resolve => {
    server.setRoute('/empty.html', req => req.socket.on('close', resolve));
  });
  const request = await playwright.request.newContext();
  const results = await Promise.all([
    request.get(server.EMPTY_PAGE).catch(e => e),
    request.post(server.EMPTY_PAGE).catch(e => e),
    request.delete(server.EMPTY_PAGE).catch(e => e),
    server.waitForRequest('/empty.html').then(() => request.dispose())
  ]);
  for (const result of results.slice(0, -1)) {
    expect(result instanceof Error).toBeTruthy();
    expect(result.message).toContain(kTargetClosedErrorMessage);
  }
  await connectionClosed;
  await request.dispose();
});

it('should abort redirected requests when context is disposed', async ({ playwright, server }) => {
  server.setRedirect('/redirect', '/test');
  const connectionClosed = new Promise(resolve => {
    server.setRoute('/test', req => req.socket.on('close', resolve));
  });
  const request = await playwright.request.newContext();
  const [result] = await Promise.all([
    request.get(server.PREFIX + '/redirect').catch(e => e),
    server.waitForRequest('/test').then(() => request.dispose())
  ]);
  expect(result instanceof Error).toBeTruthy();
  expect(result.message).toContain(kTargetClosedErrorMessage);
  await connectionClosed;
  await request.dispose();
});

it('should remove content-length from redirected post requests', async ({ playwright, server }) => {
  server.setRedirect('/redirect', '/empty.html');
  const request = await playwright.request.newContext();
  const [result, req1, req2] = await Promise.all([
    request.post(server.PREFIX + '/redirect', {
      data: {
        'foo': 'bar'
      }
    }),
    server.waitForRequest('/redirect'),
    server.waitForRequest('/empty.html')
  ]);
  expect(result.status()).toBe(200);
  expect(req1.headers['content-length']).toBe('13');
  expect(req2.headers['content-length']).toBe(undefined);
  await request.dispose();
});


const serialization: [string, any][] = [
  ['object', { 'foo': 'bar' }],
  ['array', ['foo', 'bar', 2021]],
  ['string', 'foo'],
  ['string (falsey)', ''],
  ['bool', true],
  ['bool (false)', false],
  ['number', 2021],
  ['number (falsey)', 0],
  ['null', null],
  ['literal string undefined', 'undefined'],
];
for (const [type, value] of serialization) {
  const stringifiedValue = JSON.stringify(value);
  it(`should json stringify ${type} body when content-type is application/json`, async ({ playwright, server }) => {
    const request = await playwright.request.newContext();
    const [req] = await Promise.all([
      server.waitForRequest('/empty.html'),
      request.post(server.EMPTY_PAGE, {
        headers: {
          'content-type': 'application/json'
        },
        data: value
      })
    ]);
    const body = await req.postBody;
    expect(body.toString()).toEqual(stringifiedValue);
    await request.dispose();
  });

  it(`should not double stringify ${type} body when content-type is application/json`, async ({ playwright, server }) => {
    const request = await playwright.request.newContext();
    const [req] = await Promise.all([
      server.waitForRequest('/empty.html'),
      request.post(server.EMPTY_PAGE, {
        headers: {
          'content-type': 'application/json'
        },
        data: stringifiedValue
      })
    ]);
    const body = await req.postBody;
    expect(body.toString()).toEqual(stringifiedValue);
    await request.dispose();
  });
}

it(`should accept already serialized data as Buffer when content-type is application/json`, async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  const value = JSON.stringify(JSON.stringify({ 'foo': 'bar' }));
  const [req] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.post(server.EMPTY_PAGE, {
      headers: {
        'content-type': 'application/json'
      },
      data: Buffer.from(value, 'utf8')
    })
  ]);
  const body = await req.postBody;
  expect(body.toString()).toEqual(value);
  await request.dispose();
});

it(`should have nice toString`, async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  const response = await request.post(server.EMPTY_PAGE, {
    headers: {
      'content-type': 'application/json'
    },
    data: 'My post data'
  });
  const str = response[util.inspect.custom]();
  expect(str).toContain('APIResponse: 200 OK');
  for (const { name, value } of response.headersArray())
    expect(str).toContain(`  ${name}: ${value}`);
  await request.dispose();
});

it('should not fail on empty body with encoding', async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  for (const method of ['head', 'put']) {
    for (const encoding of ['br', 'gzip', 'deflate']) {
      server.setRoute('/empty.html', (req, res) => {
        res.writeHead(200, {
          'Content-Encoding': encoding,
          'Content-Type': 'text/plain',
        });
        res.end();
      });
      const response = await request[method](server.EMPTY_PAGE);
      expect(response.status()).toBe(200);
      expect((await response.body()).length).toBe(0);
    }
  }
  await request.dispose();
});

it('should return body for failing requests', async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  for (const method of ['head', 'put', 'trace']) {
    server.setRoute('/empty.html', (req, res) => {
      res.writeHead(404, { 'Content-Length': 10, 'Content-Type': 'text/plain' });
      res.end('Not found.');
    });
    const response = await request.fetch(server.EMPTY_PAGE, { method });
    expect(response.status()).toBe(404);
    // HEAD response returns empty body in node http module.
    expect(await response.text()).toBe(method === 'head' ? '' : 'Not found.');
  }
  await request.dispose();
});

it('should throw an error when maxRedirects is exceeded', async ({ playwright, server }) => {
  server.setRedirect('/a/redirect1', '/b/c/redirect2');
  server.setRedirect('/b/c/redirect2', '/b/c/redirect3');
  server.setRedirect('/b/c/redirect3', '/b/c/redirect4');
  server.setRedirect('/b/c/redirect4', '/simple.json');

  const request = await playwright.request.newContext();
  for (const method of ['GET', 'PUT', 'POST', 'OPTIONS', 'HEAD', 'PATCH']) {
    for (const maxRedirects of [1, 2, 3])
      await expect(async () => request.fetch(`${server.PREFIX}/a/redirect1`, { method: method, maxRedirects: maxRedirects })).rejects.toThrow('Max redirect count exceeded');
  }
  await request.dispose();
});

it('should not follow redirects when maxRedirects is set to 0', async ({ playwright, server }) => {
  server.setRedirect('/a/redirect1', '/b/c/redirect2');
  server.setRedirect('/b/c/redirect2', '/simple.json');

  const request = await playwright.request.newContext();
  for (const method of ['GET', 'PUT', 'POST', 'OPTIONS', 'HEAD', 'PATCH']){
    const response = await request.fetch(`${server.PREFIX}/a/redirect1`, { method, maxRedirects: 0 });
    expect(response.headers()['location']).toBe('/b/c/redirect2');
    expect(response.status()).toBe(302);
  }
  await request.dispose();
});

it('should throw an error when maxRedirects is less than 0', async ({ playwright, server }) => {
  server.setRedirect('/a/redirect1', '/b/c/redirect2');
  server.setRedirect('/b/c/redirect2', '/simple.json');

  const request = await playwright.request.newContext();
  for (const method of ['GET', 'PUT', 'POST', 'OPTIONS', 'HEAD', 'PATCH'])
    await expect(async () => request.fetch(`${server.PREFIX}/a/redirect1`, { method, maxRedirects: -1 })).rejects.toThrow(`'maxRedirects' must be greater than or equal to '0'`);
  await request.dispose();
});

it('should keep headers capitalization', async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  const [serverRequest, response] = await Promise.all([
    server.waitForRequest('/empty.html'),
    request.get(server.EMPTY_PAGE, {
      headers: {
        'X-fOo': 'vaLUE',
      }
    }),
  ]);
  expect(response.ok()).toBeTruthy();
  expect(serverRequest.rawHeaders).toContain('X-fOo');
  expect(serverRequest.rawHeaders).toContain('vaLUE');
  await request.dispose();
});

it('should serialize post data on the client', async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  const serverReq = server.waitForRequest('/empty.html');
  let onStack: boolean = true;
  const postReq = request.post(server.EMPTY_PAGE, {
    data: {
      toJSON() {
        if (!onStack)
          throw new Error('Should not be called on the server');
        return { 'foo': 'bar' };
      }
    }
  });
  onStack = false;
  await postReq;
  const body = await (await serverReq).postBody;
  expect(body.toString()).toBe('{"foo":"bar"}');
  await request.dispose();
});

it('should throw after dispose', async ({ playwright, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27822' });
  const request = await playwright.request.newContext();
  await request.dispose();
  await expect(request.get(server.EMPTY_PAGE)).rejects.toThrow('Target page, context or browser has been closed');
});

it('should retry ECONNRESET', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30978' }
}, async ({ playwright, server }) => {
  const request = await playwright.request.newContext();
  let requestCount = 0;
  server.setRoute('/test', (req, res) => {
    if (requestCount++ < 3) {
      req.socket.destroy();
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Hello!');
  });
  const response = await request.fetch(server.PREFIX + '/test', { maxRetries: 3 });
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('Hello!');
  expect(requestCount).toBe(4);
  await request.dispose();
});

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

import formidable from 'formidable';
import http from 'http';
import zlib from 'zlib';
import fs from 'fs';
import { pipeline } from 'stream';
import { contextTest as it, expect } from './config/browserTest';
import { suppressCertificateWarning } from './config/utils';

it.skip(({ mode }) => mode !== 'default');

let prevAgent: http.Agent;
it.beforeAll(() => {
  prevAgent = http.globalAgent;
  http.globalAgent = new http.Agent({
    // @ts-expect-error
    lookup: (hostname, options, callback) => {
      if (hostname === 'localhost' || hostname.endsWith('playwright.dev'))
        callback(null, '127.0.0.1', 4);
      else
        throw new Error(`Failed to resolve hostname: ${hostname}`);
    }
  });
});

it.afterAll(() => {
  http.globalAgent = prevAgent;
});

it('global get should work', async ({playwright, context, server}) => {
  const request = await playwright._newRequest();
  const response = await request.get(server.PREFIX + '/simple.json');
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.status()).toBe(200);
  expect(response.statusText()).toBe('OK');
  expect(response.ok()).toBeTruthy();
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.headers()['content-type']).toBe('application/json; charset=utf-8');
  expect(response.headersArray()).toContainEqual({ name: 'Content-Type', value: 'application/json; charset=utf-8' });
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('get should work', async ({context, server}) => {
  const response = await context._request.get(server.PREFIX + '/simple.json');
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.status()).toBe(200);
  expect(response.statusText()).toBe('OK');
  expect(response.ok()).toBeTruthy();
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.headers()['content-type']).toBe('application/json; charset=utf-8');
  expect(response.headersArray()).toContainEqual({ name: 'Content-Type', value: 'application/json; charset=utf-8' });
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('fetch should work', async ({context, server}) => {
  const response = await context._request.fetch(server.PREFIX + '/simple.json');
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.status()).toBe(200);
  expect(response.statusText()).toBe('OK');
  expect(response.ok()).toBeTruthy();
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.headers()['content-type']).toBe('application/json; charset=utf-8');
  expect(response.headersArray()).toContainEqual({ name: 'Content-Type', value: 'application/json; charset=utf-8' });
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('should throw on network error', async ({context, server}) => {
  server.setRoute('/test', (req, res) => {
    req.socket.destroy();
  });
  const error = await context._request.get(server.PREFIX + '/test').catch(e => e);
  expect(error.message).toContain('socket hang up');
});

it('should throw on network error after redirect', async ({context, server}) => {
  server.setRedirect('/redirect', '/test');
  server.setRoute('/test', (req, res) => {
    req.socket.destroy();
  });
  const error = await context._request.get(server.PREFIX + '/redirect').catch(e => e);
  expect(error.message).toContain('socket hang up');
});

it('should throw on network error when sending body', async ({context, server}) => {
  server.setRoute('/test', (req, res) => {
    res.writeHead(200, {
      'content-length': 4096,
      'content-type': 'text/html',
    });
    res.write('<title>A');
    res.uncork();
    req.socket.destroy();
  });
  const error = await context._request.get(server.PREFIX + '/test').catch(e => e);
  expect(error.message).toContain('Error: aborted');
});

it('should throw on network error when sending body after redirect', async ({context, server}) => {
  server.setRedirect('/redirect', '/test');
  server.setRoute('/test', (req, res) => {
    res.writeHead(200, {
      'content-length': 4096,
      'content-type': 'text/html',
    });
    res.write('<title>A');
    res.uncork();
    req.socket.destroy();
  });
  const error = await context._request.get(server.PREFIX + '/redirect').catch(e => e);
  expect(error.message).toContain('Error: aborted');
});

it('should add session cookies to request', async ({context, server}) => {
  await context.addCookies([{
    name: 'username',
    value: 'John Doe',
    domain: '.my.playwright.dev',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);
  const [req] = await Promise.all([
    server.waitForRequest('/simple.json'),
    context._request.get(`http://www.my.playwright.dev:${server.PORT}/simple.json`),
  ]);
  expect(req.headers.cookie).toEqual('username=John Doe');
});

for (const method of ['get', 'post', 'fetch']) {
  it(`${method} should support queryParams`, async ({context, server}) => {
    let request;
    const url = new URL(server.EMPTY_PAGE);
    url.searchParams.set('p1', 'v1');
    url.searchParams.set('парам2', 'знач2');
    server.setRoute(url.pathname + url.search, (req, res) => {
      request = req;
      server.serveFile(req, res);
    });
    await context._request[method](server.EMPTY_PAGE + '?p1=foo', {
      params: {
        'p1': 'v1',
        'парам2': 'знач2',
      }
    });
    const params = new URLSearchParams(request.url.substr(request.url.indexOf('?')));
    expect(params.get('p1')).toEqual('v1');
    expect(params.get('парам2')).toEqual('знач2');
  });

  it(`${method} should support failOnStatusCode`, async ({context, server}) => {
    const error = await context._request[method](server.PREFIX + '/does-not-exist.html', {
      failOnStatusCode: true
    }).catch(e => e);
    expect(error.message).toContain('Request failed: 404 Not Found');
  });
}

it('should not add context cookie if cookie header passed as a parameter', async ({context, server}) => {
  await context.addCookies([{
    name: 'username',
    value: 'John Doe',
    domain: '.my.playwright.dev',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);
  const [req] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.get(`http://www.my.playwright.dev:${server.PORT}/empty.html`, {
      headers: {
        'Cookie': 'foo=bar'
      }
    }),
  ]);
  expect(req.headers.cookie).toEqual('foo=bar');
});

it('should follow redirects', async ({context, server}) => {
  server.setRedirect('/redirect1', '/redirect2');
  server.setRedirect('/redirect2', '/simple.json');
  await context.addCookies([{
    name: 'username',
    value: 'John Doe',
    domain: '.my.playwright.dev',
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }]);
  const [req, response] = await Promise.all([
    server.waitForRequest('/simple.json'),
    context._request.get(`http://www.my.playwright.dev:${server.PORT}/redirect1`),
  ]);
  expect(req.headers.cookie).toEqual('username=John Doe');
  expect(response.url()).toBe(`http://www.my.playwright.dev:${server.PORT}/simple.json`);
  expect(await response.json()).toEqual({foo: 'bar'});
});

it('should add cookies from Set-Cookie header', async ({context, page, server}) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['session=value', 'foo=bar; max-age=3600']);
    res.end();
  });
  await context._request.get(server.PREFIX + '/setcookie.html');
  const cookies = await context.cookies();
  expect(new Set(cookies.map(c => ({ name: c.name, value: c.value })))).toEqual(new Set([
    {
      name: 'session',
      value: 'value'
    },
    {
      name: 'foo',
      value: 'bar'
    },
  ]));
  await page.goto(server.EMPTY_PAGE);
  expect((await page.evaluate(() => document.cookie)).split(';').map(s => s.trim()).sort()).toEqual(['foo=bar', 'session=value']);
});

it('should not lose body while handling Set-Cookie header', async ({context, server}) => {
  server.setRoute('/setcookie.html', (req, res) => {
    res.setHeader('Set-Cookie', ['session=value', 'foo=bar; max-age=3600']);
    res.end('text content');
  });
  const response = await context._request.get(server.PREFIX + '/setcookie.html');
  expect(await response.text()).toBe('text content');
});

it('should handle cookies on redirects', async ({context, server, browserName, isWindows}) => {
  server.setRoute('/redirect1', (req, res) => {
    res.setHeader('Set-Cookie', 'r1=v1;SameSite=Lax');
    res.writeHead(301, { location: '/a/b/redirect2' });
    res.end();
  });
  server.setRoute('/a/b/redirect2', (req, res) => {
    res.setHeader('Set-Cookie', 'r2=v2;SameSite=Lax');
    res.writeHead(302, { location: '/title.html' });
    res.end();
  });
  {
    const [req1, req2, req3] = await Promise.all([
      server.waitForRequest('/redirect1'),
      server.waitForRequest('/a/b/redirect2'),
      server.waitForRequest('/title.html'),
      context._request.get(`${server.PREFIX}/redirect1`),
    ]);
    expect(req1.headers.cookie).toBeFalsy();
    expect(req2.headers.cookie).toBe('r1=v1');
    expect(req3.headers.cookie).toBe('r1=v1');
  }
  {
    const [req1, req2, req3] = await Promise.all([
      server.waitForRequest('/redirect1'),
      server.waitForRequest('/a/b/redirect2'),
      server.waitForRequest('/title.html'),
      context._request.get(`${server.PREFIX}/redirect1`),
    ]);
    expect(req1.headers.cookie).toBe('r1=v1');
    expect(req2.headers.cookie.split(';').map(s => s.trim()).sort()).toEqual(['r1=v1', 'r2=v2']);
    expect(req3.headers.cookie).toBe('r1=v1');
  }
  const cookies = await context.cookies();
  expect(new Set(cookies)).toEqual(new Set([
    {
      'sameSite': (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
      'name': 'r2',
      'value': 'v2',
      'domain': 'localhost',
      'path': '/a/b',
      'expires': -1,
      'httpOnly': false,
      'secure': false
    },
    {
      'sameSite': (browserName === 'webkit' && isWindows) ? 'None' : 'Lax',
      'name': 'r1',
      'value': 'v1',
      'domain': 'localhost',
      'path': '/',
      'expires': -1,
      'httpOnly': false,
      'secure': false
    }
  ]));
});

it('should return raw headers', async ({context, page, server}) => {
  server.setRoute('/headers', (req, res) => {
    // Headers array is only supported since Node v14.14.0 so we write directly to the socket.
    // res.writeHead(200, ['name-a', 'v1','name-b', 'v4','Name-a', 'v2', 'name-A', 'v3']);
    const conn = res.connection;
    conn.write('HTTP/1.1 200 OK\r\n');
    conn.write('Name-A: v1\r\n');
    conn.write('name-b: v4\r\n');
    conn.write('Name-a: v2\r\n');
    conn.write('name-A: v3\r\n');
    conn.write('\r\n');
    conn.uncork();
    conn.end();
  });
  const response = await context._request.get(`${server.PREFIX}/headers`);
  expect(response.status()).toBe(200);
  const headers = response.headersArray().filter(({ name }) => name.toLowerCase().includes('name-'));
  expect(headers).toEqual([{ name: 'Name-A', value: 'v1' }, { name: 'name-b', value: 'v4' }, { name: 'Name-a', value: 'v2' }, { name: 'name-A', value: 'v3' }]);
  // Comma separated values, this matches Response.headers()
  expect(response.headers()['name-a']).toBe('v1, v2, v3');
  expect(response.headers()['name-b']).toBe('v4');
});

it('should work with context level proxy', async ({browserOptions, browserType, contextOptions, server, proxyServer}) => {
  server.setRoute('/target.html', async (req, res) => {
    res.end('<title>Served by the proxy</title>');
  });

  const browser = await browserType.launch({
    ...browserOptions,
    proxy: { server: 'http://per-context' }
  });

  try {
    proxyServer.forwardTo(server.PORT);
    const context = await browser.newContext({
      ...contextOptions,
      proxy: { server: `localhost:${proxyServer.PORT}` }
    });

    const [request, response] = await Promise.all([
      server.waitForRequest('/target.html'),
      context._request.get(`http://non-existent.com/target.html`)
    ]);
    expect(response.status()).toBe(200);
    expect(request.url).toBe('/target.html');
  } finally {
    await browser.close();
  }
});

it('should pass proxy credentials', async ({browserType, browserOptions, server, proxyServer}) => {
  proxyServer.forwardTo(server.PORT);
  let auth;
  proxyServer.setAuthHandler(req => {
    auth = req.headers['proxy-authorization'];
    return !!auth;
  });
  const browser = await browserType.launch({
    ...browserOptions,
    proxy: { server: `localhost:${proxyServer.PORT}`, username: 'user', password: 'secret' }
  });
  const context = await browser.newContext();
  const response = await context._request.get('http://non-existent.com/simple.json');
  expect(proxyServer.connectHosts).toContain('non-existent.com:80');
  expect(auth).toBe('Basic ' + Buffer.from('user:secret').toString('base64'));
  expect(await response.json()).toEqual({foo: 'bar'});
  await browser.close();
});

it('should work with http credentials', async ({context, server}) => {
  server.setAuth('/empty.html', 'user', 'pass');

  const [request, response] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.get(server.EMPTY_PAGE, {
      headers: {
        'authorization': 'Basic ' + Buffer.from('user:pass').toString('base64')
      }
    })
  ]);
  expect(response.status()).toBe(200);
  expect(request.url).toBe('/empty.html');
});

it('should work with setHTTPCredentials', async ({context, server}) => {
  server.setAuth('/empty.html', 'user', 'pass');
  const response1 = await context._request.get(server.EMPTY_PAGE);
  expect(response1.status()).toBe(401);

  await context.setHTTPCredentials({ username: 'user', password: 'pass' });
  const response2 = await context._request.get(server.EMPTY_PAGE);
  expect(response2.status()).toBe(200);
});

it('should return error with wrong credentials', async ({context, server}) => {
  server.setAuth('/empty.html', 'user', 'pass');
  await context.setHTTPCredentials({ username: 'user', password: 'wrong' });
  const response2 = await context._request.get(server.EMPTY_PAGE);
  expect(response2.status()).toBe(401);
});

it('should support post data', async ({context, server}) => {
  const [request, response] = await Promise.all([
    server.waitForRequest('/simple.json'),
    context._request.post(`${server.PREFIX}/simple.json`, {
      data: 'My request'
    })
  ]);
  expect(request.method).toBe('POST');
  expect((await request.postBody).toString()).toBe('My request');
  expect(response.status()).toBe(200);
  expect(request.url).toBe('/simple.json');
});

it('should add default headers', async ({context, server, page}) => {
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.get(server.EMPTY_PAGE)
  ]);
  expect(request.headers['accept']).toBe('*/*');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  expect(request.headers['user-agent']).toBe(userAgent);
  expect(request.headers['accept-encoding']).toBe('gzip,deflate,br');
});

it('should add default headers to redirects', async ({context, server, page}) => {
  server.setRedirect('/redirect', '/empty.html');
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.get(`${server.PREFIX}/redirect`)
  ]);
  expect(request.headers['accept']).toBe('*/*');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  expect(request.headers['user-agent']).toBe(userAgent);
  expect(request.headers['accept-encoding']).toBe('gzip,deflate,br');
});

it('should allow to override default headers', async ({context, server, page}) => {
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.get(server.EMPTY_PAGE, {
      headers: {
        'User-Agent': 'Playwright',
        'Accept': 'text/html',
        'Accept-Encoding': 'br'
      }
    })
  ]);
  expect(request.headers['accept']).toBe('text/html');
  expect(request.headers['user-agent']).toBe('Playwright');
  expect(request.headers['accept-encoding']).toBe('br');
});

it('should propagate custom headers with redirects', async ({context, server}) => {
  server.setRedirect('/a/redirect1', '/b/c/redirect2');
  server.setRedirect('/b/c/redirect2', '/simple.json');
  const [req1, req2, req3] = await Promise.all([
    server.waitForRequest('/a/redirect1'),
    server.waitForRequest('/b/c/redirect2'),
    server.waitForRequest('/simple.json'),
    context._request.get(`${server.PREFIX}/a/redirect1`, {headers: {'foo': 'bar'}}),
  ]);
  expect(req1.headers['foo']).toBe('bar');
  expect(req2.headers['foo']).toBe('bar');
  expect(req3.headers['foo']).toBe('bar');
});

it('should propagate extra http headers with redirects', async ({context, server}) => {
  server.setRedirect('/a/redirect1', '/b/c/redirect2');
  server.setRedirect('/b/c/redirect2', '/simple.json');
  await context.setExtraHTTPHeaders({ 'My-Secret': 'Value' });
  const [req1, req2, req3] = await Promise.all([
    server.waitForRequest('/a/redirect1'),
    server.waitForRequest('/b/c/redirect2'),
    server.waitForRequest('/simple.json'),
    context._request.get(`${server.PREFIX}/a/redirect1`),
  ]);
  expect(req1.headers['my-secret']).toBe('Value');
  expect(req2.headers['my-secret']).toBe('Value');
  expect(req3.headers['my-secret']).toBe('Value');
});

it('should throw on invalid header value', async ({context, server}) => {
  const error = await context._request.get(`${server.PREFIX}/a/redirect1`, {
    headers: {
      'foo': 'недопустимое значение',
    }
  }).catch(e => e);
  expect(error.message).toContain('Invalid character in header content');
});

it('should throw on non-http(s) protocol', async ({context}) => {
  const error1 = await context._request.get(`data:text/plain,test`).catch(e => e);
  expect(error1.message).toContain('Protocol "data:" not supported');
  const error2 = await context._request.get(`file:///tmp/foo`).catch(e => e);
  expect(error2.message).toContain('Protocol "file:" not supported');
});

it('should support https', async ({context, httpsServer}) => {
  const oldValue = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
  // https://stackoverflow.com/a/21961005/552185
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  suppressCertificateWarning();
  try {
    const response = await context._request.get(httpsServer.EMPTY_PAGE);
    expect(response.status()).toBe(200);
  } finally {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = oldValue;
  }
});

it('should support ignoreHTTPSErrors', async ({contextFactory, contextOptions, httpsServer}) => {
  const context = await contextFactory({ ...contextOptions, ignoreHTTPSErrors: true });
  const response = await context._request.get(httpsServer.EMPTY_PAGE);
  expect(response.status()).toBe(200);
});

it('should resolve url relative to baseURL', async function({server, contextFactory, contextOptions}) {
  const context = await contextFactory({
    ...contextOptions,
    baseURL: server.PREFIX,
  });
  const response = await context._request.get('/empty.html');
  expect(response.url()).toBe(server.EMPTY_PAGE);
});

it('should support gzip compression', async function({context, server}) {
  server.setRoute('/compressed', (req, res) => {
    res.writeHead(200, {
      'Content-Encoding': 'gzip',
      'Content-Type': 'text/plain',
    });

    const gzip = zlib.createGzip();
    pipeline(gzip, res, err => {
      if (err)
        console.log(`Server error: ${err}`);
    });
    gzip.write('Hello, world!');
    gzip.end();
  });

  const response = await context._request.get(server.PREFIX + '/compressed');
  expect(await response.text()).toBe('Hello, world!');
});

it('should throw informatibe error on corrupted gzip body', async function({context, server}) {
  server.setRoute('/corrupted', (req, res) => {
    res.writeHead(200, {
      'Content-Encoding': 'gzip',
      'Content-Type': 'text/plain',
    });
    res.write('Hello, world!');
    res.end();
  });

  const error = await context._request.get(server.PREFIX + '/corrupted').catch(e => e);
  expect(error.message).toContain(`failed to decompress 'gzip' encoding`);
});

it('should support brotli compression', async function({context, server}) {
  server.setRoute('/compressed', (req, res) => {
    res.writeHead(200, {
      'Content-Encoding': 'br',
      'Content-Type': 'text/plain',
    });

    const brotli = zlib.createBrotliCompress();
    pipeline(brotli, res, err => {
      if (err)
        console.log(`Server error: ${err}`);
    });
    brotli.write('Hello, world!');
    brotli.end();
  });

  const response = await context._request.get(server.PREFIX + '/compressed');
  expect(await response.text()).toBe('Hello, world!');
});

it('should throw informatibe error on corrupted brotli body', async function({context, server}) {
  server.setRoute('/corrupted', (req, res) => {
    res.writeHead(200, {
      'Content-Encoding': 'br',
      'Content-Type': 'text/plain',
    });
    res.write('Hello, world!');
    res.end();
  });

  const error = await context._request.get(server.PREFIX + '/corrupted').catch(e => e);
  expect(error.message).toContain(`failed to decompress 'br' encoding`);
});

it('should support deflate compression', async function({context, server}) {
  server.setRoute('/compressed', (req, res) => {
    res.writeHead(200, {
      'Content-Encoding': 'deflate',
      'Content-Type': 'text/plain',
    });

    const deflate = zlib.createDeflate();
    pipeline(deflate, res, err => {
      if (err)
        console.log(`Server error: ${err}`);
    });
    deflate.write('Hello, world!');
    deflate.end();
  });

  const response = await context._request.get(server.PREFIX + '/compressed');
  expect(await response.text()).toBe('Hello, world!');
});

it('should throw informatibe error on corrupted deflate body', async function({context, server}) {
  server.setRoute('/corrupted', (req, res) => {
    res.writeHead(200, {
      'Content-Encoding': 'deflate',
      'Content-Type': 'text/plain',
    });
    res.write('Hello, world!');
    res.end();
  });

  const error = await context._request.get(server.PREFIX + '/corrupted').catch(e => e);
  expect(error.message).toContain(`failed to decompress 'deflate' encoding`);
});

it('should support timeout option', async function({context, server}) {
  server.setRoute('/slow', (req, res) => {
    res.writeHead(200, {
      'content-length': 4096,
      'content-type': 'text/html',
    });
  });

  const error = await context._request.get(server.PREFIX + '/slow', { timeout: 10 }).catch(e => e);
  expect(error.message).toContain(`Request timed out after 10ms`);
});

it('should respect timeout after redirects', async function({context, server}) {
  server.setRedirect('/redirect', '/slow');
  server.setRoute('/slow', (req, res) => {
    res.writeHead(200, {
      'content-length': 4096,
      'content-type': 'text/html',
    });
  });

  context.setDefaultTimeout(100);
  const error = await context._request.get(server.PREFIX + '/redirect').catch(e => e);
  expect(error.message).toContain(`Request timed out after 100ms`);
});

it('should dispose', async function({context, server}) {
  const response = await context._request.get(server.PREFIX + '/simple.json');
  expect(await response.json()).toEqual({ foo: 'bar' });
  await response.dispose();
  const error = await response.body().catch(e => e);
  expect(error.message).toContain('Response has been disposed');
});

it('should dispose when context closes', async function({context, server}) {
  const response = await context._request.get(server.PREFIX + '/simple.json');
  expect(await response.json()).toEqual({ foo: 'bar' });
  await context.close();
  const error = await response.body().catch(e => e);
  expect(error.message).toContain('Response has been disposed');
});

it('should dispose global request', async function({playwright, context, server}) {
  const request = await playwright._newRequest();
  const response = await request.get(server.PREFIX + '/simple.json');
  expect(await response.json()).toEqual({ foo: 'bar' });
  await request.dispose();
  const error = await response.body().catch(e => e);
  expect(error.message).toContain('Response has been disposed');
});

it('should throw on invalid first argument', async function({context}) {
  const error = await context._request.get({} as any).catch(e => e);
  expect(error.message).toContain('First argument must be either URL string or Request');
});

it('should override request parameters', async function({context, page, server}) {
  const [pageReq] = await Promise.all([
    page.waitForRequest('**/*'),
    page.goto(server.EMPTY_PAGE)
  ]);
  const [req] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.post(pageReq, {
      headers: {
        'foo': 'bar'
      },
      data: 'data'
    })
  ]);
  expect(req.method).toBe('POST');
  expect(req.headers.foo).toBe('bar');
  expect((await req.postBody).toString('utf8')).toBe('data');
});

it('should support application/x-www-form-urlencoded', async function({context, page, server}) {
  const [req] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.post(server.EMPTY_PAGE, {
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      data: {
        firstName: 'John',
        lastName: 'Doe',
        file: 'f.js',
      }
    })
  ]);
  expect(req.method).toBe('POST');
  expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
  const body = (await req.postBody).toString('utf8');
  const params = new URLSearchParams(body);
  expect(params.get('firstName')).toBe('John');
  expect(params.get('lastName')).toBe('Doe');
  expect(params.get('file')).toBe('f.js');
});

it('should encode to application/json by default', async function({context, page, server}) {
  const data = {
    firstName: 'John',
    lastName: 'Doe',
    file: {
      name: 'f.js'
    },
  };
  const [req] = await Promise.all([
    server.waitForRequest('/empty.html'),
    context._request.post(server.EMPTY_PAGE, { data })
  ]);
  expect(req.method).toBe('POST');
  expect(req.headers['content-type']).toBe('application/json');
  const body = (await req.postBody).toString('utf8');
  const json = JSON.parse(body);
  expect(json).toEqual(data);
});

it('should support multipart/form-data', async function({context, page, server}) {
  const formReceived = new Promise<any>(resolve => {
    server.setRoute('/empty.html', async (serverRequest, res) => {
      const form = new formidable.IncomingForm();
      form.parse(serverRequest, (error, fields, files) => {
        server.serveFile(serverRequest, res);
        resolve({error, fields, files, serverRequest });
      });
    });
  });

  const file = {
    name: 'f.js',
    mimeType: 'text/javascript',
    buffer: Buffer.from('var x = 10;\r\n;console.log(x);')
  };
  const [{error, fields, files, serverRequest}, response] = await Promise.all([
    formReceived,
    context._request.post(server.EMPTY_PAGE, {
      headers: {
        'content-type': 'multipart/form-data'
      },
      data: {
        firstName: 'John',
        lastName: 'Doe',
        file
      }
    })
  ]);
  expect(error).toBeFalsy();
  expect(serverRequest.method).toBe('POST');
  expect(serverRequest.headers['content-type']).toContain('multipart/form-data');
  expect(fields['firstName']).toBe('John');
  expect(fields['lastName']).toBe('Doe');
  expect(files['file'].name).toBe(file.name);
  expect(files['file'].type).toBe(file.mimeType);
  expect(fs.readFileSync(files['file'].path).toString()).toBe(file.buffer.toString('utf8'));
  expect(response.status()).toBe(200);
});

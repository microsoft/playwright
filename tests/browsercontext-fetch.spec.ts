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
import zlib from 'zlib';
import { pipeline } from 'stream';
import { contextTest as it, expect } from './config/browserTest';

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

it('should work', async ({context, server}) => {
  // @ts-expect-error
  const response = await context._fetch(server.PREFIX + '/simple.json');
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.status()).toBe(200);
  expect(response.statusText()).toBe('OK');
  expect(response.ok()).toBeTruthy();
  expect(response.url()).toBe(server.PREFIX + '/simple.json');
  expect(response.headers()['content-type']).toBe('application/json; charset=utf-8');
  expect(await response.text()).toBe('{"foo": "bar"}\n');
});

it('should throw on network error', async ({context, server}) => {
  server.setRoute('/test', (req, res) => {
    req.socket.destroy();
  });
  let error;
  // @ts-expect-error
  await context._fetch(server.PREFIX + '/test').catch(e => error = e);
  expect(error.message).toContain('socket hang up');
});

it('should throw on network error after redirect', async ({context, server}) => {
  server.setRedirect('/redirect', '/test');
  server.setRoute('/test', (req, res) => {
    req.socket.destroy();
  });
  let error;
  // @ts-expect-error
  await context._fetch(server.PREFIX + '/redirect').catch(e => error = e);
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
  let error;
  // @ts-expect-error
  await context._fetch(server.PREFIX + '/test').catch(e => error = e);
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
  let error;
  // @ts-expect-error
  await context._fetch(server.PREFIX + '/redirect').catch(e => error = e);
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
    // @ts-expect-error
    context._fetch(`http://www.my.playwright.dev:${server.PORT}/simple.json`),
  ]);
  expect(req.headers.cookie).toEqual('username=John Doe');
});

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
    // @ts-expect-error
    context._fetch(`http://www.my.playwright.dev:${server.PORT}/empty.html`, {
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
    // @ts-expect-error
    context._fetch(`http://www.my.playwright.dev:${server.PORT}/redirect1`),
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
  // @ts-expect-error
  await context._fetch(server.PREFIX + '/setcookie.html');
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
      // @ts-expect-error
      context._fetch(`${server.PREFIX}/redirect1`),
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
      // @ts-expect-error
      context._fetch(`${server.PREFIX}/redirect1`),
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
      // @ts-expect-error
      context._fetch(`http://non-existent.com/target.html`)
    ]);
    expect(response.status()).toBe(200);
    expect(request.url).toBe('/target.html');
  } finally {
    await browser.close();
  }
});

it('should work with http credentials', async ({context, server}) => {
  server.setAuth('/empty.html', 'user', 'pass');

  const [request, response] = await Promise.all([
    server.waitForRequest('/empty.html'),
    // @ts-expect-error
    context._fetch(server.EMPTY_PAGE, {
      headers: {
        'authorization': 'Basic ' + Buffer.from('user:pass').toString('base64')
      }
    })
  ]);
  expect(response.status()).toBe(200);
  expect(request.url).toBe('/empty.html');
});

it('should work with setHTTPCredentials', async ({context, browser, server}) => {
  server.setAuth('/empty.html', 'user', 'pass');
  // @ts-expect-error
  const response1 = await context._fetch(server.EMPTY_PAGE);
  expect(response1.status()).toBe(401);

  await context.setHTTPCredentials({ username: 'user', password: 'pass' });
  // @ts-expect-error
  const response2 = await context._fetch(server.EMPTY_PAGE);
  expect(response2.status()).toBe(200);
});

it('should return error with wrong credentials', async ({context, browser, server}) => {
  server.setAuth('/empty.html', 'user', 'pass');
  await context.setHTTPCredentials({ username: 'user', password: 'wrong' });
  // @ts-expect-error
  const response2 = await context._fetch(server.EMPTY_PAGE);
  expect(response2.status()).toBe(401);
});

it('should support post data', async ({context, server}) => {
  const [request, response] = await Promise.all([
    server.waitForRequest('/simple.json'),
    // @ts-expect-error
    context._fetch(`${server.PREFIX}/simple.json`, {
      method: 'POST',
      postData: 'My request'
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
    // @ts-expect-error
    context._fetch(server.EMPTY_PAGE)
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
    // @ts-expect-error
    context._fetch(`${server.PREFIX}/redirect`)
  ]);
  expect(request.headers['accept']).toBe('*/*');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  expect(request.headers['user-agent']).toBe(userAgent);
  expect(request.headers['accept-encoding']).toBe('gzip,deflate,br');
});

it('should allow to override default headers', async ({context, server, page}) => {
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    // @ts-expect-error
    context._fetch(server.EMPTY_PAGE, {
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
    // @ts-expect-error
    context._fetch(`${server.PREFIX}/a/redirect1`, {headers: {'foo': 'bar'}}),
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
    // @ts-expect-error
    context._fetch(`${server.PREFIX}/a/redirect1`),
  ]);
  expect(req1.headers['my-secret']).toBe('Value');
  expect(req2.headers['my-secret']).toBe('Value');
  expect(req3.headers['my-secret']).toBe('Value');
});

it('should throw on invalid header value', async ({context, server}) => {
  // @ts-expect-error
  const error = await context._fetch(`${server.PREFIX}/a/redirect1`, {
    headers: {
      'foo': 'недопустимое значение',
    }
  }).catch(e => e);
  expect(error.message).toContain('Invalid character in header content');
});

it('should throw on non-http(s) protocol', async ({context}) => {
  // @ts-expect-error
  const error1 = await context._fetch(`data:text/plain,test`).catch(e => e);
  expect(error1.message).toContain('Protocol "data:" not supported');
  // @ts-expect-error
  const error2 = await context._fetch(`file:///tmp/foo`).catch(e => e);
  expect(error2.message).toContain('Protocol "file:" not supported');
});

it('should support https', async ({context, httpsServer}) => {
  const oldValue = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
  // https://stackoverflow.com/a/21961005/552185
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
  try {
    // @ts-expect-error
    const response = await context._fetch(httpsServer.EMPTY_PAGE);
    expect(response.status()).toBe(200);
  } finally {
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = oldValue;
  }
});

it('should resolve url relative to baseURL', async function({browser, server, contextFactory, contextOptions}) {
  const context = await contextFactory({
    ...contextOptions,
    baseURL: server.PREFIX,
  });
  // @ts-expect-error
  const response = await context._fetch('/empty.html');
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

  // @ts-expect-error
  const response = await context._fetch(server.PREFIX + '/compressed');
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

  // @ts-expect-error
  const error = await context._fetch(server.PREFIX + '/corrupted').catch(e => e);
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

  // @ts-expect-error
  const response = await context._fetch(server.PREFIX + '/compressed');
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

  // @ts-expect-error
  const error = await context._fetch(server.PREFIX + '/corrupted').catch(e => e);
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

  // @ts-expect-error
  const response = await context._fetch(server.PREFIX + '/compressed');
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

  // @ts-expect-error
  const error = await context._fetch(server.PREFIX + '/corrupted').catch(e => e);
  expect(error.message).toContain(`failed to decompress 'deflate' encoding`);
});


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

import { fail } from 'assert';
import os from 'os';
import type { Route, Response } from 'playwright-core';
import { expect, test as it } from './pageTest';

it('should fulfill intercepted response', async ({ page, server, browserName }) => {
  await page.route('**/*', async route => {
    // @ts-expect-error
    await route._continueToResponse({});
    await route.fulfill({
      status: 201,
      headers: {
        foo: 'bar'
      },
      contentType: 'text/plain',
      body: 'Yo, page!'
    });
  });
  const response = await page.goto(server.PREFIX + '/empty.html');
  expect(response.status()).toBe(201);
  expect(response.headers().foo).toBe('bar');
  expect(response.headers()['content-type']).toBe('text/plain');
  expect(await page.evaluate(() => document.body.textContent)).toBe('Yo, page!');
});

it('should fulfill response with empty body', async ({ page, server, browserName, browserMajorVersion }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion <= 91, 'Fails in Electron that uses old Chromium');
  await page.route('**/*', async route => {
    // @ts-expect-error
    const response = await route._continueToResponse({});
    await route.fulfill({
      response,
      status: 201,
      body: ''
    });
  });
  const response = await page.goto(server.PREFIX + '/title.html');
  expect(response.status()).toBe(201);
  expect(await response.text()).toBe('');
});

it('should override with defaults when intercepted response not provided', async ({ page, server, browserName, browserMajorVersion }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion <= 91, 'Fails in Electron that uses old Chromium');
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('foo', 'bar');
    res.end('my content');
  });
  await page.route('**/*', async route => {
    // @ts-expect-error
    await route._continueToResponse({});
    await route.fulfill({
      status: 201,
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(201);
  expect(await response.text()).toBe('');
  if (browserName === 'webkit')
    expect(response.headers()).toEqual({ 'content-type': 'text/plain' });
  else
    expect(response.headers()).toEqual({ });
});

it('should fulfill with any response', async ({ page, server, browserName, browserMajorVersion, isLinux }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion <= 91, 'Fails in Electron that uses old Chromium');

  server.setRoute('/sample', (req, res) => {
    res.setHeader('foo', 'bar');
    res.end('Woo-hoo');
  });
  const page2 = await page.context().newPage();
  const sampleResponse = await page2.goto(`${server.PREFIX}/sample`);

  await page.route('**/*', async route => {
    // @ts-expect-error
    await route._continueToResponse({});
    await route.fulfill({
      // @ts-expect-error
      response: sampleResponse,
      status: 201,
      contentType: 'text/plain'
    });
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.status()).toBe(201);
  expect(await response.text()).toBe('Woo-hoo');
  expect(response.headers()['foo']).toBe('bar');
});

it('should throw on continue after intercept', async ({ page, server, browserName }) => {
  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route('**', routeCallback);

  page.goto(server.EMPTY_PAGE).catch(e => {});
  const route = await routePromise;
  // @ts-expect-error
  await route._continueToResponse();
  try {
    await route.continue();
    fail('did not throw');
  } catch (e) {
    expect(e.message).toContain('Cannot call continue after response interception!');
  }
});

it('should support fulfill after intercept', async ({ page, server }) => {
  const requestPromise = server.waitForRequest('/title.html');
  await page.route('**', async route => {
    // @ts-expect-error
    const response = await route._continueToResponse();
    await route.fulfill({ response });
  });
  const response = await page.goto(server.PREFIX + '/title.html');
  const request = await requestPromise;
  expect(request.url).toBe('/title.html');
  expect(await response.text()).toBe('<title>Woof-Woof</title>' + os.EOL);
});

it('should intercept failures', async ({ page, browserName, browserMajorVersion, server }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion <= 91, 'Fails in Electron that uses old Chromium');
  server.setRoute('/title.html', (req, res) => {
    req.destroy();
  });
  const requestPromise = server.waitForRequest('/title.html');
  let error;
  await page.route('**', async route => {
    try {
      // @ts-expect-error
      const response = await route._continueToResponse();
      await route.fulfill({ response });
    } catch (e) {
      error = e;
    }
  });
  const [request] = await Promise.all([
    requestPromise,
    page.goto(server.PREFIX + '/title.html').catch(e => {})
  ]);
  expect(error).toBeTruthy();
  expect(error.message).toContain('Request failed');
  expect(request.url).toBe('/title.html');
});

it('should support request overrides', async ({ page, server, browserName, browserMajorVersion }) => {
  it.skip(browserName === 'chromium' && browserMajorVersion <= 91, 'Fails in Electron that uses old Chromium');
  const requestPromise = server.waitForRequest('/empty.html');
  await page.route('**/foo', async route => {
    // @ts-expect-error
    const response = await route._continueToResponse({
      url: server.EMPTY_PAGE,
      method: 'POST',
      headers: { 'foo': 'bar' },
      postData: 'my data',
    });
    await route.fulfill({ response });
  });
  await page.goto(server.PREFIX + '/foo');
  const request = await requestPromise;
  expect(request.method).toBe('POST');
  expect(request.url).toBe('/empty.html');
  expect(request.headers['foo']).toBe('bar');
  expect((await request.postBody).toString('utf8')).toBe('my data');
});

it('should give access to the intercepted response', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);

  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route('**/title.html', routeCallback);

  const evalPromise = page.evaluate(url => fetch(url), server.PREFIX + '/title.html');

  const route = await routePromise;
  // @ts-expect-error
  const response: Response = await route._continueToResponse();

  expect(response.status()).toBe(200);
  expect(response.ok()).toBeTruthy();
  expect(response.url()).toBe(server.PREFIX + '/title.html');
  expect(response.headers()['content-type']).toBe('text/html; charset=utf-8');
  expect((await response.allHeaders())['content-type']).toBe('text/html; charset=utf-8');
  expect(await (await response.headersArray()).filter(({ name }) => name.toLowerCase() === 'content-type')).toEqual([{ name: 'Content-Type', value: 'text/html; charset=utf-8' }]);

  // @ts-expect-error
  await Promise.all([route.fulfill({ response }), evalPromise]);
});

it('should give access to the intercepted response status text', async ({ page, server, browserName }) => {
  it.fail(browserName === 'chromium', 'Status line is not reported for intercepted responses');
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/title.html', (req, res) => {
    res.statusCode = 200;
    res.statusMessage = 'You are awesome';
    res.setHeader('Content-Type', 'text/plain');
    res.end();
  });
  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route('**/title.html', routeCallback);
  const evalPromise = page.evaluate(url => fetch(url), server.PREFIX + '/title.html');
  const route = await routePromise;
  // @ts-expect-error
  const response = await route._continueToResponse();

  expect(response.statusText()).toBe('You are awesome');
  expect(response.url()).toBe(server.PREFIX + '/title.html');

  await Promise.all([route.fulfill({ response }), evalPromise]);
});

it('should give access to the intercepted response body', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);

  let routeCallback;
  const routePromise = new Promise<Route>(f => routeCallback = f);
  await page.route('**/simple.json', routeCallback);

  const evalPromise = page.evaluate(url => fetch(url), server.PREFIX + '/simple.json').catch(console.log);

  const route = await routePromise;
  // @ts-expect-error
  const response = await route._continueToResponse();

  expect((await response.text())).toBe('{"foo": "bar"}\n');

  await Promise.all([route.fulfill({ response }), evalPromise]);
});

it('should be abortable after interception', async ({ page, server, browserName }) => {
  await page.route(/\.css$/, async route => {
    // @ts-expect-error
    await route._continueToResponse();
    await route.abort();
  });
  let failed = false;
  page.on('requestfailed', request => {
    if (request.url().includes('.css'))
      failed = true;
  });
  const response = await page.goto(server.PREFIX + '/one-style.html');
  expect(response.ok()).toBe(true);
  expect(response.request().failure()).toBe(null);
  expect(failed).toBe(true);
});

it('should fulfill after redirects', async ({ page, server, browserName }) => {
  server.setRedirect('/redirect/1.html', '/redirect/2.html');
  server.setRedirect('/redirect/2.html', '/empty.html');
  const expectedUrls = ['/redirect/1.html', '/redirect/2.html', '/empty.html'].map(s => server.PREFIX + s);
  const requestUrls = [];
  const responseUrls = [];
  const requestFinishedUrls = [];
  page.on('request', request => requestUrls.push(request.url()));
  page.on('response', response => responseUrls.push(response.url()));
  page.on('requestfinished', request => requestFinishedUrls.push(request.url()));
  let routeCalls = 0;
  await page.route('**/*', async route => {
    ++routeCalls;
    // @ts-expect-error
    await route._continueToResponse({});
    await route.fulfill({
      status: 201,
      headers: {
        foo: 'bar'
      },
      contentType: 'text/plain',
      body: 'Yo, page!'
    });
  });
  const response = await page.goto(server.PREFIX + '/redirect/1.html');
  expect(requestUrls).toEqual(expectedUrls);
  expect(responseUrls).toEqual(expectedUrls);
  await response.finished();
  expect(requestFinishedUrls).toEqual(expectedUrls);
  expect(routeCalls).toBe(1);

  const redirectChain = [];
  for (let req = response.request(); req; req = req.redirectedFrom())
    redirectChain.unshift(req.url());
  expect(redirectChain).toEqual(expectedUrls);

  expect(response.status()).toBe(201);
  expect(response.headers().foo).toBe('bar');
  expect(response.headers()['content-type']).toBe('text/plain');
  expect(await response.text()).toBe('Yo, page!');
});

it('should fulfill original response after redirects', async ({ page, browserName, server }) => {
  server.setRedirect('/redirect/1.html', '/redirect/2.html');
  server.setRedirect('/redirect/2.html', '/title.html');
  const expectedUrls = ['/redirect/1.html', '/redirect/2.html', '/title.html'].map(s => server.PREFIX + s);
  const requestUrls = [];
  const responseUrls = [];
  const requestFinishedUrls = [];
  page.on('request', request => requestUrls.push(request.url()));
  page.on('response', response => responseUrls.push(response.url()));
  page.on('requestfinished', request => requestFinishedUrls.push(request.url()));
  let routeCalls = 0;
  await page.route('**/*', async route => {
    ++routeCalls;
    // @ts-expect-error
    const response = await route._continueToResponse({});
    await route.fulfill({ response });
  });
  const response = await page.goto(server.PREFIX + '/redirect/1.html');
  expect(requestUrls).toEqual(expectedUrls);
  expect(responseUrls).toEqual(expectedUrls);
  await response.finished();
  expect(requestFinishedUrls).toEqual(expectedUrls);
  expect(routeCalls).toBe(1);

  const redirectChain = [];
  for (let req = response.request(); req; req = req.redirectedFrom())
    redirectChain.unshift(req.url());
  expect(redirectChain).toEqual(expectedUrls);

  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('<title>Woof-Woof</title>' + os.EOL);
});

it('should abort after redirects', async ({ page, browserName, server }) => {
  server.setRedirect('/redirect/1.html', '/redirect/2.html');
  server.setRedirect('/redirect/2.html', '/title.html');
  const expectedUrls = ['/redirect/1.html', '/redirect/2.html', '/title.html'].map(s => server.PREFIX + s);
  const requestUrls = [];
  const responseUrls = [];
  const requestFinishedUrls = [];
  const requestFailedUrls = [];
  page.on('request', request => requestUrls.push(request.url()));
  page.on('response', response => responseUrls.push(response.url()));
  page.on('requestfinished', request => requestFinishedUrls.push(request.url()));
  page.on('requestfailed', request => requestFailedUrls.push(request.url()));
  let routeCalls = 0;
  await page.route('**/*', async route => {
    ++routeCalls;
    // @ts-expect-error
    await route._continueToResponse({});
    await route.abort('connectionreset');
  });

  try {
    await page.goto(server.PREFIX + '/redirect/1.html');
  } catch (e) {
    if (browserName === 'webkit')
      expect(e.message).toContain('Request intercepted');
    else if (browserName === 'chromium')
      expect(e.message).toContain('ERR_CONNECTION_RESET');
    else
      expect(e.message).toContain('NS_ERROR_NET_RESET');
  }
  expect(requestUrls).toEqual(expectedUrls);
  expect(responseUrls).toEqual(expectedUrls.slice(0, -1));
  expect(requestFinishedUrls).toEqual(expectedUrls.slice(0, -1));
  expect(requestFailedUrls).toEqual(expectedUrls.slice(-1));
  expect(routeCalls).toBe(1);
});

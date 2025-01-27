/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { APIRequestContext, Route } from 'packages/playwright-test';
import { playwrightTest as baseTest, expect } from '../config/browserTest';
import { pipeline } from 'stream/promises';
import { suppressCertificateWarning } from 'tests/config/utils';

const test = baseTest.extend<{ proxiedRequest: APIRequestContext }, { mockproxy: MockingProxy }>({
  mockproxy: [async ({ playwright }, use, testInfo) => {
    const port = 32181 + testInfo.parallelIndex;
    const proxy = await playwright.mockingProxy.newProxy(port);
    await use(proxy);
  }, { scope: 'worker' }],
  proxiedRequest: async ({ request, mockproxy }, use) => {
    const originalFetch = request.fetch;
    request.fetch = function(urlOrRequest, options) {
      if (typeof urlOrRequest !== 'string')
        throw new Error('not supported in this test');
      urlOrRequest = `http://localhost:${mockproxy.port()}/${urlOrRequest}`;
      return originalFetch.call(this, urlOrRequest, options);
    };
    await use(request);
  },
});

test.beforeEach(async ({ mockproxy }) => {
  await mockproxy.unrouteAll();
});

test.describe('transparent', () => {
  test('generates events', async ({ server, proxiedRequest, mockproxy }) => {
    const events: string[] = [];
    mockproxy.on('request', () => {
      events.push('request');
    });
    mockproxy.on('response', () => {
      events.push('response');
    });
    mockproxy.on('requestfinished', () => {
      events.push('requestfinished');
    });

    const response = await proxiedRequest.get(server.EMPTY_PAGE);
    await expect(response).toBeOK();
    expect(events).toEqual(['request', 'response', 'requestfinished']);
  });

  test('event properties', async ({ server, proxiedRequest, mockproxy }) => {
    const [
      requestFinished,
      request,
      responseEvent,
      response
    ] = await Promise.all([
      mockproxy.waitForEvent('requestfinished'),
      mockproxy.waitForRequest('**/*'),
      mockproxy.waitForResponse('**/*'),
      proxiedRequest.get(server.EMPTY_PAGE),
    ]);

    await expect(response).toBeOK();
    expect(request).toBe(requestFinished);
    expect(responseEvent.request()).toBe(request);
    expect(await request.response()).toBe(responseEvent);

    expect(request.url()).toBe(server.EMPTY_PAGE);
    expect(responseEvent.url()).toBe(server.EMPTY_PAGE);

    expect(responseEvent.status()).toBe(response.status());
    expect(await responseEvent.headersArray()).toEqual(response.headersArray());
    expect(await responseEvent.body()).toEqual(await response.body());

    expect(await responseEvent.finished()).toBe(null);

    expect(request.serviceWorker()).toBe(null);
    expect(() => request.frame()).toThrowError('Assertion error'); // TODO: improve error message
    expect(() => responseEvent.frame()).toThrowError('Assertion error');

    expect(request.failure()).toBe(null);
    expect(request.isNavigationRequest()).toBe(false);
    expect(request.redirectedFrom()).toBe(null);
    expect(request.redirectedTo()).toBe(null);
    expect(request.resourceType()).toBe(''); // TODO: should this be different?
    expect(request.method()).toBe('GET');

    expect(await request.sizes()).toEqual({
      requestBodySize: 0,
      requestHeadersSize: 164,
      responseBodySize: 0,
      responseHeadersSize: 197,
    });

    expect(request.timing()).toEqual({
      'connectEnd': expect.any(Number),
      'connectStart': expect.any(Number),
      'domainLookupEnd': expect.any(Number),
      'domainLookupStart': -1,
      'requestStart': -1,
      'responseEnd': expect.any(Number),
      'responseStart': expect.any(Number),
      'secureConnectionStart': -1,
      'startTime': expect.any(Number),
    });

    expect(await responseEvent.securityDetails()).toBe(null);
    expect(await responseEvent.serverAddr()).toEqual({
      ipAddress: expect.any(String),
      port: expect.any(Number),
    });
  });

  test('securityDetails', async ({ httpsServer, proxiedRequest, mockproxy }) => {
    const oldValue = process.env['NODE_TLS_REJECT_UNAUTHORIZED'];
    // https://stackoverflow.com/a/21961005/552185
    process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';
    suppressCertificateWarning();
    try {
      const [
        event,
        response
      ] = await Promise.all([
        mockproxy.waitForResponse('**/*'),
        proxiedRequest.get(httpsServer.EMPTY_PAGE),
      ]);

      await expect(response).toBeOK();
      expect(await event.securityDetails()).toEqual({
        'issuer': 'playwright-test',
        'protocol': 'TLSv1.3',
        'subjectName': 'playwright-test',
        'validFrom': expect.any(Number),
        'validTo': expect.any(Number),
      });
    } finally {
      process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = oldValue;
    }
  });

  test('request with body', async ({ server, proxiedRequest, mockproxy }) => {
    server.setRoute('/echo', (req, res) => pipeline(req, res));
    const [
      requestEvent,
      responseEvent,
      response,
    ] = await Promise.all([
      mockproxy.waitForRequest('**/*'),
      mockproxy.waitForResponse('**/*'),
      proxiedRequest.post(server.PREFIX + '/echo', { data: 'hello' }),
    ]);

    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('hello');
    expect(await responseEvent.body()).toEqual(Buffer.from('hello'));
    expect(requestEvent.postData()).toBe('hello');
    expect(await requestEvent.sizes()).toEqual({
      requestBodySize: 5,
      requestHeadersSize: 218,
      responseBodySize: 5,
      responseHeadersSize: 141,
    });
  });

  test('request failed', async ({ server, proxiedRequest, mockproxy }) => {
    server.setRoute('/failure', (req, res) => {
      res.socket.destroy();
    });
    const [
      request,
      requestFailed,
      response,
    ] = await Promise.all([
      mockproxy.waitForRequest('**/*'),
      mockproxy.waitForEvent('requestfailed'),
      proxiedRequest.get(server.PREFIX + '/failure'),
    ]);

    expect(response.status()).toEqual(502); // TODO: should the proxy also close the socket instead?
    expect(request).toBe(requestFailed);
    expect(request.failure()).toEqual({
      errorText: 'Error: socket hang up',
    });
    expect(await request.response()).toBe(null);
  });
});

test('stalling', async ({ server, proxiedRequest, mockproxy }) => {
  const routes: Route[] = [];
  await mockproxy.route('**/abort', route => routes.push(route));
  await expect(() => proxiedRequest.get(server.PREFIX + '/abort', { timeout: 100 })).rejects.toThrowError('Request timed out after 100ms');
  expect(routes.length).toBe(1);
});

test('route properties', async ({ server, proxiedRequest, mockproxy }) => {
  const routes: Route[] = [];
  await mockproxy.route('**/*', (route, request) => {
    expect(route.request()).toBe(request);
    routes.push(route);
    return route.continue();
  });
  await expect(await proxiedRequest.get(server.EMPTY_PAGE)).toBeOK();
  expect(routes.length).toBe(1);
});

test('aborting', async ({ server, proxiedRequest, mockproxy }) => {
  await mockproxy.route('**/abort', route => route.abort());
  await expect(() => proxiedRequest.get(server.PREFIX + '/abort', { timeout: 100 })).rejects.toThrowError('Request timed out after 100ms');
});

test('fulfill', async ({ server, proxiedRequest, mockproxy }) => {
  let apiCalls = 0;
  server.setRoute('/endpoint', (req, res) => {
    apiCalls++;
  });
  await mockproxy.route('**/endpoint', route => route.fulfill({ body: 'Hello', contentType: 'foo/bar', headers: { 'x-test': 'foo' }, status: 202 }));
  const response = await proxiedRequest.get(server.PREFIX + '/endpoint');
  expect(response.status()).toBe(202);
  expect(await response.text()).toBe('Hello');
  expect(response.headers()['content-type']).toBe('foo/bar');
  expect(response.headers()['x-test']).toBe('foo');
  expect(apiCalls).toBe(0);
});

test('continue', async ({ server, proxiedRequest, mockproxy }) => {
  server.setRoute('/echo', (req, res) => {
    res.setHeader('request-method', req.method);
    res.writeHead(200, req.headers);
    return pipeline(req, res);
  });
  await mockproxy.route('**/endpoint', (route, request) =>
    route.continue({
      headers: { 'x-override': 'bar', 'x-add': 'baz' },
      method: 'PUT',
      postData: 'world',
      url: new URL('./echo', request.url()).toString(),
    })
  );
  const response = await proxiedRequest.get(server.PREFIX + '/endpoint', { headers: { 'x-override': 'foo' } });
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('world');
  expect(response.headers()['request-method']).toBe('PUT');
  expect(response.headers()['x-override']).toBe('bar');
  expect(response.headers()['x-add']).toBe('baz');
});

test('fallback', async ({ server, proxiedRequest, mockproxy }) => {
  server.setRoute('/foo', (req, res) => {
    res.end('ok');
  });
  await mockproxy.route('**/endpoint', route => route.continue());
  await mockproxy.route('**/endpoint', (route, request) => route.fallback({ url: new URL('./foo', request.url()).toString() }));
  const response = await proxiedRequest.get(server.PREFIX + '/endpoint');
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('ok');
});

test('fetch', async ({ server, proxiedRequest, mockproxy }) => {
  server.setRoute('/foo', (req, res) => {
    res.end('ok');
  });
  await mockproxy.route('**/endpoint', async (route, request) => {
    const response = await route.fetch({ url: new URL('./foo', request.url()).toString() });
    await route.fulfill({ response });
  });
  const response = await proxiedRequest.get(server.PREFIX + '/endpoint');
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe('ok');
});

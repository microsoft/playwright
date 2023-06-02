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

import { test as it, expect } from './pageTest';

it('should work', async ({ page, server }) => {
  await page.route('**/*', route => route.fallback());
  await page.goto(server.EMPTY_PAGE);
});

it('should fall back', async ({ page, server }) => {
  const intercepted = [];
  await page.route('**/empty.html', route => {
    intercepted.push(1);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(2);
    void route.fallback();
  });
  await page.route('**/empty.html', route => {
    intercepted.push(3);
    void route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);
});

it('should fall back async', async ({ page, server }) => {
  const intercepted = [];
  await page.route('**/empty.html', async route => {
    intercepted.push(1);
    await new Promise(r => setTimeout(r, 100));
    void route.fallback();
  });
  await page.route('**/empty.html', async route => {
    intercepted.push(2);
    await new Promise(r => setTimeout(r, 100));
    void route.fallback();
  });
  await page.route('**/empty.html', async route => {
    intercepted.push(3);
    await new Promise(r => setTimeout(r, 100));
    void route.fallback();
  });
  await page.goto(server.EMPTY_PAGE);
  expect(intercepted).toEqual([3, 2, 1]);
});

it('should not chain fulfill', async ({ page, server }) => {
  let failed = false;
  await page.route('**/empty.html', route => {
    failed = true;
  });
  await page.route('**/empty.html', route => {
    void route.fulfill({ status: 200, body: 'fulfilled' });
  });
  await page.route('**/empty.html', route => {
    void route.fallback();
  });
  const response = await page.goto(server.EMPTY_PAGE);
  const body = await response.body();
  expect(body.toString()).toEqual('fulfilled');
  expect(failed).toBeFalsy();
});

it('should not chain abort', async ({ page, server }) => {
  let failed = false;
  await page.route('**/empty.html', route => {
    failed = true;
  });
  await page.route('**/empty.html', route => {
    void route.abort();
  });
  await page.route('**/empty.html', route => {
    void route.fallback();
  });
  const e = await page.goto(server.EMPTY_PAGE).catch(e => e);
  expect(e).toBeTruthy();
  expect(failed).toBeFalsy();
});

it('should fall back after exception', async ({ page, server }) => {
  await page.route('**/empty.html', route => {
    void route.continue();
  });
  await page.route('**/empty.html', async route => {
    try {
      await route.fulfill({ response: {} as any });
    } catch (e) {
      void route.fallback();
    }
  });
  await page.goto(server.EMPTY_PAGE);
});

it('should chain once', async ({ page, server }) => {
  await page.route('**/empty.html', route => {
    void route.fulfill({ status: 200, body: 'fulfilled one' });
  }, { times: 1 });
  await page.route('**/empty.html', route => {
    void route.fallback();
  }, { times: 1 });
  const response = await page.goto(server.EMPTY_PAGE);
  const body = await response.body();
  expect(body.toString()).toEqual('fulfilled one');
});

it('should amend HTTP headers', async ({ page, server }) => {
  const values = [];
  await page.route('**/sleep.zzz', async route => {
    values.push(route.request().headers().foo);
    values.push(await route.request().headerValue('FOO'));
    void route.continue();
  });
  await page.route('**/*', route => {
    void route.fallback({ headers: { ...route.request().headers(), FOO: 'bar' } });
  });
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    server.waitForRequest('/sleep.zzz'),
    page.evaluate(() => fetch('/sleep.zzz'))
  ]);
  values.push(request.headers['foo']);
  expect(values).toEqual(['bar', 'bar', 'bar']);
});

it('should delete header with undefined value', async ({ page, server, browserName }) => {
  await page.goto(server.PREFIX + '/empty.html');
  server.setRoute('/something', (request, response) => {
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
    response.end('done');
  });
  let interceptedRequest;
  await page.route('**/*', (route, request) => {
    interceptedRequest = request;
    void route.continue();
  });
  await page.route(server.PREFIX + '/something', async (route, request) => {
    const headers = await request.allHeaders();
    void route.fallback({
      headers: {
        ...headers,
        foo: undefined
      }
    });
  });
  const [text, serverRequest] = await Promise.all([
    page.evaluate(async url => {
      const data = await fetch(url, {
        headers: {
          foo: 'a',
          bar: 'b',
        }
      });
      return data.text();
    }, server.PREFIX + '/something'),
    server.waitForRequest('/something')
  ]);
  expect(text).toBe('done');
  expect(interceptedRequest.headers()['foo']).toEqual(undefined);
  expect(interceptedRequest.headers()['bar']).toEqual('b');
  expect(serverRequest.headers.foo).toBeFalsy();
  expect(serverRequest.headers.bar).toBe('b');
});

it('should amend method', async ({ page, server }) => {
  const sRequest = server.waitForRequest('/sleep.zzz');
  await page.goto(server.EMPTY_PAGE);

  let method: string;
  await page.route('**/*', route => {
    method = route.request().method();
    void route.continue();
  });
  await page.route('**/*', route => route.fallback({ method: 'POST' }));

  const [request] = await Promise.all([
    page.waitForRequest('**/sleep.zzz'),
    page.evaluate(() => fetch('/sleep.zzz'))
  ]);
  expect(method).toBe('POST');
  expect(request.method()).toBe('POST');
  expect((await sRequest).method).toBe('POST');
});

it('should override request url', async ({ page, server }) => {
  const serverRequest = server.waitForRequest('/global-var.html');

  let url: string;
  await page.route('**/global-var.html', route => {
    url = route.request().url();
    void route.continue();
  });

  await page.route('**/foo', route => route.fallback({ url: server.PREFIX + '/global-var.html' }));

  const response = await page.goto(server.PREFIX + '/foo');
  expect(url).toBe(server.PREFIX + '/global-var.html');
  expect(response.request().url()).toBe(server.PREFIX + '/global-var.html');
  expect(response.url()).toBe(server.PREFIX + '/global-var.html');
  expect(await page.evaluate(() => window['globalVar'])).toBe(123);
  expect((await serverRequest).method).toBe('GET');
});

it.describe('post data', () => {
  it('should amend post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    let postData: string;
    await page.route('**/*', route => {
      postData = route.request().postData();
      void route.continue();
    });
    await page.route('**/*', route => {
      void route.fallback({ postData: 'doggo' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(postData).toBe('doggo');
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo');
  });

  it('should amend binary post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    const arr = Array.from(Array(256).keys());
    let postDataBuffer: Buffer;
    await page.route('**/*', route => {
      postDataBuffer = route.request().postDataBuffer();
      void route.continue();
    });
    await page.route('**/*', route => {
      void route.fallback({ postData: Buffer.from(arr) });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    const buffer = await serverRequest.postBody;
    expect(postDataBuffer.length).toBe(arr.length);
    expect(buffer.length).toBe(arr.length);
    for (let i = 0; i < arr.length; ++i) {
      expect(buffer[i]).toBe(arr[i]);
      expect(postDataBuffer[i]).toBe(arr[i]);
    }
  });

  it('should amend json post data', async ({ page, server }) => {
    await page.goto(server.EMPTY_PAGE);
    let postData: string;
    await page.route('**/*', route => {
      postData = route.request().postDataJSON();
      void route.continue();
    });
    await page.route('**/*', route => {
      void route.fallback({ postData: { foo: 'bar' } });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(postData).toEqual({ foo: 'bar' });
    expect((await serverRequest.postBody).toString('utf8')).toBe('{"foo":"bar"}');
  });
});

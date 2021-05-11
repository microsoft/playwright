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

it('should work', async ({page, server}) => {
  await page.route('**/*', route => route.continue());
  await page.goto(server.EMPTY_PAGE);
});

it('should amend HTTP headers', async ({page, server}) => {
  await page.route('**/*', route => {
    const headers = Object.assign({}, route.request().headers());
    headers['FOO'] = 'bar';
    route.continue({ headers });
  });
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    server.waitForRequest('/sleep.zzz'),
    page.evaluate(() => fetch('/sleep.zzz'))
  ]);
  expect(request.headers['foo']).toBe('bar');
});

it('should amend method', async ({page, server}) => {
  const sRequest = server.waitForRequest('/sleep.zzz');
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', route => route.continue({ method: 'POST' }));
  const [request] = await Promise.all([
    server.waitForRequest('/sleep.zzz'),
    page.evaluate(() => fetch('/sleep.zzz'))
  ]);
  expect(request.method).toBe('POST');
  expect((await sRequest).method).toBe('POST');
});

it('should override request url', async ({page, server}) => {
  const request = server.waitForRequest('/global-var.html');
  await page.route('**/foo', route => {
    route.continue({ url: server.PREFIX + '/global-var.html' });
  });
  const [response] = await Promise.all([
    page.waitForEvent('response'),
    page.goto(server.PREFIX + '/foo'),
  ]);
  expect(response.url()).toBe(server.PREFIX + '/foo');
  expect(await page.evaluate(() => window['globalVar'])).toBe(123);
  expect((await request).method).toBe('GET');
});

it('should not allow changing protocol when overriding url', async ({page, server}) => {
  let error: Error | undefined;
  await page.route('**/*', async route => {
    try {
      await route.continue({ url: 'file:///tmp/foo' });
    } catch (e) {
      error = e;
      await route.continue();
    }
  });
  await page.goto(server.EMPTY_PAGE);
  expect(error).toBeTruthy();
  expect(error.message).toContain('New URL must have same protocol as overridden URL');
});

it('should override method along with url', async ({page, server}) => {
  const request = server.waitForRequest('/empty.html');
  await page.route('**/foo', route => {
    route.continue({
      url: server.EMPTY_PAGE,
      method: 'POST'
    });
  });
  await page.goto(server.PREFIX + '/foo');
  expect((await request).method).toBe('POST');
});

it('should amend method on main request', async ({page, server}) => {
  const request = server.waitForRequest('/empty.html');
  await page.route('**/*', route => route.continue({ method: 'POST' }));
  await page.goto(server.EMPTY_PAGE);
  expect((await request).method).toBe('POST');
});

it.describe('', () => {
  it.fixme(({ isAndroid }) => isAndroid, 'Post data does not work');

  it('should amend post data', async ({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      route.continue({ postData: 'doggo' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo');
  });

  it('should amend method and post data', async ({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      route.continue({ method: 'POST', postData: 'doggo' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'GET' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo');
  });

  it('should amend utf8 post data', async ({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      route.continue({ postData: 'пушкин' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    expect((await serverRequest.postBody).toString('utf8')).toBe('пушкин');
  });

  it('should amend longer post data', async ({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    await page.route('**/*', route => {
      route.continue({ postData: 'doggo-is-longer-than-birdy' });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    expect((await serverRequest.postBody).toString('utf8')).toBe('doggo-is-longer-than-birdy');
  });

  it('should amend binary post data', async ({page, server}) => {
    await page.goto(server.EMPTY_PAGE);
    const arr = Array.from(Array(256).keys());
    await page.route('**/*', route => {
      route.continue({ postData: Buffer.from(arr) });
    });
    const [serverRequest] = await Promise.all([
      server.waitForRequest('/sleep.zzz'),
      page.evaluate(() => fetch('/sleep.zzz', { method: 'POST', body: 'birdy' }))
    ]);
    expect(serverRequest.method).toBe('POST');
    const buffer = await serverRequest.postBody;
    expect(buffer.length).toBe(arr.length);
    for (let i = 0; i < arr.length; ++i)
      expect(arr[i]).toBe(buffer[i]);
  });
});

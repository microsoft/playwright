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

import { test as it, expect } from './pageTest';

import type { Page, Response } from 'playwright-core';
import type { HeadersArray } from '../../packages/isomorphic/types';

it.skip(({ browserName, isBidi }) => browserName !== 'firefox' || isBidi, 'Tests the Firefox network observer.');

async function expectHeaderFields(response: Response, expected: HeadersArray) {
  const headers = await response.headersArray();
  const allHeaders = await response.allHeaders();
  for (const name of new Set(expected.map(header => header.name.toLowerCase()))) {
    const fields = expected.filter(header => header.name.toLowerCase() === name);
    const values = fields.map(header => header.value);
    expect(headers.filter(header => header.name.toLowerCase() === name)).toEqual(fields);
    expect(await response.headerValues(name)).toEqual(values);
    const combined = values.join(name === 'set-cookie' ? '\n' : ', ');
    expect(await response.headerValue(name)).toBe(combined);
    expect(allHeaders[name]).toBe(combined);
  }
}

async function fetchResponse(page: Page, url: string) {
  const [response, fetched] = await Promise.all([
    page.waitForResponse(url),
    page.evaluate(async url => {
      const response = await fetch(url);
      return { status: response.status, body: await response.text() };
    }, url),
  ]);
  return { response, fetched };
}

for (const status of [200, 302]) {
  it(`should preserve original response header fields for ${status} responses`, async ({ page, server }) => {
    const headers = [
      { name: 'Date', value: 'Wed, 21 Oct 2037 07:28:00 GMT' },
      { name: 'X-Literal', value: 'first, "second, third"' },
      { name: 'X-Identical', value: 'same' },
      { name: 'X-Identical', value: 'same' },
      { name: 'X-Repeat', value: 'first, literal' },
      { name: 'x-repeat', value: 'second' },
      { name: 'Set-Cookie', value: 'a=b; Expires=Wed, 21 Oct 2037 07:28:00 GMT' },
      { name: 'Set-Cookie', value: 'c=d; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/' },
      { name: 'WWW-Authenticate', value: 'Digest realm="one, two", qop="auth, auth-int"' },
      { name: 'WWW-Authenticate', value: 'Basic realm="three, four"' },
      { name: 'Proxy-Authenticate', value: 'Basic realm="five, six"' },
      { name: 'Proxy-Authenticate', value: 'Basic realm="five, six"' },
    ];
    server.setRoute('/headers', (request, response) => {
      response.writeHead(status, [
        'Content-Type', 'text/html',
        ...status === 302 ? ['Location', '/empty.html'] : [],
        ...headers.flatMap(({ name, value }) => [name, value]),
      ]);
      response.end('body');
    });
    const finalResponse = await page.goto(server.PREFIX + '/headers');
    const response = status === 302 ? await finalResponse.request().redirectedFrom().response() : finalResponse;
    expect(response.status()).toBe(status);
    await expectHeaderFields(response, headers);
  });
}

it('should preserve synthesized response header fields', async ({ page, server }) => {
  const cookies = [
    'a=b; Expires=Wed, 21 Oct 2037 07:28:00 GMT',
    'c=d; Expires=Wed, 21 Oct 2037 07:28:00 GMT; Path=/',
  ];
  await page.route('**/headers', route => route.fulfill({
    contentType: 'text/html',
    headers: {
      'X-Literal': 'first, "second, third"',
      'Date': 'Wed, 21 Oct 2037 07:28:00 GMT',
      'Set-Cookie': cookies.join('\n'),
      'WWW-Authenticate': 'Digest realm="one, two", qop="auth, auth-int"',
    },
    body: 'fulfilled',
  }));
  const response = await page.goto(server.PREFIX + '/headers');
  expect(await response.text()).toBe('fulfilled');
  await expectHeaderFields(response, [
    { name: 'x-literal', value: 'first, "second, third"' },
    { name: 'date', value: 'Wed, 21 Oct 2037 07:28:00 GMT' },
    ...cookies.map(value => ({ name: 'set-cookie', value })),
    { name: 'www-authenticate', value: 'Digest realm="one, two", qop="auth, auth-int"' },
  ]);
});

it('should report current effective fields after cache revalidation', async ({ page, server }) => {
  const validators: (string | undefined)[] = [];
  server.setRoute('/cached-headers', (request, response) => {
    validators.push(request.headers['if-none-match']);
    if (validators.length === 1) {
      response.writeHead(200, {
        'Content-Type': 'text/plain',
        'ETag': '"v1"',
        'Cache-Control': 'max-age=0, must-revalidate',
        'X-Keep': ['first, literal', 'second'],
        'X-Change': ['old, literal', 'old-second'],
        'Set-Cookie': ['old=value; Expires=Wed, 21 Oct 2037 07:28:00 GMT', 'old2=value; Path=/'],
        'WWW-Authenticate': ['Basic realm="old, realm"', 'Basic realm="old-second"'],
        'Proxy-Authenticate': ['Basic realm="old, proxy"', 'Basic realm="old-proxy-second"'],
      });
      response.end('cached-body');
      return;
    }
    response.writeHead(304, {
      'Cache-Control': 'max-age=3600',
      'X-Change': ['new, literal', 'new-second'],
      'Set-Cookie': ['new=value; Expires=Wed, 21 Oct 2037 07:28:00 GMT', 'new2=value; Path=/'],
      'WWW-Authenticate': ['Basic realm="new, realm"', 'Basic realm="new-second"'],
      'Proxy-Authenticate': ['Basic realm="new, proxy"', 'Basic realm="new-proxy-second"'],
    });
    response.end();
  });

  await page.goto(server.EMPTY_PAGE);
  const url = server.PREFIX + '/cached-headers';
  const initial = await fetchResponse(page, url);
  const revalidated = await fetchResponse(page, url);
  const cached = await fetchResponse(page, url);

  expect(validators).toEqual([undefined, '"v1"']);
  for (const { fetched } of [initial, revalidated, cached])
    expect(fetched).toEqual({ status: 200, body: 'cached-body' });
  expect([initial.response.status(), revalidated.response.status(), cached.response.status()]).toEqual([200, 304, 200]);
  expect(await initial.response.headerValue('x-change')).toBe('old, literal, old-second');
  expect(await revalidated.response.headerValues('x-keep')).toEqual([]);
  expect(await revalidated.response.headerValues('x-change')).toEqual(['new, literal', 'new-second']);
  expect(await revalidated.response.headerValues('set-cookie')).toEqual([
    'new=value; Expires=Wed, 21 Oct 2037 07:28:00 GMT',
    'new2=value; Path=/',
  ]);
  expect(await revalidated.response.headerValues('www-authenticate')).toEqual(['Basic realm="new, realm"', 'Basic realm="new-second"']);
  expect(await revalidated.response.headerValues('proxy-authenticate')).toEqual(['Basic realm="new, proxy"', 'Basic realm="new-proxy-second"']);
  expect(await cached.response.headerValues('x-keep')).toEqual(['first, literal, second']);
  expect(await cached.response.headerValues('x-change')).toEqual(['new, literal, new-second']);
  for (const name of ['set-cookie', 'www-authenticate', 'proxy-authenticate'])
    expect(await cached.response.headerValues(name)).toEqual([]);
});

it('should report a standalone 304 response without waiting for a cache merge', async ({ page, server }) => {
  server.setRoute('/standalone-304', (request, response) => {
    response.writeHead(304, {
      'X-Literal': 'standalone, value',
      'Cache-Control': 'no-store',
    });
    response.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const { response, fetched } = await fetchResponse(page, server.PREFIX + '/standalone-304');
  expect(response.status()).toBe(304);
  expect(fetched).toEqual({ status: 304, body: '' });
  expect(await response.headerValues('x-literal')).toEqual(['standalone, value']);
  expect(await response.finished()).toBeNull();
});

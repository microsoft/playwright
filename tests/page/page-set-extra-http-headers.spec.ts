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

it('should work @smoke', async ({ page, server }) => {
  await page.setExtraHTTPHeaders({
    foo: 'bar',
  });
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect(request.headers['foo']).toBe('bar');
  expect(request.headers['baz']).toBe(undefined);
});

it('should work with redirects', async ({ page, server }) => {
  server.setRedirect('/foo.html', '/empty.html');
  await page.setExtraHTTPHeaders({
    foo: 'bar'
  });
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.PREFIX + '/foo.html'),
  ]);
  expect(request.headers['foo']).toBe('bar');
});

it('should work with extra headers from browser context', async ({ page, server }) => {
  await page.context().setExtraHTTPHeaders({
    'foo': 'bar',
  });
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect(request.headers['foo']).toBe('bar');
});

it('should throw for non-string header values', async ({ page }) => {
  // @ts-expect-error headers must be strings
  const error1 = await page.setExtraHTTPHeaders({ 'foo': 1 }).catch(e => e);
  expect(error1.message).toContain('Expected value of header "foo" to be String, but "number" is found.');
  // @ts-expect-error headers must be strings
  const error2 = await page.context().setExtraHTTPHeaders({ 'foo': true }).catch(e => e);
  expect(error2.message).toContain('Expected value of header "foo" to be String, but "boolean" is found.');
});

it('should not duplicate referer header', async ({ page, server, browserName }) => {
  it.fail(browserName === 'chromium', 'Request has referer and Referer');
  await page.setExtraHTTPHeaders({ 'referer': server.EMPTY_PAGE });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(response.request().headers()['referer']).toBe(server.EMPTY_PAGE);
});

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

import { it, expect } from './fixtures';

import { globToRegex } from '../lib/client/clientHelper';
import vm from 'vm';

it('should work with navigation', async ({page, server}) => {
  const requests = new Map();
  await page.route('**/*', route => {
    requests.set(route.request().url().split('/').pop(), route.request());
    route.continue();
  });
  server.setRedirect('/rrredirect', '/frames/one-frame.html');
  await page.goto(server.PREFIX + '/rrredirect');
  expect(requests.get('rrredirect').isNavigationRequest()).toBe(true);
  expect(requests.get('frame.html').isNavigationRequest()).toBe(true);
  expect(requests.get('script.js').isNavigationRequest()).toBe(false);
  expect(requests.get('style.css').isNavigationRequest()).toBe(false);
});

it('should work with ignoreHTTPSErrors', async ({browser, httpsServer}) => {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.route('**/*', route => route.continue());
  const response = await page.goto(httpsServer.EMPTY_PAGE);
  expect(response.status()).toBe(200);
  await context.close();
});

it('should intercept after a service worker', async ({browser, page, server, context}) => {
  await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
  await page.evaluate(() => window['activationPromise']);

  // Sanity check.
  const swResponse = await page.evaluate(() => window['fetchDummy']('foo'));
  expect(swResponse).toBe('responseFromServiceWorker:foo');

  await page.route('**/foo', route => {
    const slash = route.request().url().lastIndexOf('/');
    const name = route.request().url().substring(slash + 1);
    route.fulfill({
      status: 200,
      contentType: 'text/css',
      body: 'responseFromInterception:' + name
    });
  });

  // Page route is applied after service worker fetch event.
  const swResponse2 = await page.evaluate(() => window['fetchDummy']('foo'));
  expect(swResponse2).toBe('responseFromServiceWorker:foo');

  // Page route is not applied to service worker initiated fetch.
  const nonInterceptedResponse = await page.evaluate(() => window['fetchDummy']('passthrough'));
  expect(nonInterceptedResponse).toBe('FAILURE: Not Found');
});

it('should work with glob', async () => {
  expect(globToRegex('**/*.js').test('https://localhost:8080/foo.js')).toBeTruthy();
  expect(globToRegex('**/*.css').test('https://localhost:8080/foo.js')).toBeFalsy();
  expect(globToRegex('*.js').test('https://localhost:8080/foo.js')).toBeFalsy();
  expect(globToRegex('https://**/*.js').test('https://localhost:8080/foo.js')).toBeTruthy();
  expect(globToRegex('http://localhost:8080/simple/path.js').test('http://localhost:8080/simple/path.js')).toBeTruthy();
  expect(globToRegex('http://localhost:8080/?imple/path.js').test('http://localhost:8080/Simple/path.js')).toBeTruthy();
  expect(globToRegex('**/{a,b}.js').test('https://localhost:8080/a.js')).toBeTruthy();
  expect(globToRegex('**/{a,b}.js').test('https://localhost:8080/b.js')).toBeTruthy();
  expect(globToRegex('**/{a,b}.js').test('https://localhost:8080/c.js')).toBeFalsy();

  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.jpg')).toBeTruthy();
  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.jpeg')).toBeTruthy();
  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.png')).toBeTruthy();
  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.css')).toBeFalsy();
});

it('should work with regular expression passed from a different context', async ({page, server}) => {
  const ctx = vm.createContext();
  const regexp = vm.runInContext('new RegExp("empty\\.html")', ctx);
  let intercepted = false;

  await page.route(regexp, (route, request) => {
    expect(route.request()).toBe(request);
    expect(request.url()).toContain('empty.html');
    expect(request.headers()['user-agent']).toBeTruthy();
    expect(request.method()).toBe('GET');
    expect(request.postData()).toBe(null);
    expect(request.isNavigationRequest()).toBe(true);
    expect(request.resourceType()).toBe('document');
    expect(request.frame() === page.mainFrame()).toBe(true);
    expect(request.frame().url()).toBe('about:blank');
    route.continue();
    intercepted = true;
  });

  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(intercepted).toBe(true);
});

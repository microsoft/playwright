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
import { globToRegexPattern, urlMatches } from '../../packages/playwright-core/lib/utils/isomorphic/urlMatch';
import vm from 'vm';

it('should work with navigation @smoke', async ({ page, server }) => {
  const requests = new Map();
  await page.route('**/*', route => {
    requests.set(route.request().url().split('/').pop(), route.request());
    void route.continue();
  });
  server.setRedirect('/rrredirect', '/frames/one-frame.html');
  await page.goto(server.PREFIX + '/rrredirect');
  expect(requests.get('rrredirect').isNavigationRequest()).toBe(true);
  expect(requests.get('frame.html').isNavigationRequest()).toBe(true);
  expect(requests.get('script.js').isNavigationRequest()).toBe(false);
  expect(requests.get('style.css').isNavigationRequest()).toBe(false);
});

it('should intercept after a service worker', async ({ page, server, browserName, isAndroid }) => {
  it.skip(isAndroid);

  await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
  await page.evaluate(() => window['activationPromise']);

  // Sanity check.
  const swResponse = await page.evaluate(() => window['fetchDummy']('foo'));
  expect(swResponse).toBe('responseFromServiceWorker:foo');

  await page.route('**/foo', route => {
    const slash = route.request().url().lastIndexOf('/');
    const name = route.request().url().substring(slash + 1);
    void route.fulfill({
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

  // Firefox does not want to fetch the redirect for some reason.
  if (browserName !== 'firefox') {
    // Page route is not applied to service worker initiated fetch with redirect.
    server.setRedirect('/serviceworkers/fetchdummy/passthrough', '/simple.json');
    const redirectedResponse = await page.evaluate(() => window['fetchDummy']('passthrough'));
    expect(redirectedResponse).toBe('{"foo": "bar"}\n');
  }
});

it('should work with glob', async () => {
  function globToRegex(glob: string): RegExp {
    return new RegExp(globToRegexPattern(glob));
  }
  expect(globToRegex('**/*.js').test('https://localhost:8080/foo.js')).toBeTruthy();
  expect(globToRegex('**/*.css').test('https://localhost:8080/foo.js')).toBeFalsy();
  expect(globToRegex('*.js').test('https://localhost:8080/foo.js')).toBeFalsy();
  expect(globToRegex('https://**/*.js').test('https://localhost:8080/foo.js')).toBeTruthy();
  expect(globToRegex('http://localhost:8080/simple/path.js').test('http://localhost:8080/simple/path.js')).toBeTruthy();
  expect(globToRegex('**/{a,b}.js').test('https://localhost:8080/a.js')).toBeTruthy();
  expect(globToRegex('**/{a,b}.js').test('https://localhost:8080/b.js')).toBeTruthy();
  expect(globToRegex('**/{a,b}.js').test('https://localhost:8080/c.js')).toBeFalsy();

  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.jpg')).toBeTruthy();
  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.jpeg')).toBeTruthy();
  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.png')).toBeTruthy();
  expect(globToRegex('**/*.{png,jpg,jpeg}').test('https://localhost:8080/c.css')).toBeFalsy();
  expect(globToRegex('foo*').test('foo.js')).toBeTruthy();
  expect(globToRegex('foo*').test('foo/bar.js')).toBeFalsy();
  expect(globToRegex('http://localhost:3000/signin-oidc*').test('http://localhost:3000/signin-oidc/foo')).toBeFalsy();
  expect(globToRegex('http://localhost:3000/signin-oidc*').test('http://localhost:3000/signin-oidcnice')).toBeTruthy();

  // range [] is NOT supported
  expect(globToRegex('**/api/v[0-9]').test('http://example.com/api/v[0-9]')).toBeTruthy();
  expect(globToRegex('**/api/v[0-9]').test('http://example.com/api/version')).toBeFalsy();

  // query params
  expect(globToRegex('**/api\\?param').test('http://example.com/api?param')).toBeTruthy();
  expect(globToRegex('**/api\\?param').test('http://example.com/api-param')).toBeFalsy();
  expect(globToRegex('**/three-columns/settings.html\\?**id=settings-**').test('http://mydomain:8080/blah/blah/three-columns/settings.html?id=settings-e3c58efe-02e9-44b0-97ac-dd138100cf7c&blah')).toBeTruthy();

  expect(globToRegex('\\?')).toEqual(/^\?$/);
  expect(globToRegex('\\')).toEqual(/^\\$/);
  expect(globToRegex('\\\\')).toEqual(/^\\$/);
  expect(globToRegex('\\[')).toEqual(/^\[$/);
  expect(globToRegex('[a-z]')).toEqual(/^\[a-z\]$/);
  expect(globToRegex('$^+.\\*()|\\?\\{\\}\\[\\]')).toEqual(/^\$\^\+\.\*\(\)\|\?\{\}\[\]$/);

  expect(urlMatches(undefined, 'http://playwright.dev/', 'http://playwright.dev')).toBeTruthy();
  expect(urlMatches(undefined, 'http://playwright.dev/?a=b', 'http://playwright.dev?a=b')).toBeTruthy();
  expect(urlMatches(undefined, 'http://playwright.dev/', 'h*://playwright.dev')).toBeTruthy();
  expect(urlMatches(undefined, 'http://api.playwright.dev/?x=y', 'http://*.playwright.dev?x=y')).toBeTruthy();
  expect(urlMatches(undefined, 'http://playwright.dev/foo/bar', '**/foo/**')).toBeTruthy();
  expect(urlMatches('http://playwright.dev', 'http://playwright.dev/?x=y', '?x=y')).toBeTruthy();
  expect(urlMatches('http://playwright.dev/foo/', 'http://playwright.dev/foo/bar?x=y', './bar?x=y')).toBeTruthy();

  // This is not supported, we treat ? as a query separator.
  expect(globToRegex('http://localhost:8080/?imple/path.js').test('http://localhost:8080/Simple/path.js')).toBeFalsy();
  expect(urlMatches(undefined, 'http://playwright.dev/', 'http://playwright.?ev')).toBeFalsy();
  expect(urlMatches(undefined, 'http://playwright./?ev', 'http://playwright.?ev')).toBeTruthy();
  expect(urlMatches(undefined, 'http://playwright.dev/foo', 'http://playwright.dev/f??')).toBeFalsy();
  expect(urlMatches(undefined, 'http://playwright.dev/f??', 'http://playwright.dev/f??')).toBeTruthy();
  expect(urlMatches(undefined, 'http://playwright.dev/?x=y', 'http://playwright.dev\\?x=y')).toBeTruthy();
  expect(urlMatches(undefined, 'http://playwright.dev/?x=y', 'http://playwright.dev/\\?x=y')).toBeTruthy();
  expect(urlMatches('http://playwright.dev/foo', 'http://playwright.dev/foo?bar', '?bar')).toBeTruthy();
  expect(urlMatches('http://playwright.dev/foo', 'http://playwright.dev/foo?bar', '\\\\?bar')).toBeTruthy();
  expect(urlMatches('http://first.host/', 'http://second.host/foo', '**/foo')).toBeTruthy();
  expect(urlMatches('http://playwright.dev/', 'http://localhost/', '*//localhost/')).toBeTruthy();

  const customPrefixes = ['about', 'data', 'chrome', 'edge', 'file'];
  for (const prefix of customPrefixes) {
    expect(urlMatches('http://playwright.dev/', `${prefix}:blank`, `${prefix}:blank`)).toBeTruthy();
    expect(urlMatches('http://playwright.dev/', `${prefix}:blank`, `http://playwright.dev/`)).toBeFalsy();
    expect(urlMatches(undefined, `${prefix}:blank`, `${prefix}:blank`)).toBeTruthy();
    expect(urlMatches(undefined, `${prefix}:blank`, `${prefix}:*`)).toBeTruthy();
    expect(urlMatches(undefined, `not${prefix}:blank`, `${prefix}:*`)).toBeFalsy();
  }
});

it('should intercept by glob', async function({ page, server, isAndroid }) {
  it.skip(isAndroid);

  await page.goto(server.EMPTY_PAGE);
  await page.route('http://localhos**?*oo', async route => {
    await route.fulfill({
      status: 200,
      body: 'intercepted',
    });
  });
  const result = await page.evaluate(url => fetch(url).then(r => r.text()), server.PREFIX + '/?foo');
  expect(result).toBe('intercepted');
});

it('should intercept network activity from worker', async function({ page, server, isAndroid }) {
  it.skip(isAndroid);

  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/data_for_worker', (req, res) => res.end('failed to intercept'));
  const url = server.PREFIX + '/data_for_worker';
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      body: 'intercepted',
    }).catch(e => null);
  });
  const [msg] = await Promise.all([
    page.waitForEvent('console'),
    page.evaluate(url => new Worker(URL.createObjectURL(new Blob([`
      fetch("${url}").then(response => response.text()).then(console.log);
    `], { type: 'application/javascript' }))), url),
  ]);
  expect(msg.text()).toBe('intercepted');
});

it('should intercept worker requests when enabled after worker creation', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32355' }
}, async ({ page, server, isAndroid, browserName, browserMajorVersion }) => {
  it.skip(isAndroid);
  it.skip(browserName === 'chromium' && browserMajorVersion < 130, 'fixed in Chromium 130');

  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/data_for_worker', (req, res) => res.end('failed to intercept'));
  const url = server.PREFIX + '/data_for_worker';
  await Promise.all([
    page.waitForEvent('worker'),
    page.evaluate(url => {
      (window as any).w = new Worker(URL.createObjectURL(new Blob([`
        onmessage = function(e) {
          fetch("${url}").then(response => response.text()).then(console.log);
        };
      `], { type: 'application/javascript' })));
    }, url),
  ]);
  // Install the route **after** the worker has been created.
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      body: 'intercepted',
    }).catch(e => null);
  });
  const [msg] = await Promise.all([
    page.waitForEvent('console'),
    page.evaluate(() => (window as any).w.postMessage(''))
  ]);
  expect(msg.text()).toBe('intercepted');
});

it('should intercept network activity from worker 2', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31747' }
}, async ({ page, server, isAndroid }) => {
  it.skip(isAndroid);

  const url = server.PREFIX + '/worker/worker.js';
  await page.route(url, route => {
    route.fulfill({
      status: 200,
      body: 'console.log("intercepted");',
      contentType: 'application/javascript',
    }).catch(e => null);
  });
  const [msg] = await Promise.all([
    page.waitForEvent('console'),
    page.goto(server.PREFIX + '/worker/worker.html'),
  ]);
  expect(msg.text()).toBe('intercepted');
});

it('should work with regular expression passed from a different context', async ({ page, server }) => {
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
    void route.continue();
    intercepted = true;
  });

  const response = await page.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBe(true);
  expect(intercepted).toBe(true);
});

it('should not break remote worker importScripts', async ({ page, server }) => {
  await page.route('**', async route => {
    await route.continue();
  });
  await page.goto(server.PREFIX + '/worker/worker-http-import.html');
  await page.waitForSelector("#status:has-text('finished')");
});

it('should disable memory cache when intercepting', async ({ page, server }) => {
  let interceted = 0;
  await page.route('**/page.html', route => {
    ++interceted;
    void route.fulfill({
      body: 'success'
    });
  });
  await page.goto(server.PREFIX + '/page.html');
  expect(await page.locator('body').textContent()).toContain('success');
  await page.goto(server.EMPTY_PAGE);
  await expect(page).toHaveURL(server.EMPTY_PAGE);
  expect(interceted).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(server.PREFIX + '/page.html');
  expect(interceted).toBe(2);
});

it('should intercept blob url requests', async function({ page, server, browserName }) {
  it.fixme(browserName !== 'webkit');
  await page.goto(server.EMPTY_PAGE);
  await page.route('**/*', route => {
    route.fulfill({
      status: 200,
      body: 'intercepted',
    }).catch(e => null);
  });
  page.on('console', msg => console.log(msg.text()));
  const response = await page.evaluate(async () => {
    const blobUrl = URL.createObjectURL(new Blob(['failed to intercept'], { type: 'text/plain' }));
    return await fetch(blobUrl).then(response => response.text());
  });
  expect(response).toBe('intercepted');
});

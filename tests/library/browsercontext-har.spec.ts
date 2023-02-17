/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import path from 'path';
import extractZip from '../../packages/playwright-core/bundles/zip/node_modules/extract-zip';

it('should context.routeFromHAR, matching the method and following redirects', async ({ context, asset }) => {
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path);
  const page = await context.newPage();
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  // HAR contains a POST for the css file that should not be used.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

it('should page.routeFromHAR, matching the method and following redirects', async ({ context, asset }) => {
  const path = asset('har-fulfill.har');
  const page = await context.newPage();
  await page.routeFromHAR(path);
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  // HAR contains a POST for the css file that should not be used.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

it('fallback:continue should continue when not found in har', async ({ context, server, asset }) => {
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path, { notFound: 'fallback' });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/one-style.html');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('by default should abort requests not found in har', async ({ context, server, asset }) => {
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path);
  const page = await context.newPage();
  const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
  expect(error instanceof Error).toBe(true);
});

it('fallback:continue should continue requests on bad har', async ({ context, server }, testInfo) => {
  const path = testInfo.outputPath('test.har');
  fs.writeFileSync(path, JSON.stringify({ log: {} }), 'utf-8');
  await context.routeFromHAR(path, { notFound: 'fallback' });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/one-style.html');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('should only handle requests matching url filter', async ({ context, asset }) => {
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path, { notFound: 'fallback', url: '**/*.js' });
  const page = await context.newPage();
  await context.route('http://no.playwright/', async route => {
    expect(route.request().url()).toBe('http://no.playwright/');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script src="./script.js"></script><div>hello</div>',
    });
  });
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

it('should only context.routeFromHAR requests matching url filter', async ({ context, asset }) => {
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path, { url: '**/*.js' });
  const page = await context.newPage();
  await context.route('http://no.playwright/', async route => {
    expect(route.request().url()).toBe('http://no.playwright/');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script src="./script.js"></script><div>hello</div>',
    });
  });
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

it('should only page.routeFromHAR requests matching url filter', async ({ context, asset }) => {
  const path = asset('har-fulfill.har');
  const page = await context.newPage();
  await page.routeFromHAR(path, { url: '**/*.js' });
  await context.route('http://no.playwright/', async route => {
    expect(route.request().url()).toBe('http://no.playwright/');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script src="./script.js"></script><div>hello</div>',
    });
  });
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

it('should support regex filter', async ({ context, asset }) => {
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path, { url: /.*(\.js|.*\.css|no.playwright\/)$/ });
  const page = await context.newPage();
  await page.goto('http://no.playwright/');
  expect(await page.evaluate('window.value')).toBe('foo');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

it('newPage should fulfill from har, matching the method and following redirects', async ({ browser, asset }) => {
  const path = asset('har-fulfill.har');
  const page = await browser.newPage();
  await page.routeFromHAR(path);
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  // HAR contains a POST for the css file that should not be used.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
  await page.close();
});

it('should change document URL after redirected navigation', async ({ context, asset }) => {
  const path = asset('har-redirect.har');
  await context.routeFromHAR(path);
  const page = await context.newPage();
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.waitForURL('https://www.theverge.com/'),
    page.goto('https://theverge.com/')
  ]);
  await expect(page).toHaveURL('https://www.theverge.com/');
  expect(response.request().url()).toBe('https://www.theverge.com/');
  expect(await page.evaluate(() => location.href)).toBe('https://www.theverge.com/');
});

it('should change document URL after redirected navigation on click', async ({ server, context, asset }) => {
  const path = asset('har-redirect.har');
  await context.routeFromHAR(path, { url: /.*theverge.*/ });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href="https://theverge.com/">click me</a>`);
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.click('text=click me'),
  ]);
  await expect(page).toHaveURL('https://www.theverge.com/');
  expect(response.request().url()).toBe('https://www.theverge.com/');
  expect(await page.evaluate(() => location.href)).toBe('https://www.theverge.com/');
});

it('should goBack to redirected navigation', async ({ context, asset, server }) => {
  const path = asset('har-redirect.har');
  await context.routeFromHAR(path, { url: /.*theverge.*/ });
  const page = await context.newPage();
  await page.goto('https://theverge.com/');
  await page.goto(server.EMPTY_PAGE);
  await expect(page).toHaveURL(server.EMPTY_PAGE);
  const response = await page.goBack();
  await expect(page).toHaveURL('https://www.theverge.com/');
  expect(response.request().url()).toBe('https://www.theverge.com/');
  expect(await page.evaluate(() => location.href)).toBe('https://www.theverge.com/');
});

it('should goForward to redirected navigation', async ({ context, asset, server, browserName }) => {
  const path = asset('har-redirect.har');
  await context.routeFromHAR(path, { url: /.*theverge.*/ });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await expect(page).toHaveURL(server.EMPTY_PAGE);
  await page.goto('https://theverge.com/');
  await expect(page).toHaveURL('https://www.theverge.com/');
  await page.goBack();
  await expect(page).toHaveURL(server.EMPTY_PAGE);
  const response = await page.goForward();
  await expect(page).toHaveURL('https://www.theverge.com/');
  expect(response.request().url()).toBe('https://www.theverge.com/');
  expect(await page.evaluate(() => location.href)).toBe('https://www.theverge.com/');
});

it('should reload redirected navigation', async ({ context, asset, server }) => {
  const path = asset('har-redirect.har');
  await context.routeFromHAR(path, { url: /.*theverge.*/ });
  const page = await context.newPage();
  await page.goto('https://theverge.com/');
  await expect(page).toHaveURL('https://www.theverge.com/');
  const response = await page.reload();
  await expect(page).toHaveURL('https://www.theverge.com/');
  expect(response.request().url()).toBe('https://www.theverge.com/');
  expect(await page.evaluate(() => location.href)).toBe('https://www.theverge.com/');
});

it('should fulfill from har with content in a file', async ({ context, asset }) => {
  const path = asset('har-sha1.har');
  await context.routeFromHAR(path);
  const page = await context.newPage();
  await page.goto('http://no.playwright/');
  expect(await page.content()).toBe('<html><head></head><body>Hello, world</body></html>');
});

it('should round-trip har.zip', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory({ recordHar: { mode: 'minimal', path: harPath } });
  const page1 = await context1.newPage();
  await page1.goto(server.PREFIX + '/one-style.html');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { notFound: 'abort' });
  const page2 = await context2.newPage();
  await page2.goto(server.PREFIX + '/one-style.html');
  expect(await page2.content()).toContain('hello, world!');
  await expect(page2.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('should produce extracted zip', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.har');
  const context1 = await contextFactory({ recordHar: { mode: 'minimal', path: harPath, content: 'attach' } });
  const page1 = await context1.newPage();
  await page1.goto(server.PREFIX + '/one-style.html');
  await context1.close();

  expect(fs.existsSync(harPath)).toBeTruthy();
  const har = fs.readFileSync(harPath, 'utf-8');
  expect(har).not.toContain('background-color');

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { notFound: 'abort' });
  const page2 = await context2.newPage();
  await page2.goto(server.PREFIX + '/one-style.html');
  expect(await page2.content()).toContain('hello, world!');
  await expect(page2.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('should round-trip extracted har.zip', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory({ recordHar: { mode: 'minimal', path: harPath } });
  const page1 = await context1.newPage();
  await page1.goto(server.PREFIX + '/one-style.html');
  await context1.close();

  const harDir = testInfo.outputPath('hardir');
  await extractZip(harPath, { dir: harDir });

  const context2 = await contextFactory();
  await context2.routeFromHAR(path.join(harDir, 'har.har'));
  const page2 = await context2.newPage();
  await page2.goto(server.PREFIX + '/one-style.html');
  expect(await page2.content()).toContain('hello, world!');
  await expect(page2.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('should round-trip har with postData', async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/echo', async (req, res) => {
    const body = await req.postBody;
    res.end(body.toString());
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory({ recordHar: { mode: 'minimal', path: harPath } });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  const fetchFunction = async (body: string) => {
    const response = await fetch('/echo', { method: 'POST', body });
    return await response.text();
  };

  expect(await page1.evaluate(fetchFunction, '1')).toBe('1');
  expect(await page1.evaluate(fetchFunction, '2')).toBe('2');
  expect(await page1.evaluate(fetchFunction, '3')).toBe('3');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath);
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(fetchFunction, '1')).toBe('1');
  expect(await page2.evaluate(fetchFunction, '2')).toBe('2');
  expect(await page2.evaluate(fetchFunction, '3')).toBe('3');
  expect(await page2.evaluate(fetchFunction, '4').catch(e => e)).toBeTruthy();
});

it('should disambiguate by header', async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/echo', async (req, res) => {
    res.end(req.headers['baz']);
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory({ recordHar: { mode: 'minimal', path: harPath } });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);

  const fetchFunction = async (bazValue: string) => {
    const response = await fetch('/echo', {
      method: 'POST',
      body: '',
      headers: {
        foo: 'foo-value',
        bar: 'bar-value',
        baz: bazValue,
      }
    });
    return await response.text();
  };

  expect(await page1.evaluate(fetchFunction, 'baz1')).toBe('baz1');
  expect(await page1.evaluate(fetchFunction, 'baz2')).toBe('baz2');
  expect(await page1.evaluate(fetchFunction, 'baz3')).toBe('baz3');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath);
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(fetchFunction, 'baz1')).toBe('baz1');
  expect(await page2.evaluate(fetchFunction, 'baz2')).toBe('baz2');
  expect(await page2.evaluate(fetchFunction, 'baz3')).toBe('baz3');
  expect(await page2.evaluate(fetchFunction, 'baz4')).toBe('baz1');
});

it('should update har.zip for context', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.PREFIX + '/one-style.html');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { notFound: 'abort' });
  const page2 = await context2.newPage();
  await page2.goto(server.PREFIX + '/one-style.html');
  expect(await page2.content()).toContain('hello, world!');
  await expect(page2.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('should update har.zip for page', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  await page1.routeFromHAR(harPath, { update: true });
  await page1.goto(server.PREFIX + '/one-style.html');
  await context1.close();

  const context2 = await contextFactory();
  const page2 = await context2.newPage();
  await page2.routeFromHAR(harPath, { notFound: 'abort' });
  await page2.goto(server.PREFIX + '/one-style.html');
  expect(await page2.content()).toContain('hello, world!');
  await expect(page2.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

it('should update extracted har.zip for page', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.har');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  await page1.routeFromHAR(harPath, { update: true });
  await page1.goto(server.PREFIX + '/one-style.html');
  await context1.close();

  const context2 = await contextFactory();
  const page2 = await context2.newPage();
  await page2.routeFromHAR(harPath, { notFound: 'abort' });
  await page2.goto(server.PREFIX + '/one-style.html');
  expect(await page2.content()).toContain('hello, world!');
  await expect(page2.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
});

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
import { extractZip } from '../../packages/utils/third_party/extractZip';
import type http from 'http';
import type { BrowserContext, Page } from 'playwright-core';

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

it('should apply overrides before routing from har', async ({ context, asset }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29190' });
  const path = asset('har-fulfill.har');
  await context.routeFromHAR(path, { url: '**/*.js' });
  const page = await context.newPage();
  await context.route('http://no.playwright/my-script.js', async route => {
    await route.fallback({
      url: 'http://no.playwright/script2.js',
    });
  });
  await context.route('http://test.example/', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script src="http://no.playwright/my-script.js"></script><div>hello</div>',
    });
  });
  await page.goto('http://test.example/');
  // HAR contains script2.js that sets the value.
  expect(await page.evaluate('window.value')).toBe('foo');
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
  expect(response!.request().url()).toBe('https://www.theverge.com/');
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
  expect(response!.request().url()).toBe('https://www.theverge.com/');
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
  expect(response!.request().url()).toBe('https://www.theverge.com/');
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
  expect(response!.request().url()).toBe('https://www.theverge.com/');
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
  expect(response!.request().url()).toBe('https://www.theverge.com/');
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

  server.reset();
  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath);
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(fetchFunction, '1')).toBe('1');
  expect(await page2.evaluate(fetchFunction, '2')).toBe('2');
  expect(await page2.evaluate(fetchFunction, '3')).toBe('3');
  expect(await page2.evaluate(fetchFunction, '4').catch(e => e)).toBeTruthy();
});

it('should record overridden requests to har', async ({ contextFactory, server }, testInfo) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29190' });
  server.setRoute('/echo', async (req, res) => {
    const body = await req.postBody;
    res.end(body.toString());
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory({ recordHar: { mode: 'minimal', path: harPath } });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  const fetchFunction = async (arg: { path: string, body: string }) => {
    const response = await fetch(arg.path, { method: 'POST', body: arg.body });
    return await response.text();
  };
  await page1.route('**/echo_redir', async route => {
    await route.fallback({
      url: server.PREFIX + '/echo',
      postData: +route.request().postData() + 10,
    });
  });
  expect(await page1.evaluate(fetchFunction, { path: '/echo_redir', body: '1' })).toBe('11');
  expect(await page1.evaluate(fetchFunction, { path: '/echo_redir', body: '2' })).toBe('12');
  await context1.close();

  server.reset();
  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath);
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(fetchFunction, { path: '/echo', body: '11' })).toBe('11');
  expect(await page2.evaluate(fetchFunction, { path: '/echo', body: '12' })).toBe('12');
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

  // In recorded order a differing header value still picks the matching copy, and the last copy is reused once all are served.
  const context3 = await contextFactory();
  await context3.routeFromHAR(harPath, { replayOrder: 'recorded' });
  const page3 = await context3.newPage();
  await page3.goto(server.EMPTY_PAGE);
  expect(await page3.evaluate(fetchFunction, 'baz2')).toBe('baz2');
  expect(await page3.evaluate(fetchFunction, 'baz1')).toBe('baz1');
  expect(await page3.evaluate(fetchFunction, 'baz3')).toBe('baz3');
  expect(await page3.evaluate(fetchFunction, 'baz4')).toBe('baz3');
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

it('should ignore boundary when matching multipart/form-data body', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31495' }
}, async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <form id="form" action="form.html" enctype="multipart/form-data" method="POST">
      <input id="file" type="file" multiple />
      <button type="submit">Upload</button>
      </form>`);
  });
  server.setRoute('/form.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<div>done</div>');
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.PREFIX + '/empty.html');
  const reqPromise = server.waitForRequest('/form.html');
  await page1.locator('button').click();
  await expect(page1.locator('div')).toHaveText('done');
  const req = await reqPromise;
  expect((await req.postBody).toString()).toContain('---');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { notFound: 'abort' });
  const page2 = await context2.newPage();
  await page2.goto(server.PREFIX + '/empty.html');
  const requestPromise = page2.waitForRequest(/.*form.html/);
  await page2.locator('button').click();
  const request = await requestPromise;
  expect.soft(await request.response()).toBeTruthy();
  expect(request.failure()).toBe(null);
  await expect(page2.locator('div')).toHaveText('done');
});

it('should record single set-cookie headers', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31495' }
}, async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('set-cookie', ['first=foo']);
    res.end();
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  const cookie1 = await page1.evaluate(() => document.cookie);
  expect(cookie1).toBe('first=foo');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { notFound: 'abort' });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  const cookie2 = await page2.evaluate(() => document.cookie);
  expect(cookie2).toBe('first=foo');
});

it('should record multiple set-cookie headers', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31495' }
}, async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('set-cookie', ['first=foo', 'second=bar']);
    res.end();
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  const cookie1 = await page1.evaluate(() => document.cookie);
  expect(cookie1.split('; ').sort().join('; ')).toBe('first=foo; second=bar');
  await context1.close();

  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { notFound: 'abort' });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  const cookie2 = await page2.evaluate(() => document.cookie);
  expect(cookie2.split('; ').sort().join('; ')).toBe('first=foo; second=bar');
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

it('should update har.zip for page with different options', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  await page1.routeFromHAR(harPath, { update: true, updateContent: 'embed', updateMode: 'full' });
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

it('page.unrouteAll should stop page.routeFromHAR', async ({ contextFactory, server, asset }, testInfo) => {
  const harPath = asset('har-fulfill.har');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  // The har file contains requests for another domain, so the router
  // is expected to abort all requests.
  await page1.routeFromHAR(harPath, { notFound: 'abort' });
  await expect(page1.goto(server.EMPTY_PAGE)).rejects.toThrow();
  await page1.unrouteAll({ behavior: 'wait' });
  const response = await page1.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBeTruthy();
});

it('context.unrouteAll should stop context.routeFromHAR', async ({ contextFactory, server, asset }, testInfo) => {
  const harPath = asset('har-fulfill.har');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  // The har file contains requests for another domain, so the router
  // is expected to abort all requests.
  await context1.routeFromHAR(harPath, { notFound: 'abort' });
  await expect(page1.goto(server.EMPTY_PAGE)).rejects.toThrow();
  await context1.unrouteAll({ behavior: 'wait' });
  const response = await page1.goto(server.EMPTY_PAGE);
  expect(response.ok()).toBeTruthy();
});

it('should ignore aborted requests', async ({ contextFactory, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29311' });
  const path = it.info().outputPath('test.har');
  {
    server.setRoute('/x', (req, res) => { req.destroy(); });
    const context1 = await contextFactory();
    await context1.routeFromHAR(path, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    const reqPromise = server.waitForRequest('/x');
    const evalPromise = page1.evaluate(url => fetch(url).catch(e => 'cancelled'), server.PREFIX + '/x');
    await reqPromise;
    const req = await evalPromise;
    expect(req).toBe('cancelled');
    await context1.close();
  }
  server.reset();
  {
    server.setRoute('/x', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('test');
    });
    const context2 = await contextFactory();
    await context2.routeFromHAR(path);
    const page2 = await context2.newPage();
    await page2.goto(server.EMPTY_PAGE);
    const evalPromise = page2.evaluate(url => fetch(url).catch(e => 'cancelled'), server.PREFIX + '/x');
    const result = await Promise.race([evalPromise, page2.waitForTimeout(1000).then(() => 'timeout')]);
    expect(result).toBe('timeout');
  }
});

it('should serve repeated requests in recorded order', async ({ contextFactory, server }, testInfo) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/18288' });
  const items: string[] = [];
  server.setRoute('/items', async (req, res) => {
    if (req.method === 'PUT')
      items.push((await req.postBody).toString());
    res.end(JSON.stringify(items));
  });
  const readItems = () => fetch('/items').then(r => r.text());
  const addItem = (item: string) => fetch('/items', { method: 'PUT', body: item }).then(r => r.text());

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  expect(await page1.evaluate(readItems)).toBe('[]');
  expect(await page1.evaluate(addItem, 'apple')).toBe('["apple"]');
  expect(await page1.evaluate(readItems)).toBe('["apple"]');
  await context1.close();

  server.reset();
  // By default every request gets the best match, which is the first recording.
  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath);
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(readItems)).toBe('[]');
  expect(await page2.evaluate(addItem, 'apple')).toBe('["apple"]');
  expect(await page2.evaluate(readItems)).toBe('[]');

  const context3 = await contextFactory();
  await context3.routeFromHAR(harPath, { replayOrder: 'recorded' });
  const page3 = await context3.newPage();
  await page3.goto(server.EMPTY_PAGE);
  expect(await page3.evaluate(readItems)).toBe('[]');
  expect(await page3.evaluate(addItem, 'apple')).toBe('["apple"]');
  expect(await page3.evaluate(readItems)).toBe('["apple"]');
  // Once every recording has been served, the last one is reused.
  expect(await page3.evaluate(readItems)).toBe('["apple"]');
});

it('should keep recorded order across a redirected navigation', async ({ contextFactory, server }, testInfo) => {
  let visits = 0;
  server.setRedirect('/redirect', '/counter');
  server.setRoute('/counter', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<div>${++visits}</div>`);
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  await page1.routeFromHAR(harPath, { update: true });
  await page1.goto(server.PREFIX + '/redirect');
  await expect(page1.locator('div')).toHaveText('1');
  await page1.goto(server.PREFIX + '/counter');
  await expect(page1.locator('div')).toHaveText('2');
  await context1.close();

  server.reset();
  const context2 = await contextFactory();
  const page2 = await context2.newPage();
  await page2.routeFromHAR(harPath, { replayOrder: 'recorded' });
  // The redirected navigation is restarted at /counter and must land on the entry recorded behind the redirect.
  // Firefox records fewer request headers for that entry than for the direct navigation, so on Firefox this
  // also pins that a copy is not preferred for recording more headers.
  await page2.goto(server.PREFIX + '/redirect');
  await expect(page2).toHaveURL(server.PREFIX + '/counter');
  await expect(page2.locator('div')).toHaveText('1');
  await page2.goto(server.PREFIX + '/counter');
  await expect(page2.locator('div')).toHaveText('2');
});

it('should follow a redirect back to a url with a later copy', async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/app', (req, res) => {
    if (!req.headers.cookie?.includes('session=1')) {
      res.writeHead(302, { location: '/login' });
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end('<div>home</div>');
  });
  server.setRoute('/login', (req, res) => {
    res.writeHead(302, { 'set-cookie': 'session=1', 'location': '/app' });
    res.end();
  });

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.PREFIX + '/app');
  await expect(page1.locator('div')).toHaveText('home');
  await context1.close();

  server.reset();
  // The chain /app -> /login -> /app must end on the second copy of /app instead of reporting a redirect cycle.
  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath);
  const page2 = await context2.newPage();
  await page2.goto(server.PREFIX + '/app');
  await expect(page2).toHaveURL(server.PREFIX + '/app');
  await expect(page2.locator('div')).toHaveText('home');
});

type ApiCall = { method: string, path: string, body?: string };

async function callApi({ method, path, body }: ApiCall) {
  const response = await fetch(path, { method, body, headers: body ? { 'content-type': 'text/plain' } : {} });
  return `${response.status}:${await response.text()}`;
}

it('should replay a todo api flow in recorded order', async ({ contextFactory, server }, testInfo) => {
  type Todo = { id: number, text: string, done: boolean };
  let todos: Todo[] = [];
  const json = (res: http.ServerResponse, value: unknown) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(value));
  };
  server.setRoute('/api/todos', async (req, res) => {
    if (req.method === 'POST') {
      todos.push({ id: todos.length + 1, text: (await req.postBody).toString(), done: false });
      return json(res, { id: todos.length });
    }
    json(res, todos);
  });
  server.setRoute('/api/todos?done=true', (req, res) => json(res, todos.filter(t => t.done)));
  server.setRoute('/api/todos/latest', (req, res) => {
    res.writeHead(302, { location: '/api/todos/' + todos.length });
    res.end();
  });
  server.setRoute('/api/todos/1', (req, res) => {
    const todo = todos.find(t => t.id === 1)!;
    if (req.method === 'PATCH')
      todo.done = !todo.done;
    json(res, todo);
  });
  server.setRoute('/api/todos/2', (req, res) => {
    if (req.method === 'DELETE') {
      todos = todos.filter(t => t.id !== 2);
      res.writeHead(204);
      return res.end();
    }
    json(res, todos.find(t => t.id === 2));
  });

  const flow: ApiCall[] = [
    { method: 'GET', path: '/api/todos' },
    { method: 'POST', path: '/api/todos', body: 'buy milk' },
    { method: 'GET', path: '/api/todos/latest' },
    { method: 'GET', path: '/api/todos' },
    { method: 'POST', path: '/api/todos', body: 'walk dog' },
    { method: 'GET', path: '/api/todos/latest' },
    { method: 'GET', path: '/api/todos' },
    { method: 'PATCH', path: '/api/todos/1' },
    { method: 'GET', path: '/api/todos?done=true' },
    { method: 'DELETE', path: '/api/todos/2' },
    { method: 'GET', path: '/api/todos' },
    { method: 'GET', path: '/api/todos' },
  ];
  const runFlow = async (page: Page) => {
    const results: string[] = [];
    for (const step of flow)
      results.push(await page.evaluate(callApi, step));
    return results;
  };

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  const recorded = await runFlow(page1);
  await context1.close();
  expect(recorded[0]).toBe('200:[]');
  expect(recorded[2]).toBe('200:{"id":1,"text":"buy milk","done":false}');
  expect(recorded[5]).toBe('200:{"id":2,"text":"walk dog","done":false}');
  expect(recorded[8]).toBe('200:[{"id":1,"text":"buy milk","done":true}]');
  expect(recorded[9]).toBe('204:');
  expect(recorded[10]).toBe('200:[{"id":1,"text":"buy milk","done":true}]');

  server.reset();
  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { replayOrder: 'recorded' });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await runFlow(page2)).toEqual(recorded);
  // Routing again from the same file starts the sequence over.
  await context2.unrouteAll();
  await context2.routeFromHAR(harPath, { replayOrder: 'recorded' });
  expect(await page2.evaluate(callApi, flow[0])).toBe('200:[]');

  // By default the list never changes and the latest pointer keeps redirecting to the first todo.
  const context3 = await contextFactory();
  await context3.routeFromHAR(harPath);
  const page3 = await context3.newPage();
  await page3.goto(server.EMPTY_PAGE);
  const replayedByDefault = await runFlow(page3);
  expect(replayedByDefault[3]).toBe('200:[]');
  expect(replayedByDefault[5]).toBe(recorded[2]);
});

it('should replay polling and parallel requests in recorded order', async ({ contextFactory, server }, testInfo) => {
  const statuses = ['queued', 'running', 'done'];
  let polls = 0;
  let stats = 0;
  server.setRoute('/api/jobs', (req, res) => res.end('{"id":1}'));
  server.setRoute('/api/jobs/1', (req, res) => res.end(statuses[Math.min(polls++, statuses.length - 1)]));
  server.setRoute('/api/stats', (req, res) => res.end(String(++stats)));
  const startJob = () => fetch('/api/jobs', { method: 'POST' }).then(r => r.text());
  const poll = () => fetch('/api/jobs/1').then(r => r.text());
  const pollUntilDone = async () => {
    const seen: string[] = [];
    while (seen.length < 10 && seen[seen.length - 1] !== 'done')
      seen.push(await fetch('/api/jobs/1').then(r => r.text()));
    return seen;
  };
  const fetchStats = (count: number) => Promise.all(Array.from({ length: count }, () => fetch('/api/stats').then(r => r.text())));

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  await context1.routeFromHAR(harPath, { update: true });
  const page1 = await context1.newPage();
  await page1.goto(server.EMPTY_PAGE);
  expect(await page1.evaluate(startJob)).toBe('{"id":1}');
  expect(await page1.evaluate(pollUntilDone)).toEqual(statuses);
  expect(await page1.evaluate(poll)).toBe('done');
  expect((await page1.evaluate(fetchStats, 3)).sort()).toEqual(['1', '2', '3']);
  await context1.close();

  server.reset();
  const context2 = await contextFactory();
  await context2.routeFromHAR(harPath, { replayOrder: 'recorded' });
  const page2 = await context2.newPage();
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(startJob)).toBe('{"id":1}');
  expect(await page2.evaluate(pollUntilDone)).toEqual(statuses);
  // Polling past the recording keeps the final state.
  expect(await page2.evaluate(poll)).toBe('done');
  expect(await page2.evaluate(poll)).toBe('done');
  // Requests in flight at once each take their own copy, and pages of one context share the sequence.
  const page3 = await context2.newPage();
  await page3.goto(server.EMPTY_PAGE);
  const [fromPage2, fromPage3] = await Promise.all([page2.evaluate(fetchStats, 2), page3.evaluate(fetchStats, 1)]);
  expect([...fromPage2, ...fromPage3].sort()).toEqual(['1', '2', '3']);

  // By default a poll never advances.
  const context3 = await contextFactory();
  await context3.routeFromHAR(harPath);
  const page4 = await context3.newPage();
  await page4.goto(server.EMPTY_PAGE);
  expect(await page4.evaluate(pollUntilDone)).toEqual(Array(10).fill('queued'));
});

it('should replay a login flow with cookies in recorded order', async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/api/me', (req, res) => {
    if (!req.headers.cookie?.includes('session=1')) {
      res.writeHead(401);
      return res.end('{"error":"unauthenticated"}');
    }
    res.end('{"user":"alex"}');
  });
  server.setRoute('/api/login', (req, res) => {
    res.writeHead(200, { 'set-cookie': 'session=1; Path=/' });
    res.end('{"ok":true}');
  });
  server.setRoute('/api/logout', (req, res) => {
    res.writeHead(200, { 'set-cookie': 'session=; Path=/; Max-Age=0' });
    res.end('{"ok":true}');
  });
  const flow: ApiCall[] = [
    { method: 'GET', path: '/api/me' },
    { method: 'POST', path: '/api/login' },
    { method: 'GET', path: '/api/me' },
    { method: 'POST', path: '/api/logout' },
    { method: 'GET', path: '/api/me' },
  ];
  const expected = ['401:{"error":"unauthenticated"}', '200:{"ok":true}', '200:{"user":"alex"}', '200:{"ok":true}', '401:{"error":"unauthenticated"}'];
  const sessionCookies = async (context: BrowserContext) => (await context.cookies()).filter(c => c.name === 'session').map(c => c.value);

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  await page1.routeFromHAR(harPath, { update: true });
  await page1.goto(server.EMPTY_PAGE);
  for (let i = 0; i < flow.length; i++)
    expect(await page1.evaluate(callApi, flow[i])).toBe(expected[i]);
  await context1.close();

  server.reset();
  const context2 = await contextFactory();
  const page2 = await context2.newPage();
  await page2.routeFromHAR(harPath, { replayOrder: 'recorded' });
  await page2.goto(server.EMPTY_PAGE);
  expect(await page2.evaluate(callApi, flow[0])).toBe(expected[0]);
  expect(await page2.evaluate(callApi, flow[1])).toBe(expected[1]);
  // The replayed set-cookie header reaches the browser, so the next request carries the session.
  expect(await sessionCookies(context2)).toEqual(['1']);
  expect(await page2.evaluate(callApi, flow[2])).toBe(expected[2]);
  expect(await page2.evaluate(callApi, flow[3])).toBe(expected[3]);
  expect(await sessionCookies(context2)).toEqual([]);
  expect(await page2.evaluate(callApi, flow[4])).toBe(expected[4]);
});

it('should keep separate recorded orders for html and json copies of one url', async ({ contextFactory, server }, testInfo) => {
  const todos: string[] = [];
  server.setRoute('/todos', async (req, res) => {
    if (req.method === 'POST')
      todos.push((await req.postBody).toString());
    if (req.headers.accept?.includes('application/json')) {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(todos));
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><h1>${todos.length} todos</h1>`);
  });
  const fetchJson = () => fetch('/todos', { headers: { accept: 'application/json' } }).then(r => r.text());
  const addTodo = (text: string) => fetch('/todos', { method: 'POST', body: text }).then(r => r.text());

  const harPath = testInfo.outputPath('har.zip');
  const context1 = await contextFactory();
  const page1 = await context1.newPage();
  await page1.routeFromHAR(harPath, { update: true });
  await page1.goto(server.PREFIX + '/todos');
  await expect(page1.locator('h1')).toHaveText('0 todos');
  expect(await page1.evaluate(fetchJson)).toBe('[]');
  await page1.evaluate(addTodo, 'buy milk');
  await page1.reload();
  await expect(page1.locator('h1')).toHaveText('1 todos');
  expect(await page1.evaluate(fetchJson)).toBe('["buy milk"]');
  await context1.close();

  server.reset();
  const context2 = await contextFactory();
  const page2 = await context2.newPage();
  await page2.routeFromHAR(harPath, { replayOrder: 'recorded' });
  // Navigations consume the html copies in order and then keep the last one; the json copies stay untouched.
  await page2.goto(server.PREFIX + '/todos');
  await expect(page2.locator('h1')).toHaveText('0 todos');
  await page2.reload();
  await expect(page2.locator('h1')).toHaveText('1 todos');
  await page2.reload();
  await expect(page2.locator('h1')).toHaveText('1 todos');
  expect(await page2.evaluate(fetchJson)).toBe('[]');
  expect(await page2.evaluate(fetchJson)).toBe('["buy milk"]');
});

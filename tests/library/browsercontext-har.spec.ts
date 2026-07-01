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

it.describe('interceptAPIRequests', () => {
  it('should fulfill APIRequestContext requests from HAR', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22869' }
  }, async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ hello: 'live' }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    const recorded = await page1.request.get(server.PREFIX + '/api/data');
    expect(await recorded.json()).toEqual({ hello: 'live' });
    await context1.close();

    // Now stop serving on the network side - the request must come from the HAR.
    server.setRoute('/api/data', (req, res) => res.end('NOT_FROM_HAR'));
    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    const replayed = await page2.request.get(server.PREFIX + '/api/data');
    expect(await replayed.json()).toEqual({ hello: 'live' });
    await context2.close();
  });

  it('should not intercept APIRequestContext requests by default (backward compat)', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ hello: 'live' }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/data');
    await context1.close();

    // Without the option, the live network is hit.
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ hello: 'fresh' }));
    });
    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { notFound: 'fallback' });
    const page2 = await context2.newPage();
    const replayed = await page2.request.get(server.PREFIX + '/api/data');
    expect(await replayed.json()).toEqual({ hello: 'fresh' });
  });

  it('should fall back to the network when interceptAPIRequests + notFound:fallback', async ({ contextFactory, server }, testInfo) => {
    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await context1.close();

    server.setRoute('/api/missing', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ source: 'network' }));
    });

    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true, notFound: 'fallback' });
    const page2 = await context2.newPage();
    const response = await page2.request.get(server.PREFIX + '/api/missing');
    expect(await response.json()).toEqual({ source: 'network' });
  });

  it('should abort unmatched APIRequestContext requests when interceptAPIRequests + notFound:abort', async ({ contextFactory, server }, testInfo) => {
    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await context1.close();

    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true /* default notFound: abort */ });
    const page2 = await context2.newPage();
    const error = await page2.request.get(server.PREFIX + '/api/missing').catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('was not found in the HAR file');
  });

  it('should respect url filter for APIRequestContext requests', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ source: 'hario' }));
    });
    server.setRoute('/other', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ source: 'live' }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/data');
    await page1.request.get(server.PREFIX + '/other');
    await context1.close();

    // Re-route /api/data so that only the HAR can produce 'hario'.
    server.setRoute('/api/data', (req, res) => res.end('NOT_FROM_HAR'));

    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true, url: '**/api/**', notFound: 'fallback' });
    const page2 = await context2.newPage();
    const fromHar = await page2.request.get(server.PREFIX + '/api/data');
    expect(await fromHar.json()).toEqual({ source: 'hario' });
    // /other does not match the url filter, so it hits the network.
    const fromNetwork = await page2.request.get(server.PREFIX + '/other');
    expect(await fromNetwork.json()).toEqual({ source: 'live' });
  });

  it('should match APIRequestContext POST requests by body', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/echo', (req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ echoed: Buffer.concat(chunks).toString() }));
      });
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.post(server.PREFIX + '/echo', { data: 'one' });
    await page1.request.post(server.PREFIX + '/echo', { data: 'two' });
    await context1.close();

    server.setRoute('/echo', (req, res) => res.end('NOT_FROM_HAR'));
    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    const r1 = await page2.request.post(server.PREFIX + '/echo', { data: 'one' });
    const r2 = await page2.request.post(server.PREFIX + '/echo', { data: 'two' });
    expect(await r1.json()).toEqual({ echoed: 'one' });
    expect(await r2.json()).toEqual({ echoed: 'two' });
  });

  it('should stop intercepting APIRequestContext requests after unrouteAll', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ source: 'hario' }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/data');
    await context1.close();

    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    // First call: served from HAR.
    const first = await page2.request.get(server.PREFIX + '/api/data');
    expect(await first.json()).toEqual({ source: 'hario' });

    await context2.unrouteAll();
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ source: 'live' }));
    });

    // After unrouteAll: the registration is gone, the live network is hit.
    const second = await page2.request.get(server.PREFIX + '/api/data');
    expect(await second.json()).toEqual({ source: 'live' });
  });

  it('should only match _apiRequest entries when intercepting APIRequestContext', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22869' }
  }, async ({ contextFactory, server }, testInfo) => {
    // The HAR will contain TWO entries for the same URL: one from a browser fetch and one from
    // page.request. interceptAPIRequests must serve only the API-request entry.
    server.setRoute('/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      const fromApi = req.headers['x-from'] === 'api';
      res.end(JSON.stringify({ source: fromApi ? 'recorded-api' : 'recorded-browser' }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    // Browser-side fetch — recorded WITHOUT _apiRequest.
    await page1.evaluate(url => fetch(url, { headers: { 'x-from': 'browser' } }).then(r => r.json()), server.PREFIX + '/data');
    // API-request — recorded WITH _apiRequest:true.
    await page1.request.get(server.PREFIX + '/data', { headers: { 'x-from': 'api' } });
    await context1.close();

    // Sanity: the HAR must contain at least one _apiRequest entry.
    const harText = fs.readFileSync(harPath, 'utf-8');
    expect(harText).toContain('"_apiRequest":true');

    // Make the live network unreachable for this URL — if interception works correctly
    // we never hit the network anyway.
    server.setRoute('/data', (req, res) => res.end('NOT_FROM_HAR'));

    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    const apiResponse = await page2.request.get(server.PREFIX + '/data', { headers: { 'x-from': 'api' } });
    // Must be the recorded API entry, not the recorded browser entry.
    expect(await apiResponse.json()).toEqual({ source: 'recorded-api' });
  });

  it('should apply set-cookie side-effects from intercepted APIRequestContext requests', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/login', (req, res) => {
      res.setHeader('Set-Cookie', 'session=har-token; Path=/');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/login');
    await context1.close();

    server.setRoute('/api/login', (req, res) => res.end('NOT_FROM_HAR'));
    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    await page2.request.get(server.PREFIX + '/api/login');
    // The set-cookie from the HAR response must be applied to the browser context.
    const cookies = await context2.cookies(server.PREFIX);
    expect(cookies.find(c => c.name === 'session')?.value).toBe('har-token');
  });

  it('should populate statusText and serverAddr for intercepted APIRequestContext requests', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/data', (req, res) => {
      res.statusCode = 201;
      res.statusMessage = 'Created';
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    // 'full' mode records serverIPAddress/serverPort; the default 'minimal' mode omits them.
    await context1.routeFromHAR(harPath, { update: true, updateMode: 'full' });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/data');
    await context1.close();

    server.setRoute('/api/data', (req, res) => res.end('NOT_FROM_HAR'));
    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    const response = await page2.request.get(server.PREFIX + '/api/data');
    expect(response.status()).toBe(201);
    expect(response.statusText()).toBe('Created');
    const addr = await response.serverAddr();
    expect(addr!.ipAddress).toMatch(/127\.0\.0\.1|::1/);
    expect(addr!.port).toBe(server.PORT);
  });

  it('should re-record intercepted APIRequestContext requests into a new HAR', async ({ contextFactory, server }, testInfo) => {
    server.setRoute('/api/data', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ hello: 'live' }));
    });

    // Record the first HAR with the API request.
    const harPath1 = testInfo.outputPath('api1.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath1, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/data');
    await context1.close();

    // Replay from the first HAR while recording into a second HAR. The Request/RequestFinished
    // events emitted from the HAR-replay path must cause the API request to be captured again.
    server.setRoute('/api/data', (req, res) => res.end('NOT_FROM_HAR'));
    const harPath2 = testInfo.outputPath('api2.har');
    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath1, { interceptAPIRequests: true });
    await context2.routeFromHAR(harPath2, { update: true });
    const page2 = await context2.newPage();
    await page2.goto(server.EMPTY_PAGE);
    const replayed = await page2.request.get(server.PREFIX + '/api/data');
    expect(await replayed.json()).toEqual({ hello: 'live' });
    await context2.close();

    const harText = fs.readFileSync(harPath2, 'utf-8');
    expect(harText).toContain('"_apiRequest":true');
    expect(harText).toContain('/api/data');
  });

  it('should throw when intercepted APIRequestContext request exceeds maxRedirects', async ({ contextFactory, server }, testInfo) => {
    const redirect = '/api/step1';
    server.setRoute('/api/start', (req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', server.PREFIX + redirect);
      res.end();
    });
    server.setRoute('/api/step1', (req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', server.PREFIX + '/api/step2');
      res.end();
    });
    server.setRoute('/api/step2', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ done: true }));
    });

    const harPath = testInfo.outputPath('api.har');
    const context1 = await contextFactory();
    await context1.routeFromHAR(harPath, { update: true });
    const page1 = await context1.newPage();
    await page1.goto(server.EMPTY_PAGE);
    await page1.request.get(server.PREFIX + '/api/start');
    await context1.close();

    const context2 = await contextFactory();
    await context2.routeFromHAR(harPath, { interceptAPIRequests: true });
    const page2 = await context2.newPage();
    const error = await page2.request.get(server.PREFIX + '/api/start', { maxRedirects: 1 }).catch(e => e);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('Max redirect count exceeded');
  });
});

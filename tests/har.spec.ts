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

import { browserTest as it, expect } from './config/browserTest';
import fs from 'fs';
import type { BrowserContext, BrowserContextOptions } from '../index';

async function pageWithHar(contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>, testInfo: any) {
  const harPath = testInfo.outputPath('test.har');
  const context = await contextFactory({ recordHar: { path: harPath }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  return {
    page,
    context,
    getLog: async () => {
      await context.close();
      return JSON.parse(fs.readFileSync(harPath).toString())['log'];
    }
  };
}

it('should throw without path', async ({ browser }) => {
  const error = await browser.newContext({ recordHar: {} as any }).catch(e => e);
  expect(error.message).toContain('recordHar.path: expected string, got undefined');
});

it('should have version and creator', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  expect(log.version).toBe('1.2');
  expect(log.creator.name).toBe('Playwright');
  expect(log.creator.version).toBe(require('../package.json')['version']);
});

it('should have browser', async ({ browserName, browser, contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  expect(log.browser.name.toLowerCase()).toBe(browserName);
  expect(log.browser.version).toBe(browser.version());
});

it('should have pages', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto('data:text/html,<title>Hello</title>');
  // For data: load comes before domcontentloaded...
  await page.waitForLoadState('domcontentloaded');
  const log = await getLog();
  expect(log.pages.length).toBe(1);
  const pageEntry = log.pages[0];
  expect(pageEntry.id).toBe('page_0');
  expect(pageEntry.title).toBe('Hello');
  expect(new Date(pageEntry.startedDateTime).valueOf()).toBeGreaterThan(Date.now() - 3600 * 1000);
  expect(pageEntry.pageTimings.onContentLoad).toBeGreaterThan(0);
  expect(pageEntry.pageTimings.onLoad).toBeGreaterThan(0);
});

it('should have pages in persistent context', async ({ launchPersistent }, testInfo) => {
  const harPath = testInfo.outputPath('test.har');
  const { context, page } = await launchPersistent({ recordHar: { path: harPath } });
  await page.goto('data:text/html,<title>Hello</title>');
  // For data: load comes before domcontentloaded...
  await page.waitForLoadState('domcontentloaded');
  await context.close();
  const log = JSON.parse(fs.readFileSync(harPath).toString())['log'];
  expect(log.pages.length).toBe(1);
  const pageEntry = log.pages[0];
  expect(pageEntry.id).toBe('page_0');
  expect(pageEntry.title).toBe('Hello');
});

it('should include request', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  expect(log.entries.length).toBe(1);
  const entry = log.entries[0];
  expect(entry.pageref).toBe('page_0');
  expect(entry.request.url).toBe(server.EMPTY_PAGE);
  expect(entry.request.method).toBe('GET');
  expect(entry.request.httpVersion).toBe('HTTP/1.1');
  expect(entry.request.headers.length).toBeGreaterThan(1);
  expect(entry.request.headers.find(h => h.name.toLowerCase() === 'user-agent')).toBeTruthy();
});

it('should include response', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const entry = log.entries[0];
  expect(entry.response.status).toBe(200);
  expect(entry.response.statusText).toBe('OK');
  expect(entry.response.httpVersion).toBe('HTTP/1.1');
  expect(entry.response.headers.length).toBeGreaterThan(1);
  expect(entry.response.headers.find(h => h.name.toLowerCase() === 'content-type').value).toContain('text/html');
});

it('should include redirectURL', async ({ contextFactory, server }, testInfo) => {
  server.setRedirect('/foo.html', '/empty.html');
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/foo.html');
  const log = await getLog();
  expect(log.entries.length).toBe(2);
  const entry = log.entries[0];
  expect(entry.response.status).toBe(302);
  expect(entry.response.redirectURL).toBe(server.EMPTY_PAGE);
});

it('should include query params', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html?name=value');
  const log = await getLog();
  expect(log.entries[0].request.queryString).toEqual([{ name: 'name', value: 'value' }]);
});

it('should include postData', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => fetch('./post', { method: 'POST', body: 'Hello' }));
  const log = await getLog();
  expect(log.entries[1].request.postData).toEqual({
    mimeType: 'text/plain;charset=UTF-8',
    params: [],
    text: 'Hello'
  });
});

it('should include binary postData', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(async () => {
    await fetch('./post', { method: 'POST', body: new Uint8Array(Array.from(Array(16).keys())) });
  });
  const log = await getLog();
  expect(log.entries[1].request.postData).toEqual({
    mimeType: 'application/octet-stream',
    params: [],
    text: ''
  });
});

it('should include form params', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<form method='POST' action='/post'><input type='text' name='foo' value='bar'><input type='number' name='baz' value='123'><input type='submit'></form>`);
  await page.click('input[type=submit]');
  const log = await getLog();
  expect(log.entries[1].request.postData).toEqual({
    mimeType: 'application/x-www-form-urlencoded',
    params: [
      { name: 'foo', value: 'bar' },
      { name: 'baz', value: '123' }
    ],
    text: 'foo=bar&baz=123'
  });
});

it('should include cookies', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  const context = page.context();
  await context.addCookies([
    { name: 'name1', value: '"value1"', domain: 'localhost', path: '/', httpOnly: true },
    { name: 'name2', value: 'val"ue2', domain: 'localhost', path: '/', sameSite: 'Lax' },
    { name: 'name3', value: 'val=ue3', domain: 'localhost', path: '/' },
    { name: 'name4', value: 'val,ue4', domain: 'localhost', path: '/' },
  ]);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  expect(log.entries[0].request.cookies).toEqual([
    { name: 'name1', value: '"value1"' },
    { name: 'name2', value: 'val"ue2' },
    { name: 'name3', value: 'val=ue3' },
    { name: 'name4', value: 'val,ue4' },
  ]);
});

it('should include set-cookies', async ({ contextFactory, server, browserName, platform }, testInfo) => {
  it.fail(browserName === 'webkit' && platform === 'darwin', 'Does not work yet');

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      'name1=value1; HttpOnly',
      'name2="value2"',
      'name3=value4; Path=/; Domain=example.com; Max-Age=1500',
    ]);
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const cookies = log.entries[0].response.cookies;
  expect(cookies[0]).toEqual({ name: 'name1', value: 'value1', httpOnly: true });
  expect(cookies[1]).toEqual({ name: 'name2', value: '"value2"' });
  expect(new Date(cookies[2].expires).valueOf()).toBeGreaterThan(Date.now());
});

it('should include set-cookies with comma', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      'name1=val,ue1',
    ]);
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const cookies = log.entries[0].response.cookies;
  expect(cookies[0]).toEqual({ name: 'name1', value: 'val,ue1' });
});

it('should include secure set-cookies', async ({ contextFactory, httpsServer }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  httpsServer.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      'name1=value1; Secure',
    ]);
    res.end();
  });
  await page.goto(httpsServer.EMPTY_PAGE);
  const log = await getLog();
  const cookies = log.entries[0].response.cookies;
  expect(cookies[0]).toEqual({ name: 'name1', value: 'value1', secure: true });
});

it('should include content', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();

  const content1 = log.entries[0].response.content;
  expect(content1.encoding).toBe('base64');
  expect(content1.mimeType).toBe('text/html; charset=utf-8');
  expect(Buffer.from(content1.text, 'base64').toString()).toContain('HAR Page');

  const content2 = log.entries[1].response.content;
  expect(content2.encoding).toBe('base64');
  expect(content2.mimeType).toBe('text/css; charset=utf-8');
  expect(Buffer.from(content2.text, 'base64').toString()).toContain('pink');
});

it('should calculate time', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();
  expect(log.entries[0].time).toBeGreaterThan(0);
});

it('should have popup requests', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  await popup.waitForLoadState();
  const log = await getLog();

  expect(log.pages.length).toBe(2);
  expect(log.pages[0].id).toBe('page_0');
  expect(log.pages[1].id).toBe('page_1');

  const entries = log.entries.filter(entry => entry.pageref === 'page_1');
  expect(entries.length).toBe(2);
  expect(entries[0].request.url).toBe(server.PREFIX + '/one-style.html');
  expect(entries[0].response.status).toBe(200);
  expect(entries[1].request.url).toBe(server.PREFIX + '/one-style.css');
  expect(entries[1].response.status).toBe(200);
});

it('should not contain internal pages', async ({ browserName, contextFactory, server }, testInfo) => {
  it.fixme(true, 'https://github.com/microsoft/playwright/issues/6743');
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', 'name=value');
    res.end();
  });

  const { page, context, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);

  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  // Get storage state, this create internal page.
  await context.storageState();

  const log = await getLog();
  expect(log.pages.length).toBe(1);
});

it('should have connection details', async ({ contextFactory, server, browserName, platform }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const { serverIPAddress, _serverPort: port, _securityDetails: securityDetails } = log.entries[0];
  expect(serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
  expect(port).toBe(server.PORT);
  expect(securityDetails).toEqual({});
});

it('should have security details', async ({ contextFactory, httpsServer, browserName, platform }, testInfo) => {
  it.fail(browserName === 'webkit' && platform === 'linux', 'https://github.com/microsoft/playwright/issues/6759');

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(httpsServer.EMPTY_PAGE);
  const log = await getLog();
  const { serverIPAddress, _serverPort: port, _securityDetails: securityDetails } = log.entries[0];
  expect(serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
  expect(port).toBe(httpsServer.PORT);
  if (browserName === 'webkit' && platform === 'win32')
    expect(securityDetails).toEqual({subjectName: 'puppeteer-tests', validFrom: 1550084863, validTo: -1});
  else if (browserName === 'webkit')
    expect(securityDetails).toEqual({protocol: 'TLS 1.3', subjectName: 'puppeteer-tests', validFrom: 1550084863, validTo: 33086084863});
  else
    expect(securityDetails).toEqual({issuer: 'puppeteer-tests', protocol: 'TLS 1.3', subjectName: 'puppeteer-tests', validFrom: 1550084863, validTo: 33086084863});
});

it('should have connection details for redirects', async ({ contextFactory, server, browserName }, testInfo) => {
  server.setRedirect('/foo.html', '/empty.html');
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/foo.html');
  const log = await getLog();
  expect(log.entries.length).toBe(2);

  const detailsFoo = log.entries[0];

  if (browserName === 'webkit') {
    expect(detailsFoo.serverIPAddress).toBeUndefined();
    expect(detailsFoo._serverPort).toBeUndefined();
  } else {
    expect(detailsFoo.serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(detailsFoo._serverPort).toBe(server.PORT);
  }

  const detailsEmpty = log.entries[1];
  expect(detailsEmpty.serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
  expect(detailsEmpty._serverPort).toBe(server.PORT);
});

it('should have connection details for failed requests', async ({ contextFactory, server, browserName, platform }, testInfo) => {
  server.setRoute('/one-style.css', (_, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.connection.destroy();
  });
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/one-style.html');
  const log = await getLog();
  const { serverIPAddress, _serverPort: port } = log.entries[0];
  expect(serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
  expect(port).toBe(server.PORT);
});

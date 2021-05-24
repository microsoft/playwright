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
  expect(entry.request.httpVersion).toBe('http/1.1');
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
  expect(entry.response.httpVersion).toBe('http/1.1');
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

  const response1 = log.entries[0].response;
  expect(response1.bodySize).toBe(96);
  expect(response1.headersSize).toBe(198);
  expect(response1.httpVersion).toBe('http/1.1');
  expect(response1._transferSize).toBe(294);
  expect(response1.content.encoding).toBe('base64');
  expect(response1.content.mimeType).toBe('text/html; charset=utf-8');
  expect(Buffer.from(response1.content.text, 'base64').toString()).toContain('HAR Page');
  expect(response1.content.size).toBe(96);
  expect(response1.content.compression).toBe(0);

  const response2 = log.entries[1].response;
  expect(response2.bodySize).toBe(37);
  expect(response2.headersSize).toBe(197);
  expect(response2.httpVersion).toBe('http/1.1');
  expect(response2._transferSize).toBe(234);
  expect(response2.content.encoding).toBe('base64');
  expect(response2.content.mimeType).toBe('text/css; charset=utf-8');
  expect(Buffer.from(response2.content.text, 'base64').toString()).toContain('pink');
  expect(response2.content.size).toBe(37);
  expect(response2.content.compression).toBe(0);
});


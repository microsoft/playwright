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

import { browserTest as it, expect } from '../config/browserTest';
import * as path from 'path';
import fs from 'fs';
import type { BrowserContext, BrowserContextOptions } from 'playwright-core';
import type { AddressInfo } from 'net';
import type { Log } from '../../packages/trace/src/har';
import { parseHar } from '../config/utils';
const { createHttp2Server } = require('../../packages/playwright-core/lib/utils');

async function pageWithHar(contextFactory: (options?: BrowserContextOptions) => Promise<BrowserContext>, testInfo: any, options: { outputPath?: string, content?: 'embed' | 'attach' | 'omit', omitContent?: boolean } = {}) {
  const harPath = testInfo.outputPath(options.outputPath || 'test.har');
  const context = await contextFactory({ recordHar: { path: harPath, content: options.content, omitContent: options.omitContent }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  return {
    page,
    context,
    getLog: async () => {
      await context.close();
      return JSON.parse(fs.readFileSync(harPath).toString())['log'] as Log;
    },
    getZip: async () => {
      await context.close();
      return parseHar(harPath);
    },
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
  expect(log.creator.version).toContain(process.env.PW_VERSION_OVERRIDE || require('../../package.json')['version']);
});

it('should have browser', async ({ browserName, browser, contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  expect(log.browser!.name.toLowerCase()).toBe(browserName);
  expect(log.browser!.version).toBe(browser.version());
});

it('should have pages', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto('data:text/html,<title>Hello</title>');
  // For data: load comes before domcontentloaded...
  await page.waitForLoadState('domcontentloaded');
  const log = await getLog();
  expect(log.pages!.length).toBe(1);
  const pageEntry = log.pages![0];
  expect(pageEntry.id).toBeTruthy();
  expect(pageEntry.title).toBe('Hello');
  expect(new Date(pageEntry.startedDateTime).valueOf()).toBeGreaterThan(Date.now() - 3600 * 1000);
  expect(pageEntry.pageTimings.onContentLoad).toBeGreaterThan(0);
  expect(pageEntry.pageTimings.onLoad).toBeGreaterThan(0);
});

it('should have pages in persistent context', async ({ launchPersistent, browserName }, testInfo) => {
  const harPath = testInfo.outputPath('test.har');
  const { context, page } = await launchPersistent({ recordHar: { path: harPath } });
  await page.goto('data:text/html,<title>Hello</title>');
  // For data: load comes before domcontentloaded...
  await page.waitForLoadState('domcontentloaded');
  await context.close();
  const log = JSON.parse(fs.readFileSync(harPath).toString())['log'];
  let pageEntry;
  if (browserName === 'webkit') {
  // Explicit locale emulation forces a new page creation when
  // doing a new context.
  // See https://github.com/microsoft/playwright/blob/13dd41c2e36a63f35ddef5dc5dec322052d670c6/packages/playwright-core/src/server/browserContext.ts#L232-L242
    expect(log.pages.length).toBe(2);
    pageEntry = log.pages[1];
  } else {
    expect(log.pages.length).toBe(1);
    pageEntry = log.pages[0];
  }
  expect(pageEntry.id).toBeTruthy();
  expect(pageEntry.title).toBe('Hello');
});

it('should include request', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  expect(log.entries.length).toBe(1);
  const entry = log.entries[0];
  expect(entry.pageref).toBe(log.pages![0].id);
  expect(entry.request.url).toBe(server.EMPTY_PAGE);
  expect(entry.request.method).toBe('GET');
  expect(entry.request.httpVersion).toBe('HTTP/1.1');
  expect(entry.request.headers.length).toBeGreaterThan(1);
  expect(entry.request.headers.find(h => h.name.toLowerCase() === 'user-agent')).toBeTruthy();
  expect(entry.request.bodySize).toBe(0);
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
  expect(entry.response.headers.find(h => h.name.toLowerCase() === 'content-type')!.value).toContain('text/html');
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

it('should include set-cookies', async ({ contextFactory, server }, testInfo) => {
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
  expect(new Date(cookies[2].expires!).valueOf()).toBeGreaterThan(Date.now());
});

it('should skip invalid Expires', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      'name=value;Expires=Sat Sep 14 01:02:27 CET 2024',
    ]);
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const cookies = log.entries[0].response.cookies;
  expect(cookies[0]).toEqual({ name: 'name', value: 'value' });
});

it('should include set-cookies with comma', async ({ contextFactory, server, browserName }, testInfo) => {
  it.fixme(browserName === 'webkit', 'We get "name1=val, ue1, name2=val, ue2" as a header value');
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Set-Cookie', [
      'name1=val, ue1', 'name2=val, ue2',
    ]);
    res.end();
  });
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const cookies = log.entries[0].response.cookies;
  expect(cookies[0]).toEqual({ name: 'name1', value: 'val, ue1' });
  expect(cookies[1]).toEqual({ name: 'name2', value: 'val, ue2' });
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

it('should record request overrides', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.route('**/foo', route => {
    void route.fallback({
      url: server.EMPTY_PAGE,
      method: 'POST',
      headers: {
        ...route.request().headers(),
        'content-type': 'text/plain',
        'cookie': 'foo=bar',
        'custom': 'value'
      },
      postData: 'Hi!'
    });
  });

  await page.goto(server.PREFIX + '/foo');
  const log = await getLog();
  const request = log.entries[0].request;
  expect(request.url).toBe(server.EMPTY_PAGE);
  expect(request.method).toBe('POST');
  expect(request.headers).toContainEqual({ name: 'custom', value: 'value' });
  expect(request.cookies).toContainEqual({ name: 'foo', value: 'bar' });
  expect(request.postData).toEqual({ 'mimeType': 'text/plain', 'params': [], 'text': 'Hi!' });
});

it('should include content @smoke', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  await page.evaluate(() => fetch('/pptr.png').then(r => r.arrayBuffer()));
  const log = await getLog();

  expect(log.entries[0].response.content.encoding).toBe(undefined);
  expect(log.entries[0].response.content.mimeType).toBe('text/html; charset=utf-8');
  expect(log.entries[0].response.content.text).toContain('HAR Page');
  expect(log.entries[0].response.content.size).toBeGreaterThanOrEqual(96);
  expect(log.entries[0].response.content.compression).toBe(0);

  expect(log.entries[1].response.content.encoding).toBe(undefined);
  expect(log.entries[1].response.content.mimeType).toBe('text/css; charset=utf-8');
  expect(log.entries[1].response.content.text).toContain('pink');
  expect(log.entries[1].response.content.size).toBeGreaterThanOrEqual(37);
  expect(log.entries[1].response.content.compression).toBe(0);

  expect(log.entries[2].response.content.encoding).toBe('base64');
  expect(log.entries[2].response.content.mimeType).toBe('image/png');
  expect(Buffer.from(log.entries[2].response.content.text!, 'base64').byteLength).toBeGreaterThan(0);
  expect(log.entries[2].response.content.size).toBeGreaterThanOrEqual(6000);
  expect(log.entries[2].response.content.compression).toBe(0);
});

it('should use attach mode for zip extension', async ({ contextFactory, server }, testInfo) => {
  const { page, getZip } = await pageWithHar(contextFactory, testInfo, { outputPath: 'test.har.zip' });
  await page.goto(server.PREFIX + '/har.html');
  await page.evaluate(() => fetch('/pptr.png').then(r => r.arrayBuffer()));
  const zip = await getZip();
  const log = JSON.parse(zip.get('har.har')!.toString())['log'] as Log;
  expect(log.entries[0].response.content.text).toBe(undefined);
  expect(zip.get('75841480e2606c03389077304342fac2c58ccb1b.html')!.toString()).toContain('HAR Page');
});

it('should omit content', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo, { content: 'omit', outputPath: 'test.har' });
  await page.goto(server.PREFIX + '/har.html');
  await page.evaluate(() => fetch('/pptr.png').then(r => r.arrayBuffer()));
  const log = await getLog();
  expect(log.entries[0].response.content.text).toBe(undefined);
  expect(log.entries[0].response.content._file).toBe(undefined);
});

it('should omit content legacy', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo, { omitContent: true, outputPath: 'test.har' });
  await page.goto(server.PREFIX + '/har.html');
  await page.evaluate(() => fetch('/pptr.png').then(r => r.arrayBuffer()));
  const log = await getLog();
  expect(log.entries[0].response.content.text).toBe(undefined);
  expect(log.entries[0].response.content._file).toBe(undefined);
});

it('should attach content', async ({ contextFactory, server }, testInfo) => {
  const { page, getZip } = await pageWithHar(contextFactory, testInfo, { content: 'attach', outputPath: 'test.har.zip' });
  await page.goto(server.PREFIX + '/har.html');
  await page.evaluate(() => fetch('/pptr.png').then(r => r.arrayBuffer()));
  const zip = await getZip();
  const log = JSON.parse(zip.get('har.har')!.toString())['log'] as Log;

  expect(log.entries[0].response.content.encoding).toBe(undefined);
  expect(log.entries[0].response.content.mimeType).toBe('text/html; charset=utf-8');
  expect(log.entries[0].response.content._file).toContain('75841480e2606c03389077304342fac2c58ccb1b');
  expect(log.entries[0].response.content.size).toBeGreaterThanOrEqual(96);
  expect(log.entries[0].response.content.compression).toBe(0);

  expect(log.entries[1].response.content.encoding).toBe(undefined);
  expect(log.entries[1].response.content.mimeType).toBe('text/css; charset=utf-8');
  expect(log.entries[1].response.content._file).toContain('79f739d7bc88e80f55b9891a22bf13a2b4e18adb');
  expect(log.entries[1].response.content.size).toBeGreaterThanOrEqual(37);
  expect(log.entries[1].response.content.compression).toBe(0);

  expect(log.entries[2].response.content.encoding).toBe(undefined);
  expect(log.entries[2].response.content.mimeType).toBe('image/png');
  expect(log.entries[2].response.content._file).toContain('a4c3a18f0bb83f5d9fe7ce561e065c36205762fa');
  expect(log.entries[2].response.content.size).toBeGreaterThanOrEqual(6000);
  expect(log.entries[2].response.content.compression).toBe(0);

  expect(zip.get('75841480e2606c03389077304342fac2c58ccb1b.html')!.toString()).toContain('HAR Page');
  expect(zip.get('79f739d7bc88e80f55b9891a22bf13a2b4e18adb.css')!.toString()).toContain('pink');
  expect(zip.get('a4c3a18f0bb83f5d9fe7ce561e065c36205762fa.png')!.byteLength).toBe(log.entries[2].response.content.size);
});

it('should filter by glob', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('test.har');
  const context = await contextFactory({ baseURL: server.PREFIX, recordHar: { path: harPath, urlFilter: '/*.css' }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto('/har.html');
  await context.close();
  const log = JSON.parse(fs.readFileSync(harPath).toString())['log'] as Log;
  expect(log.entries.length).toBe(1);
  expect(log.entries[0].request.url.endsWith('one-style.css')).toBe(true);
});

it('should filter by regexp', async ({ contextFactory, server }, testInfo) => {
  const harPath = testInfo.outputPath('test.har');
  const context = await contextFactory({ recordHar: { path: harPath, urlFilter: /HAR.X?HTML/i }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/har.html');
  await context.close();
  const log = JSON.parse(fs.readFileSync(harPath).toString())['log'] as Log;
  expect(log.entries.length).toBe(1);
  expect(log.entries[0].request.url.endsWith('har.html')).toBe(true);
});

it('should include sizes', async ({ contextFactory, server, asset }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();
  expect(log.entries.length).toBe(2);
  expect(log.entries[0].request.url.endsWith('har.html')).toBe(true);
  expect(log.entries[0].request.headersSize).toBeGreaterThanOrEqual(100);
  expect(log.entries[0].response.bodySize).toBe(fs.statSync(asset('har.html')).size);
  expect(log.entries[0].response.headersSize).toBeGreaterThanOrEqual(100);
  expect(log.entries[0].response._transferSize).toBeGreaterThanOrEqual(250);

  expect(log.entries[1].request.url.endsWith('one-style.css')).toBe(true);
  expect(log.entries[1].response.bodySize).toBe(fs.statSync(asset('one-style.css')).size);
  expect(log.entries[1].response.headersSize).toBeGreaterThanOrEqual(100);
  expect(log.entries[1].response._transferSize).toBeGreaterThanOrEqual(150);
});

it('should work with gzip compression', async ({ contextFactory, server, browserName }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.enableGzip('/simplezip.json');
  const response = await page.goto(server.PREFIX + '/simplezip.json');
  expect(response!.headers()['content-encoding']).toBe('gzip');
  const log = await getLog();
  expect(log.entries.length).toBe(1);
  expect(log.entries[0].response.content.compression).toBeGreaterThan(4000);
});

it('should calculate time', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();
  expect(log.entries[0].time).toBeGreaterThan(0);
});

it('should return receive time', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();
  expect(log.entries[0].timings.receive).toBeGreaterThan(0);
});

it('should report the correct _transferSize with PNG files', async ({ contextFactory, server, asset }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <img src="${server.PREFIX}/pptr.png" />
  `);
  const log = await getLog();
  expect(log.entries[1].response._transferSize).toBeGreaterThan(fs.statSync(asset('pptr.png')).size);
});

it('should have -1 _transferSize when its a failed request', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/one-style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.socket!.destroy();
  });
  const failedRequests = [];
  page.on('requestfailed', request => failedRequests.push(request));
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();
  expect(log.entries[1].request.url.endsWith('/one-style.css')).toBe(true);
  expect(log.entries[1].response._transferSize).toBe(-1);
});

it('should record failed request headers', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/har.html', (req, res) => {
    res.socket!.destroy();
  });
  await page.goto(server.PREFIX + '/har.html').catch(() => {});
  const log = await getLog();
  expect(log.entries[0].response._failureText).toBeTruthy();
  const request = log.entries[0].request;
  expect(request.url.endsWith('/har.html')).toBe(true);
  expect(request.method).toBe('GET');
  expect(request.headers).toContainEqual(expect.objectContaining({ name: 'User-Agent' }));
});

it('should record failed request overrides', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  server.setRoute('/empty.html', (req, res) => {
    res.socket!.destroy();
  });
  await page.route('**/foo', route => {
    void route.fallback({
      url: server.EMPTY_PAGE,
      method: 'POST',
      headers: {
        ...route.request().headers(),
        'content-type': 'text/plain',
        'cookie': 'foo=bar',
        'custom': 'value'
      },
      postData: 'Hi!'
    });
  });
  await page.goto(server.PREFIX + '/foo').catch(() => {});
  const log = await getLog();
  expect(log.entries[0].response._failureText).toBeTruthy();
  const request = log.entries[0].request;
  expect(request.url).toBe(server.EMPTY_PAGE);
  expect(request.method).toBe('POST');
  expect(request.headers).toContainEqual({ name: 'custom', value: 'value' });
  expect(request.cookies).toContainEqual({ name: 'foo', value: 'bar' });
  expect(request.postData).toEqual({ 'mimeType': 'text/plain', 'params': [], 'text': 'Hi!' });
});

it('should report the correct request body size', async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/api', (req, res) => res.end());
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await Promise.all([
    page.waitForResponse(server.PREFIX + '/api1'),
    page.evaluate(() => {
      void fetch('/api1', {
        method: 'POST',
        body: 'abc123'
      });
    })
  ]);
  const log = await getLog();
  expect(log.entries[1].request.bodySize).toBe(6);
});

it('should report the correct request body size when the bodySize is 0', async ({ contextFactory, server }, testInfo) => {
  server.setRoute('/api', (req, res) => res.end());
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await Promise.all([
    page.waitForResponse(server.PREFIX + '/api2'),
    page.evaluate(() => {
      void fetch('/api2', {
        method: 'POST',
        body: ''
      });
    })
  ]);
  const log = await getLog();
  expect(log.entries[1].request.bodySize).toBe(0);
});

it('should report the correct response body size when the bodySize is 0', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  const response = await page.goto(server.EMPTY_PAGE);
  await response!.finished();
  const log = await getLog();
  expect(log.entries[0].response.bodySize).toBe(0);
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

  expect(log.pages!.length).toBe(2);

  const entries = log.entries.filter(entry => entry.pageref === log.pages![1].id);
  expect(entries.length).toBe(2);
  expect(entries[0].request.url).toBe(server.PREFIX + '/one-style.html');
  expect(entries[0].response.status).toBe(200);
  expect(entries[1].request.url).toBe(server.PREFIX + '/one-style.css');
  expect(entries[1].response.status).toBe(200);
});

it('should not contain internal pages', async ({ browserName, contextFactory, server }, testInfo) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/6743' });

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
  expect(log.pages!.length).toBe(1);
});

it('should have connection details', async ({ contextFactory, server, browserName, platform, mode }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  const log = await getLog();
  const { serverIPAddress, _serverPort: port, _securityDetails: securityDetails } = log.entries[0];
  if (!mode.startsWith('service')) {
    expect(serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(port).toBe(server.PORT);
  }
  expect(securityDetails).toEqual({});
});

it('should have security details', async ({ contextFactory, httpsServer, browserName, platform, mode }, testInfo) => {
  it.fail(browserName === 'webkit' && platform === 'linux', 'https://github.com/microsoft/playwright/issues/6759');
  it.fail(browserName === 'webkit' && platform === 'win32');

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(httpsServer.EMPTY_PAGE);
  const log = await getLog();
  const { serverIPAddress, _serverPort: port, _securityDetails: securityDetails } = log.entries[0];
  if (!mode.startsWith('service')) {
    expect(serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(port).toBe(httpsServer.PORT);
  }
  if (browserName === 'webkit' && platform === 'darwin')
    expect(securityDetails).toEqual({ protocol: 'TLS 1.3', subjectName: 'playwright-test', validFrom: 1691708270, validTo: 2007068270 });
  else
    expect(securityDetails).toEqual({ issuer: 'playwright-test', protocol: 'TLS 1.3', subjectName: 'playwright-test', validFrom: 1691708270, validTo: 2007068270 });
});

it('should have connection details for redirects', async ({ contextFactory, server, browserName, mode }, testInfo) => {
  server.setRedirect('/foo.html', '/empty.html');
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/foo.html');
  const log = await getLog();
  expect(log.entries.length).toBe(2);

  const detailsFoo = log.entries[0];

  if (browserName === 'webkit') {
    expect(detailsFoo.serverIPAddress).toBeUndefined();
    expect(detailsFoo._serverPort).toBeUndefined();
  } else if (!mode.startsWith('service')) {
    expect(detailsFoo.serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(detailsFoo._serverPort).toBe(server.PORT);
  }

  if (!mode.startsWith('service')) {
    const detailsEmpty = log.entries[1];
    expect(detailsEmpty.serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(detailsEmpty._serverPort).toBe(server.PORT);
  }
});

it('should have connection details for failed requests', async ({ contextFactory, server, browserName, platform, mode }, testInfo) => {
  server.setRoute('/one-style.css', (_, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.socket!.destroy();
  });
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/one-style.html');
  const log = await getLog();
  if (!mode.startsWith('service')) {
    const { serverIPAddress, _serverPort: port } = log.entries[0];
    expect(serverIPAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(port).toBe(server.PORT);
  }
});

it('should return server address directly from response', async ({ page, server, mode }) => {
  const response = await page.goto(server.EMPTY_PAGE);
  if (!mode.startsWith('service')) {
    const { ipAddress, port } = (await response!.serverAddr())!;
    expect(ipAddress).toMatch(/^127\.0\.0\.1|\[::1\]/);
    expect(port).toBe(server.PORT);
  }
});

it('should return security details directly from response', async ({ contextFactory, httpsServer, browserName, platform }) => {
  it.fail(browserName === 'webkit' && platform === 'linux', 'https://github.com/microsoft/playwright/issues/6759');

  const context = await contextFactory({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const response = await page.goto(httpsServer.EMPTY_PAGE);
  const securityDetails = await response!.securityDetails();
  if (browserName === 'webkit' && platform === 'win32')
    expect({ ...securityDetails, protocol: undefined }).toEqual({ subjectName: 'playwright-test', validFrom: 1691708270, validTo: 2007068270 });
  else if (browserName === 'webkit')
    expect(securityDetails).toEqual({ protocol: 'TLS 1.3', subjectName: 'playwright-test', validFrom: 1691708270, validTo: 2007068270 });
  else
    expect(securityDetails).toEqual({ issuer: 'playwright-test', protocol: 'TLS 1.3', subjectName: 'playwright-test', validFrom: 1691708270, validTo: 2007068270 });
});

it('should contain http2 for http2 requests', async ({ contextFactory }, testInfo) => {
  const server = createHttp2Server({
    key: await fs.promises.readFile(path.join(__dirname, '..', 'config', 'testserver', 'key.pem')),
    cert: await fs.promises.readFile(path.join(__dirname, '..', 'config', 'testserver', 'cert.pem')),
  });
  server.on('stream', stream => {
    stream.respond({
      'content-type': 'text/html; charset=utf-8',
      ':status': 200
    });
    stream.end('<h1>Hello World</h1>');
  });
  server.listen(0);

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(`https://localhost:${(server.address() as AddressInfo).port}`);
  const log = await getLog();
  expect(log.entries[0].request.httpVersion).toBe('HTTP/2.0');
  expect(log.entries[0].response.httpVersion).toBe('HTTP/2.0');
  expect(log.entries[0].response.content.text).toBe('<h1>Hello World</h1>');
  server.close();
});

it('should filter favicon and favicon redirects', async ({ server, browserName, channel, headless, asset, contextFactory }, testInfo) => {
  it.skip(headless && browserName !== 'firefox', 'headless browsers, except firefox, do not request favicons');
  it.skip(!headless && browserName === 'webkit' && !channel, 'headed webkit does not have a favicon feature');

  const { page, getLog } = await pageWithHar(contextFactory, testInfo);

  // Browsers aggressively cache favicons, so force bust with the
  // `d` parameter to make iterating on this test more predictable and isolated.
  const favicon = `/no-cache-2/favicon.ico`;
  const hashedFaviconUrl = `/favicon-hashed.ico`;
  server.setRedirect(favicon, hashedFaviconUrl);
  server.setRoute(hashedFaviconUrl, (req, res) => {
    server.serveFile(req, res, asset('media-query-prefers-color-scheme.svg'));
  });

  server.setRoute('/page.html', (_, res) => {
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <link rel="icon" type="image/svg+xml" href="${favicon}">
          <title>SVG Favicon Test</title>
        </head>
        <body>
          favicons
        </body>
      </html>
`);
  });

  await Promise.all([
    server.waitForRequest(favicon),
    server.waitForRequest(hashedFaviconUrl),
    page.goto(server.PREFIX + '/page.html'),
  ]);

  await page.waitForTimeout(500);
  // Text still being around ensures we haven't actually lost our browser to a crash.
  await page.waitForSelector('text=favicons');

  // favicon and 302 redirects to favicons should be filtered out of request logs
  const log = await getLog();
  expect(log.entries.length).toBe(1);
  const entry = log.entries[0];
  expect(entry.request.url).toBe(server.PREFIX + '/page.html');
});

it('should have different hars for concurrent contexts', async ({ contextFactory }, testInfo) => {
  const session0 = await pageWithHar(contextFactory, testInfo, { outputPath: 'test-0.har' });
  await session0.page.goto('data:text/html,<title>Zero</title>');
  await session0.page.waitForLoadState('domcontentloaded');

  const session1 = await pageWithHar(contextFactory, testInfo, { outputPath: 'test-1.har' });
  await session1.page.goto('data:text/html,<title>One</title>');
  await session1.page.waitForLoadState('domcontentloaded');

  // Trigger flushing on the server and ensure they are not racing to same
  // location. NB: Run this test with --repeat-each 10.
  const [log0, log1] = await Promise.all([
    session0.getLog(),
    session1.getLog()
  ]);

  {
    expect(log0.pages!.length).toBe(1);
    const pageEntry = log0.pages![0];
    expect(pageEntry.title).toBe('Zero');
  }

  {
    expect(log1.pages!.length).toBe(1);
    const pageEntry = log1.pages![0];
    expect(pageEntry.id).not.toBe(log0.pages![0].id);
    expect(pageEntry.title).toBe('One');
  }
});

it('should include API request', async ({ contextFactory, server }, testInfo) => {
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  const url = server.PREFIX + '/simple.json';
  const response = await page.request.post(url, {
    headers: { cookie: 'a=b; c=d' },
    data: { foo: 'bar' }
  });
  const responseBody = await response.body();
  const log = await getLog();
  expect(log.entries.length).toBe(1);
  const entry = log.entries[0];
  expect(entry.request.url).toBe(url);
  expect(entry.request.method).toBe('POST');
  expect(entry.request.httpVersion).toBe('HTTP/1.1');
  expect(entry.request.cookies).toEqual([
    {
      'name': 'a',
      'value': 'b'
    },
    {
      'name': 'c',
      'value': 'd'
    }
  ]);
  expect(entry.request.headers.length).toBeGreaterThan(1);
  expect(entry.request.headers.find(h => h.name.toLowerCase() === 'user-agent')).toBeTruthy();
  expect(entry.request.headers.find(h => h.name.toLowerCase() === 'content-type')?.value).toBe('application/json');
  expect(entry.request.headers.find(h => h.name.toLowerCase() === 'content-length')?.value).toBe('13');
  expect(entry.request.bodySize).toBe(13);

  expect(entry.response.status).toBe(200);
  expect(entry.response.headers.find(h => h.name.toLowerCase() === 'content-type')?.value).toContain('application/json');
  expect(entry.response.content.size).toBe(15);
  expect(entry.response.content.text).toBe(responseBody.toString());
});

it('should not hang on resources served from cache', async ({ contextFactory, server, browserName }, testInfo) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/11435' });
  server.setRoute('/one-style.css', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=10031518'
    });
    res.end(`body { background: red }`);
  });
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.PREFIX + '/har.html');
  await page.goto(server.PREFIX + '/har.html');
  const log = await getLog();
  const entries = log.entries.filter(e => e.request.url.endsWith('one-style.css'));
  // In firefox no request events are fired for cached resources.
  if (browserName === 'firefox')
    expect(entries.length).toBe(1);
  else
    expect(entries.length).toBe(2);
});

it('should not hang on slow chunked response', async ({ browserName, browser, contextFactory, server }, testInfo) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21182' });
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html',
    });
    res.end(`<script>
    let receivedFirstData = new Promise(f => {
      setTimeout(() =>  {
        var x = new XMLHttpRequest();
        x.open("GET", "slow.txt");
        x.onprogress = () => f();
        x.send();
      }, 0);
    });
    </script>`);
  });
  server.setRoute('/slow.txt', async (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked',
      'Content-length': '2023'
    });
    res.write('begin');
  });
  const { page, getLog } = await pageWithHar(contextFactory, testInfo);
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => (window as any).receivedFirstData);
  const log = await getLog();
  expect(log.browser!.name.toLowerCase()).toBe(browserName);
  expect(log.browser!.version).toBe(browser.version());
});

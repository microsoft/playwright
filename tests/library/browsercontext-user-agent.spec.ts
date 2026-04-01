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
import { attachFrame } from '../config/utils';
import { chromiumVersionLessThan } from '../config/utils';

it('should work', async ({ browser, server }) => {
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
    await context.close();
  }
  {
    const context = await browser.newContext({ userAgent: 'foobar' });
    const page = await context.newPage();
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect(request.headers['user-agent']).toBe('foobar');
    await context.close();
  }
});

it('should work for subframes', async ({ browser, server }) => {
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    expect(await page.evaluate(() => navigator.userAgent)).toContain('Mozilla');
    await context.close();
  }
  {
    const context = await browser.newContext({ userAgent: 'foobar' });
    const page = await context.newPage();
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      attachFrame(page, 'frame1', server.EMPTY_PAGE),
    ]);
    expect(request.headers['user-agent']).toBe('foobar');
    await context.close();
  }
});

it('should emulate device user-agent', async ({ browser, server, playwright }) => {
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => navigator.userAgent)).not.toContain('iPhone');
    await context.close();
  }
  {
    const context = await browser.newContext({ userAgent: playwright.devices['iPhone 6'].userAgent });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => navigator.userAgent)).toContain('iPhone');
    await context.close();
  }
});

it('should make a copy of default options', async ({ browser, server }) => {
  const options = { userAgent: 'foobar' };
  const context = await browser.newContext(options);
  options.userAgent = 'wrong';
  const page = await context.newPage();
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect(request.headers['user-agent']).toBe('foobar');
  await context.close();
});

it('custom user agent for download', async ({ server, contextFactory, browserVersion, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22843' });
  it.skip(browserName === 'chromium' && chromiumVersionLessThan(browserVersion, '116.0.0.0'), 'https://chromium-review.googlesource.com/c/chromium/src/+/4554578');

  server.setRoute('/download', (req, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment');
    res.end(`Hello world`);
  });

  const context = await contextFactory({ userAgent: 'MyCustomUA' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a id="download" download="name" href="/download">Download</a>`);
  const serverRequest = server.waitForRequest('/download');
  page.click('#download').catch(e => {});
  const req = await serverRequest;
  expect(req.headers['user-agent']).toBe('MyCustomUA');
});

it('should work for navigator.userAgentData and sec-ch-ua headers', async ({ playwright, browserName, browser, server }) => {
  it.skip(browserName !== 'chromium', 'This API is Chromium-only');

  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect.soft(request.headers['sec-ch-ua']).toContain(`"Chromium"`);
    expect.soft(request.headers['sec-ch-ua-mobile']).toBe(`?0`);
    expect.soft(request.headers['sec-ch-ua-platform']).toBeTruthy();
    expect.soft(await page.evaluate(() => (window.navigator as any).userAgentData.toJSON())).toEqual(
        expect.objectContaining({ mobile: false })
    );
    await context.close();
  }

  {
    const context = await browser.newContext(playwright.devices['Pixel 7']);
    const page = await context.newPage();
    const [request] = await Promise.all([
      server.waitForRequest('/empty.html'),
      page.goto(server.EMPTY_PAGE),
    ]);
    expect.soft(request.headers['sec-ch-ua']).toContain(`"Chromium"`);
    expect.soft(request.headers['sec-ch-ua-mobile']).toBe(`?1`);
    expect.soft(request.headers['sec-ch-ua-platform']).toBe(`"Android"`);
    expect.soft(await page.evaluate(() => (window.navigator as any).userAgentData.toJSON())).toEqual(
        expect.objectContaining({ mobile: true, platform: 'Android' })
    );
    await context.close();
  }
});

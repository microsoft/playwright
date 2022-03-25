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

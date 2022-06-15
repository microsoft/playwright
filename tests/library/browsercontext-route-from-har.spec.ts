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

it('routeFromHar should fulfill from har, matching the method and following redirects', async ({ context, page, isAndroid, asset }) => {
  it.fixme(isAndroid);

  const harPath = asset('har-fulfill.har');
  await context.routeFromHar(harPath);
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  // HAR contains a POST for the css file that should not be used.
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 0, 0)');
});

it('routeFromHar strict:false should fallback when not found in har', async ({ context, page, server, isAndroid, asset }) => {
  it.fixme(isAndroid);

  const harPath = asset('har-fulfill.har');
  let requestCount = 0;
  await context.route('**/*', route => {
    ++requestCount;
    route.continue();
  });
  await context.routeFromHar(harPath, { strict: false });
  await page.goto(server.PREFIX + '/one-style.html');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 192, 203)');
  expect(requestCount).toBe(2);
});

it('routeFromHar by default should abort requests not found in har', async ({ context, page, server, isAndroid, asset }) => {
  it.fixme(isAndroid);

  const harPath = asset('har-fulfill.har');
  let requestCount = 0;
  await context.route('**/*', route => {
    ++requestCount;
    route.continue();
  });
  await context.routeFromHar(harPath);
  const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
  expect(error instanceof Error).toBe(true);
  expect(requestCount).toBe(0);
});

it('routeFromHar strict:false should continue requests on bad har', async ({ context, page, server, isAndroid }, testInfo) => {
  it.fixme(isAndroid);

  const harPath = testInfo.outputPath('test.har');
  fs.writeFileSync(harPath, JSON.stringify({ log: {} }), 'utf-8');
  let requestCount = 0;
  await context.route('**/*', route => {
    ++requestCount;
    route.continue();
  });
  await context.routeFromHar(harPath, { strict: false });
  await page.goto(server.PREFIX + '/one-style.html');
  expect(requestCount).toBe(2);
});

it('routeFromHar should only handle requests matching url filter', async ({ context, page, isAndroid, asset }) => {
  it.fixme(isAndroid);

  const harPath = asset('har-fulfill.har');
  let fulfillCount = 0;
  let passthroughCount = 0;
  await context.route('**/*', async route => {
    ++fulfillCount;
    expect(route.request().url()).toBe('http://no.playwright/');
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<script src="./script.js"></script><div>hello</div>',
    });
  });
  await context.routeFromHar(harPath, { url: '**/*.js' });
  await context.route('**/*', route => {
    ++passthroughCount;
    route.fallback();
  });
  await page.goto('http://no.playwright/');
  // HAR contains a redirect for the script that should be followed automatically.
  expect(await page.evaluate('window.value')).toBe('foo');
  expect(fulfillCount).toBe(1);
  expect(passthroughCount).toBe(2);
});

it('routeFromHar should support mutliple calls with same path', async ({ context, page, isAndroid, asset }) => {
  it.fixme(isAndroid);

  const harPath = asset('har-fulfill.har');
  let abortCount = 0;
  await context.route('**/*', async route => {
    ++abortCount;
    await route.abort();
  });
  await context.routeFromHar(harPath, { url: '**/*.js' });
  await context.routeFromHar(harPath, { url: '**/*.css' });
  await context.routeFromHar(harPath, { url: /.*no.playwright\/$/ });
  await page.goto('http://no.playwright/');
  expect(await page.evaluate('window.value')).toBe('foo');
  expect(abortCount).toBe(0);
});

it('unrouteFromHar should remove har handler added with routeFromHar', async ({ context, page, server, isAndroid, asset }) => {
  it.fixme(isAndroid);

  const harPath = asset('har-fulfill.har');
  let requestCount = 0;
  await context.route('**/*', route => {
    ++requestCount;
    route.continue();
  });
  await context.routeFromHar(harPath, { strict: true });
  await context.unrouteFromHar(harPath);
  await page.goto(server.EMPTY_PAGE);
  expect(requestCount).toBe(1);
});

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

it('should bypass CSP meta tag @smoke', async ({ browser, server }) => {
  // Make sure CSP prohibits addScriptTag.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/csp.html');
    await page.addScriptTag({ content: 'window["__injected"] = 42;' }).catch(e => void e);
    expect(await page.evaluate('window["__injected"]')).toBe(undefined);
    await context.close();
  }

  // By-pass CSP and try one more time.
  {
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/csp.html');
    await page.addScriptTag({ content: 'window["__injected"] = 42;' });
    expect(await page.evaluate('window["__injected"]')).toBe(42);
    await context.close();
  }
});

it('should bypass CSP header', async ({ browser, server }) => {
  // Make sure CSP prohibits addScriptTag.
  server.setCSP('/empty.html', 'default-src "self"');

  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({ content: 'window["__injected"] = 42;' }).catch(e => void e);
    expect(await page.evaluate('window["__injected"]')).toBe(undefined);
    await context.close();
  }

  // By-pass CSP and try one more time.
  {
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.addScriptTag({ content: 'window["__injected"] = 42;' });
    expect(await page.evaluate('window["__injected"]')).toBe(42);
    await context.close();
  }
});

it('should bypass after cross-process navigation', async ({ browser, server }) => {
  const context = await browser.newContext({ bypassCSP: true });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/csp.html');
  await page.addScriptTag({ content: 'window["__injected"] = 42;' });
  expect(await page.evaluate('window["__injected"]')).toBe(42);

  await page.goto(server.CROSS_PROCESS_PREFIX + '/csp.html');
  await page.addScriptTag({ content: 'window["__injected"] = 42;' });
  expect(await page.evaluate('window["__injected"]')).toBe(42);
  await context.close();
});

it('should bypass CSP in iframes as well', async ({ browser, server }) => {
  // Make sure CSP prohibits addScriptTag in an iframe.
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const frame = await attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
    await frame.addScriptTag({ content: 'window["__injected"] = 42;' }).catch(e => void e);
    expect(await frame.evaluate('window["__injected"]')).toBe(undefined);
    await context.close();
  }

  // By-pass CSP and try one more time.
  {
    const context = await browser.newContext({ bypassCSP: true });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const frame = await attachFrame(page, 'frame1', server.PREFIX + '/csp.html');
    await frame.addScriptTag({ content: 'window["__injected"] = 42;' }).catch(e => void e);
    expect(await frame.evaluate('window["__injected"]')).toBe(42);
    await context.close();
  }
});

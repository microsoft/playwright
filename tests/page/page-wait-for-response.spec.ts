/**
 * Copyright 2017 Google Inc. All rights reserved.
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

import { test as it, expect } from './pageTest';

it('should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse(server.PREFIX + '/digits/2.png'),
    page.evaluate(() => {
      void fetch('/digits/1.png');
      void fetch('/digits/2.png');
      void fetch('/digits/3.png');
    })
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should respect timeout', async ({ page, playwright }) => {
  let error = null;
  await page.waitForEvent('response', { predicate: () => false, timeout: 1 }).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should respect default timeout', async ({ page, playwright }) => {
  let error = null;
  page.setDefaultTimeout(1);
  await page.waitForResponse(() => false).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  // Error stack should point to the api call.
  const firstFrame = error.stack.split('\n').find(line => line.startsWith('    at '));
  expect(firstFrame).toContain(__filename);
});

it('should log the url', async ({ page }) => {
  const error1 = await page.waitForResponse('foo.css', { timeout: 1000 }).catch(e => e);
  expect(error1.message).toContain('waiting for response "foo.css"');
  const error2 = await page.waitForResponse(/foo.css/i, { timeout: 1000 }).catch(e => e);
  expect(error2.message).toContain('waiting for response /foo.css/i');
});

it('should work with predicate', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForEvent('response', response => response.url() === server.PREFIX + '/digits/2.png'),
    page.evaluate(() => {
      void fetch('/digits/1.png');
      void fetch('/digits/2.png');
      void fetch('/digits/3.png');
    })
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should work with async predicate', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [response1, response2] = await Promise.all([
    page.waitForEvent('response', async response => {
      const text = await response.text();
      return text.includes('contents of the file');
    }),
    page.waitForResponse(async response => {
      const text = await response.text();
      return text.includes('bar');
    }),
    page.evaluate(() => {
      void fetch('/simple.json').then(r => r.json());
      void fetch('/file-to-upload.txt').then(r => r.text());
    })
  ]);
  expect(response1.url()).toBe(server.PREFIX + '/file-to-upload.txt');
  expect(response2.url()).toBe(server.PREFIX + '/simple.json');
});

it('sync predicate should be only called once', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let counter = 0;
  const [response] = await Promise.all([
    page.waitForEvent('response', response => {
      ++counter;
      return response.url() === server.PREFIX + '/digits/1.png';
    }),
    page.evaluate(async () => {
      await fetch('/digits/1.png');
      await fetch('/digits/2.png');
      await fetch('/digits/3.png');
    })
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/1.png');
  expect(counter).toBe(1);
});

it('should work with no timeout', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse(server.PREFIX + '/digits/2.png', { timeout: 0 }),
    page.evaluate(() => window.builtins.setTimeout(() => {
      void fetch('/digits/1.png');
      void fetch('/digits/2.png');
      void fetch('/digits/3.png');
    }, 50))
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should work with re-rendered cached IMG elements', async ({ page, server, browserName }) => {
  it.fixme(browserName === 'webkit');
  it.fixme(browserName === 'firefox');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<img src="pptr.png">`);
  await page.$eval('img', img => img.remove());
  const [response] = await Promise.all([
    page.waitForRequest(/pptr/),
    page.waitForResponse(/pptr/),
    page.setContent(`<img src="pptr.png">`)
  ]);
  expect(response.url()).toBe(server.PREFIX + '/pptr.png');
});

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
import vm from 'vm';

it('should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest(server.PREFIX + '/digits/2.png'),
    page.evaluate(() => {
      void fetch('/digits/1.png');
      void fetch('/digits/2.png');
      void fetch('/digits/3.png');
    })
  ]);
  expect(request.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should work with predicate', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForEvent('request', request => request.url() === server.PREFIX + '/digits/2.png'),
    page.evaluate(() => {
      void fetch('/digits/1.png');
      void fetch('/digits/2.png');
      void fetch('/digits/3.png');
    })
  ]);
  expect(request.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should respect timeout', async ({ page, playwright }) => {
  let error = null;
  await page.waitForEvent('request', { predicate: () => false, timeout: 1 }).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  expect(error.message).toContain('Timeout 1ms exceeded while waiting for event "request"');
  // Error stack should point to the api call.
  const firstFrame = error.stack.split('\n').find(line => line.startsWith('    at '));
  expect(firstFrame).toContain(__filename);
});

it('should respect default timeout', async ({ page, playwright }) => {
  let error = null;
  page.setDefaultTimeout(1);
  await page.waitForEvent('request', () => false).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should log the url', async ({ page }) => {
  const error = await page.waitForRequest('long-long-long-long-long-long-long-long-long-long-long-long-long-long.css', { timeout: 1000 }).catch(e => e);
  expect(error.message).toContain('waiting for request "long-long-long-long-long-long-long-long-long-long…"');
});

it('should work with no timeout', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest(server.PREFIX + '/digits/2.png', { timeout: 0 }),
    page.evaluate(() => window.builtinSetTimeout(() => {
      void fetch('/digits/1.png');
      void fetch('/digits/2.png');
      void fetch('/digits/3.png');
    }, 50))
  ]);
  expect(request.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should work with url match', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest(/digits\/\d\.png/),
    page.evaluate(() => {
      void fetch('/digits/1.png');
    })
  ]);
  expect(request.url()).toBe(server.PREFIX + '/digits/1.png');
});

it('should work with url match regular expression from a different context', async ({ page, server }) => {
  const ctx = vm.createContext();
  const regexp = vm.runInContext('new RegExp(/digits\\/\\d\\.png/)', ctx);

  await page.goto(server.EMPTY_PAGE);
  const [request] = await Promise.all([
    page.waitForRequest(regexp),
    page.evaluate(() => {
      void fetch('/digits/1.png');
    })
  ]);
  expect(request.url()).toBe(server.PREFIX + '/digits/1.png');
});

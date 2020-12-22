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

import { it, expect } from './fixtures';

it('should work', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse(server.PREFIX + '/digits/2.png'),
    page.evaluate(() => {
      fetch('/digits/1.png');
      fetch('/digits/2.png');
      fetch('/digits/3.png');
    })
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should respect timeout', async ({page, playwright}) => {
  const timeout = 1;
  const timeoutMessage = 'Oh-oh, something is wrong';
  const event = 'response';

  const error = await page.waitForEvent(event, {predicate: () => false, timeout, timeoutMessage}).catch(e => e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  expect(error.message).toContain(`Timeout after ${timeout}ms while waiting for event "${event}". ${timeoutMessage}`);
});

it('should respect default timeout', async ({page, playwright}) => {
  const timeout = 1;
  const event = 'response';

  page.setDefaultTimeout(1);
  const error = await page.waitForEvent(event, () => false).catch(e => e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
  expect(error.message).toContain(`Timeout after ${timeout}ms while waiting for event "${event}".`);
});

it('should work with predicate', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForEvent('request', response => response.url() === server.PREFIX + '/digits/2.png'),
    page.evaluate(() => {
      fetch('/digits/1.png');
      fetch('/digits/2.png');
      fetch('/digits/3.png');
    })
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
});

it('should work with no timeout', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForResponse(server.PREFIX + '/digits/2.png', {timeout: 0}),
    page.evaluate(() => setTimeout(() => {
      fetch('/digits/1.png');
      fetch('/digits/2.png');
      fetch('/digits/3.png');
    }, 50))
  ]);
  expect(response.url()).toBe(server.PREFIX + '/digits/2.png');
});

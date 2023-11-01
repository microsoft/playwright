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

it('should work @smoke', async ({ browser, browserName }) => {
  const func = () => new Date(1479579154987).toString();
  {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Jamaica' });
    const page = await context.newPage();
    expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 13:12:34 GMT-0500 (Eastern Standard Time)');
    await context.close();
  }
  {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'Pacific/Honolulu' });
    const page = await context.newPage();
    expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 08:12:34 GMT-1000 (Hawaii-Aleutian Standard Time)');
    await context.close();
  }
  {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Buenos_Aires' });
    const page = await context.newPage();
    expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 15:12:34 GMT-0300 (Argentina Standard Time)');
    await context.close();
  }
  {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'Europe/Berlin' });
    const page = await context.newPage();
    expect(await page.evaluate(func)).toBe('Sat Nov 19 2016 19:12:34 GMT+0100 (Central European Standard Time)');
    await context.close();
  }
});

it('should throw for invalid timezone IDs when creating pages', async ({ browser }) => {
  for (const timezoneId of ['Foo/Bar', 'Baz/Qux']) {
    let error = null;
    const context = await browser.newContext({ timezoneId });
    await context.newPage().catch(e => error = e);
    expect(error.message).toContain(`Invalid timezone ID: ${timezoneId}`);
    await context.close();
  }
});

it('should work for multiple pages sharing same process', async ({ browser, server }) => {
  const context = await browser.newContext({ timezoneId: 'Europe/Moscow' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  let [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
  ]);
  [popup] = await Promise.all([
    popup.waitForEvent('popup'),
    popup.evaluate(url => { window.open(url); }, server.EMPTY_PAGE),
  ]);
  await context.close();
});

it('should not change default timezone in another context', async ({ browser, server }) => {
  async function getContextTimezone(context) {
    const page = await context.newPage();
    return await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  }

  let defaultTimezone;
  {
    const context = await browser.newContext();
    defaultTimezone = await getContextTimezone(context);
    await context.close();
  }
  const timezoneOverride = defaultTimezone === 'Europe/Moscow' ? 'America/Los_Angeles' : 'Europe/Moscow';
  {
    const context = await browser.newContext({ timezoneId: timezoneOverride });
    expect(await getContextTimezone(context)).toBe(timezoneOverride);
    await context.close();
  }
  {
    const context = await browser.newContext();
    expect(await getContextTimezone(context)).toBe(defaultTimezone);
    await context.close();
  }
});

it('should affect Intl.DateTimeFormat().resolvedOptions().timeZone', async ({ browser, server }) => {
  const context = await browser.newContext({ timezoneId: 'America/Jamaica' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => (new Intl.DateTimeFormat()).resolvedOptions().timeZone)).toBe('America/Jamaica');
  await context.close();
});

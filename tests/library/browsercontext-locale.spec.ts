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

it('should affect accept-language header @smoke', async ({ browser, server }) => {
  const context = await browser.newContext({ locale: 'fr-CH' });
  const page = await context.newPage();
  const [request] = await Promise.all([
    server.waitForRequest('/empty.html'),
    page.goto(server.EMPTY_PAGE),
  ]);
  expect((request.headers['accept-language'] as string).substr(0, 5)).toBe('fr-CH');
  await context.close();
});

it('should affect navigator.language', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  expect(await page.evaluate(() => navigator.language)).toBe('fr-FR');
  await context.close();
});

it('should format number', async ({ browser, server }) => {
  {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(await page.evaluate(() => (1000000.50).toLocaleString())).toBe('1,000,000.5');
    await context.close();
  }
  {
    const context = await browser.newContext({ locale: 'fr-CH' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(await page.evaluate(() => (1000000.50).toLocaleString().replace(/\s/g, ' '))).toBe('1 000 000,5');
    await context.close();
  }
});

it('should format date', async ({ browser, server, browserName }) => {
  {
    const context = await browser.newContext({ locale: 'en-US', timezoneId: 'America/Los_Angeles' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const formatted = 'Sat Nov 19 2016 10:12:34 GMT-0800 (Pacific Standard Time)';
    expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe(formatted);
    await context.close();
  }
  {
    const context = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const formatted = 'Sat Nov 19 2016 19:12:34 GMT+0100 (Mitteleuropäische Normalzeit)';
    expect(await page.evaluate(() => new Date(1479579154987).toString())).toBe(formatted);
    await context.close();
  }
});

it('should format number in popups', async ({ browser, server }) => {
  const context = await browser.newContext({ locale: 'fr-CH' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.PREFIX + '/formatted-number.html'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  const result = await popup.evaluate('window["result"]');
  expect(result).toBe('1 000 000,5');
  await context.close();
});

it('should affect navigator.language in popups', async ({ browser, server }) => {
  const context = await browser.newContext({ locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.PREFIX + '/formatted-number.html'),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  const result = await popup.evaluate('window.initialNavigatorLanguage');
  expect(result).toBe('fr-FR');
  await context.close();
});

it('should work for multiple pages sharing same process', async ({ browser, server }) => {
  const context = await browser.newContext({ locale: 'ru-RU' });
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

it('should be isolated between contexts', async ({ browser, server }) => {
  const context1 = await browser.newContext({ locale: 'en-US' });
  const promises = [];
  // By default firefox limits number of child web processes to 8.
  for (let i = 0; i < 8; i++)
    promises.push(context1.newPage());
  await Promise.all(promises);

  const context2 = await browser.newContext({ locale: 'ru-RU' });
  const page2 = await context2.newPage();

  const localeNumber = () => (1000000.50).toLocaleString();
  const numbers = await Promise.all(context1.pages().map(page => page.evaluate(localeNumber)));

  numbers.forEach(value => expect(value).toBe('1,000,000.5'));
  expect(await page2.evaluate(localeNumber)).toBe('1 000 000,5');

  await Promise.all([
    context1.close(),
    context2.close()
  ]);
});

it('should not change default locale in another context', async ({ browser }) => {
  async function getContextLocale(context) {
    const page = await context.newPage();
    return await page.evaluate(() => (new Intl.NumberFormat()).resolvedOptions().locale);
  }

  let defaultLocale;
  {
    const context = await browser.newContext();
    defaultLocale = await getContextLocale(context);
    await context.close();
  }
  const localeOverride = defaultLocale === 'es-MX' ? 'de-DE' : 'es-MX';
  {
    const context = await browser.newContext({ locale: localeOverride });
    expect(await getContextLocale(context)).toBe(localeOverride);
    await context.close();
  }
  {
    const context = await browser.newContext();
    expect(await getContextLocale(context)).toBe(defaultLocale);
    await context.close();
  }
});

it('should format number in workers', async ({ browser, server }) => {
  const context = await browser.newContext({ locale: 'es-MX' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  const [worker] = await Promise.all([
    page.waitForEvent('worker'),
    page.evaluate(() => new Worker(URL.createObjectURL(new Blob(['console.log(1)'], { type: 'application/javascript' })))),
  ]);
  expect(await worker.evaluate(() => (10000.20).toLocaleString())).toBe('10,000.2');
  await context.close();
});

it('should affect Intl.DateTimeFormat().resolvedOptions().locale', async ({ browser, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27802' });
  const context = await browser.newContext({ locale: 'en-GB' });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  expect(await page.evaluate(() => (new Intl.DateTimeFormat()).resolvedOptions().locale)).toBe('en-GB');
  await context.close();
});

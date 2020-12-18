/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { it, expect } from './fixtures';
import path from 'path';

it('should work with browser context scripts', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => window['temp'] = 123);
  const page = await context.newPage();
  await page.addInitScript(() => window['injected'] = window['temp']);
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
  await context.close();
});

it('should work with browser context scripts with a path', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.addInitScript({ path: path.join(__dirname, 'assets/injectedfile.js') });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
  await context.close();
});

it('should work with browser context scripts for already created pages', async ({ browser, server }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await context.addInitScript(() => window['temp'] = 123);
  await page.addInitScript(() => window['injected'] = window['temp']);
  await page.goto(server.PREFIX + '/tamperable.html');
  expect(await page.evaluate(() => window['result'])).toBe(123);
  await context.close();
});
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
import {contextTest as it, expect} from './config/browserTest';

it.skip(({isMac, browserName}) => isMac || browserName === 'webkit', 'WebKit and Mac use overlay scrollbars.');

it('should allow specifying scrollbars: true', async ({contextFactory}) => {
  const page = await (await contextFactory({scrollbars: true})).newPage();
  await page.setContent('<div style="overflow-y:scroll; height: 50px; width: 50px"></div>');
  const {scrollWidth, scrollHeight} = await page.$eval('div', div => ({scrollWidth: div.scrollWidth, scrollHeight: div.scrollHeight}));
  expect(scrollWidth).toBeLessThan(45);
  expect(scrollHeight).toBe(50);
});

it('should allow specifying scrollbars: false', async ({contextFactory}) => {
  const page = await (await contextFactory({scrollbars: false})).newPage();
  await page.setContent('<div style="overflow-y:scroll; height: 50px; width: 50px"></div>');
  const {scrollWidth, scrollHeight} = await page.$eval('div', div => ({scrollWidth: div.scrollWidth, scrollHeight: div.scrollHeight}));
  expect(scrollWidth).toBe(50);
  expect(scrollHeight).toBe(50);
});

it('should allow specifying scrollbars: undefined', async ({contextFactory, browserOptions}) => {
  const page = await (await contextFactory()).newPage();
  await page.setContent('<div style="overflow-y:scroll; height: 50px; width: 50px"></div>');
  const {scrollWidth, scrollHeight} = await page.$eval('div', div => ({scrollWidth: div.scrollWidth, scrollHeight: div.scrollHeight}));
  if (browserOptions.headless)
    expect(scrollWidth).toBe(50);
  else
    expect(scrollWidth).toBeLessThan(45);
  expect(scrollHeight).toBe(50);
});

it('should still work after refreshing the page', async ({contextFactory, server}) => {
  const page = await (await contextFactory({scrollbars: false})).newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.reload();
  await page.evaluate(() => document.body.innerHTML = '<div style="overflow-y:scroll; height: 50px; width: 50px"></div>');
  const {scrollWidth, scrollHeight} = await page.$eval('div', div => ({scrollWidth: div.scrollWidth, scrollHeight: div.scrollHeight}));
  expect(scrollWidth).toBe(50);
  expect(scrollHeight).toBe(50);
});

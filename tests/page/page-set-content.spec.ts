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

const expectedOutput = '<html><head></head><body><div>hello</div></body></html>';

it('should work @smoke', async ({ page, server }) => {
  await page.setContent('<div>hello</div>');
  const result = await page.content();
  expect(result).toBe(expectedOutput);
});

it('should work with domcontentloaded', async ({ page, server }) => {
  await page.setContent('<div>hello</div>', { waitUntil: 'domcontentloaded' });
  const result = await page.content();
  expect(result).toBe(expectedOutput);
});

it('should work with commit', async ({ page }) => {
  await page.setContent('<div>hello</div>', { waitUntil: 'commit' });
  const result = await page.content();
  expect(result).toBe(expectedOutput);
});

it('should work with doctype', async ({ page, server }) => {
  const doctype = '<!DOCTYPE html>';
  await page.setContent(`${doctype}<div>hello</div>`);
  const result = await page.content();
  expect(result).toBe(`${doctype}${expectedOutput}`);
});

it('should work with HTML 4 doctype', async ({ page, server }) => {
  const doctype = '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01//EN" ' +
    '"http://www.w3.org/TR/html4/strict.dtd">';
  await page.setContent(`${doctype}<div>hello</div>`);
  const result = await page.content();
  expect(result).toBe(`${doctype}${expectedOutput}`);
});

it('should respect timeout', async ({ page, server, playwright }) => {
  const imgPath = '/img.png';
  // stall for image
  server.setRoute(imgPath, (req, res) => {});
  let error = null;
  await page.setContent(`<img src="${server.PREFIX + imgPath}"></img>`, { timeout: 1 }).catch(e => error = e);
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should respect default navigation timeout', async ({ page, server, playwright }) => {
  page.setDefaultNavigationTimeout(1);
  const imgPath = '/img.png';
  // stall for image
  server.setRoute(imgPath, (req, res) => {});
  const error = await page.setContent(`<img src="${server.PREFIX + imgPath}"></img>`).catch(e => e);
  expect(error.message).toContain('page.setContent: Timeout 1ms exceeded.');
  expect(error).toBeInstanceOf(playwright.errors.TimeoutError);
});

it('should await resources to load', async ({ page, server }) => {
  const imgPath = '/img.png';
  let imgResponse = null;
  server.setRoute(imgPath, (req, res) => imgResponse = res);
  let loaded = false;
  const contentPromise = page.setContent(`<img src="${server.PREFIX + imgPath}"></img>`).then(() => loaded = true);
  await server.waitForRequest(imgPath);
  expect(loaded).toBe(false);
  imgResponse.end();
  await contentPromise;
});

it('should work fast enough', async ({ page, server }) => {
  for (let i = 0; i < 20; ++i)
    await page.setContent('<div>yo</div>');
});

it('should work with tricky content', async ({ page, server }) => {
  await page.setContent('<div>hello world</div>' + '\x7F');
  expect(await page.$eval('div', div => div.textContent)).toBe('hello world');
});

it('should work with accents', async ({ page, server }) => {
  await page.setContent('<div>aberración</div>');
  expect(await page.$eval('div', div => div.textContent)).toBe('aberración');
});

it('should work with emojis', async ({ page, server }) => {
  await page.setContent('<div>🐥</div>');
  expect(await page.$eval('div', div => div.textContent)).toBe('🐥');
});

it('should work with newline', async ({ page, server }) => {
  await page.setContent('<div>\n</div>');
  expect(await page.$eval('div', div => div.textContent)).toBe('\n');
});

it('content() should throw nice error during navigation', async ({ page, server }) => {
  for (let timeout = 0; timeout < 200; timeout += 20) {
    await page.setContent('<div>hello</div>');
    const promise = page.goto(server.EMPTY_PAGE);
    await page.waitForTimeout(timeout);
    const [contentOrError] = await Promise.all([
      page.content().catch(e => e),
      promise,
    ]);
    const emptyOutput = '<html><head></head><body></body></html>';
    if (contentOrError !== expectedOutput && contentOrError !== emptyOutput)
      expect(contentOrError?.message).toContain('Unable to retrieve content because the page is navigating and changing the content.');
  }
});

it('should return empty content there is no iframe src', async ({ page }) => {
  it.fixme(true, 'Hangs in all browsers because there is no utility context');
  await page.setContent(`<iframe src="javascript:console.log(1)"></iframe>`);
  expect(page.frames().length).toBe(2);
  expect(await page.frames()[1].content()).toBe('<html><head></head><body></body></html>');
});

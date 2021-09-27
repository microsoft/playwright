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
import path from 'path';

it('should throw an error if no options are provided', async ({ page, server }) => {
  let error = null;
  try {
    // @ts-ignore
    await page.addScriptTag('/injectedfile.js');
  } catch (e) {
    error = e;
  }
  expect(error.message).toContain('Provide an object with a `url`, `path` or `content` property');
});

it('should work with a url', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const scriptHandle = await page.addScriptTag({ url: '/injectedfile.js' });
  expect(scriptHandle.asElement()).not.toBeNull();
  expect(await page.evaluate(() => window['__injected'])).toBe(42);
});

it('should work with a url and type=module', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.addScriptTag({ url: '/es6/es6import.js', type: 'module' });
  expect(await page.evaluate(() => window['__es6injected'])).toBe(42);
});

it('should work with a path and type=module', async ({ page, server, asset }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.addScriptTag({ path: asset('es6/es6pathimport.js'), type: 'module' });
  await page.waitForFunction('window.__es6injected');
  expect(await page.evaluate(() => window['__es6injected'])).toBe(42);
});

it('should work with a content and type=module', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.addScriptTag({ content: `import num from '/es6/es6module.js';window.__es6injected = num;`, type: 'module' });
  await page.waitForFunction('window.__es6injected');
  expect(await page.evaluate(() => window['__es6injected'])).toBe(42);
});

it('should throw an error if loading from url fail', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let error = null;
  try {
    await page.addScriptTag({ url: '/nonexistfile.js' });
  } catch (e) {
    error = e;
  }
  expect(error).not.toBe(null);
});

it('should work with a path', async ({ page, server, asset }) => {
  await page.goto(server.EMPTY_PAGE);
  const scriptHandle = await page.addScriptTag({ path: asset('injectedfile.js') });
  expect(scriptHandle.asElement()).not.toBeNull();
  expect(await page.evaluate(() => window['__injected'])).toBe(42);
});

it('should include sourceURL when path is provided', async ({ page, server, browserName, asset }) => {
  it.skip(browserName === 'webkit');

  await page.goto(server.EMPTY_PAGE);
  await page.addScriptTag({ path: asset('injectedfile.js') });
  const result = await page.evaluate(() => window['__injectedError'].stack);
  expect(result).toContain(path.join('assets', 'injectedfile.js'));
});

it('should work with content', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const scriptHandle = await page.addScriptTag({ content: 'window["__injected"] = 35;' });
  expect(scriptHandle.asElement()).not.toBeNull();
  expect(await page.evaluate(() => window['__injected'])).toBe(35);
});

it('should throw when added with content to the CSP page', async ({ page, server }) => {
  // Firefox fires onload for blocked script before it issues the CSP console error.
  await page.goto(server.PREFIX + '/csp.html');
  let error = null;
  await page.addScriptTag({ content: 'window["__injected"] = 35;' }).catch(e => error = e);
  expect(error).toBeTruthy();
});

it('should throw when added with URL to the CSP page', async ({ page, server, isAndroid }) => {
  it.skip(isAndroid, 'No cross-process on Android');

  await page.goto(server.PREFIX + '/csp.html');
  let error = null;
  await page.addScriptTag({ url: server.CROSS_PROCESS_PREFIX + '/injectedfile.js' }).catch(e => error = e);
  expect(error).toBeTruthy();
});

it('should throw a nice error when the request fails', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const url = server.PREFIX + '/this_does_not_exist.js';
  const error = await page.addScriptTag({ url }).catch(e => e);
  expect(error.message).toContain(url);
});

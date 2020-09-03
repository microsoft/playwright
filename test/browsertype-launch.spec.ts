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

import path from 'path';
import { it, options } from './playwright.fixtures';

it('should reject all promises when browser is closed', async ({browserType, defaultBrowserOptions}) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  const page = await (await browser.newContext()).newPage();
  let error = null;
  const neverResolves = page.evaluate(() => new Promise(r => {})).catch(e => error = e);
  await page.evaluate(() => new Promise(f => setTimeout(f, 0)));
  await browser.close();
  await neverResolves;
  expect(error.message).toContain('Protocol error');
});

it('should throw if userDataDir option is passed', async ({browserType, defaultBrowserOptions}) => {
  let waitError = null;
  const options = Object.assign({}, defaultBrowserOptions, {userDataDir: 'random-path'});
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('launchPersistentContext');
});

it('should throw if page argument is passed', test => {
  test.skip(options.FIREFOX);
}, async ({browserType, defaultBrowserOptions}) => {
  let waitError = null;
  const options = Object.assign({}, defaultBrowserOptions, { args: ['http://example.com'] });
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('can not specify page');
});

it('should reject if launched browser fails immediately', test => {
  test.fixme(`I'm getting ENCONRESET on this one.`);
}, async ({browserType, defaultBrowserOptions}) => {
  const options = Object.assign({}, defaultBrowserOptions, {executablePath: path.join(__dirname, 'assets', 'dummy_bad_browser_executable.js')});
  let waitError = null;
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('== logs ==');
});

it('should reject if executable path is invalid', async ({browserType, defaultBrowserOptions}) => {
  let waitError = null;
  const options = Object.assign({}, defaultBrowserOptions, {executablePath: 'random-invalid-path'});
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('Failed to launch');
});

it('should handle timeout', test => {
  test.skip(options.WIRE);
}, async ({browserType, defaultBrowserOptions}) => {
  const options = { ...defaultBrowserOptions, timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain(`browserType.launch: Timeout 5000ms exceeded.`);
  expect(error.message).toContain(`<launching>`);
  expect(error.message).toContain(`<launched> pid=`);
});

it('should handle exception', test => {
  test.skip(options.WIRE);
}, async ({browserType, defaultBrowserOptions}) => {
  const e = new Error('Dummy');
  const options = { ...defaultBrowserOptions, __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain('Dummy');
});

it('should report launch log', test => {
  test.skip(options.WIRE);
}, async ({browserType, defaultBrowserOptions}) => {
  const e = new Error('Dummy');
  const options = { ...defaultBrowserOptions, __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain('<launching>');
});

it('should accept objects as options', test => {
  test.slow();
}, async ({browserType, defaultBrowserOptions}) => {
  const browser = await browserType.launch({ ...defaultBrowserOptions, process } as any);
  await browser.close();
});

it('should fire close event for all contexts', async ({browserType, defaultBrowserOptions}) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  const context = await browser.newContext();
  let closed = false;
  context.on('close', () => closed = true);
  await browser.close();
  expect(closed).toBe(true);
});

it('should be callable twice', async ({browserType, defaultBrowserOptions}) => {
  const browser = await browserType.launch(defaultBrowserOptions);
  await Promise.all([
    browser.close(),
    browser.close(),
  ]);
  await browser.close();
});

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

import { playwrightTest as it, expect } from './config/browserTest';

it('should reject all promises when browser is closed', async ({browserType, browserOptions}) => {
  const browser = await browserType.launch(browserOptions);
  const page = await (await browser.newContext()).newPage();
  let error = null;
  const neverResolves = page.evaluate(() => new Promise(r => {})).catch(e => error = e);
  await page.evaluate(() => new Promise(f => setTimeout(f, 0)));
  await browser.close();
  await neverResolves;
  expect(error.message).toContain('Protocol error');
});

it('should throw if userDataDir option is passed', async ({browserType, browserOptions}) => {
  let waitError = null;
  const options = Object.assign({}, browserOptions, {userDataDir: 'random-path'});
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
});

it('should throw if userDataDir is passed as an argument', async ({browserType, browserOptions}) => {
  let waitError = null;
  const options = Object.assign({}, browserOptions, {args: ['--user-data-dir=random-path', '--profile=random-path']});
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('Pass userDataDir parameter to `browserType.launchPersistentContext');
});

it('should throw if port option is passed', async ({browserType, browserOptions}) => {
  const options = Object.assign({}, browserOptions, {port: 1234});
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain('Cannot specify a port without launching as a server.');
});

it('should throw if port option is passed for persistent context', async ({browserType, browserOptions}) => {
  const options = Object.assign({}, browserOptions, {port: 1234});
  const error = await browserType.launchPersistentContext('foo', options).catch(e => e);
  expect(error.message).toContain('Cannot specify a port without launching as a server.');
});

it('should throw if page argument is passed', async ({browserType, browserOptions, browserName}) => {
  it.skip(browserName === 'firefox');

  let waitError = null;
  const options = Object.assign({}, browserOptions, { args: ['http://example.com'] });
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('can not specify page');
});

it('should reject if launched browser fails immediately', async ({browserType, browserOptions, asset}) => {
  const options = Object.assign({}, browserOptions, {executablePath: asset('dummy_bad_browser_executable.js')});
  let waitError = null;
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('== logs ==');
});

it('should reject if executable path is invalid', async ({browserType, browserOptions}) => {
  let waitError = null;
  const options = Object.assign({}, browserOptions, {executablePath: 'random-invalid-path'});
  await browserType.launch(options).catch(e => waitError = e);
  expect(waitError.message).toContain('Failed to launch');
});

it('should handle timeout', async ({browserType, browserOptions, mode}) => {
  it.skip(mode !== 'default');

  const options = { ...browserOptions, timeout: 5000, __testHookBeforeCreateBrowser: () => new Promise(f => setTimeout(f, 6000)) };
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain(`browserType.launch: Timeout 5000ms exceeded.`);
  expect(error.message).toContain(`<launching>`);
  expect(error.message).toContain(`<launched> pid=`);
});

it('should handle exception', async ({browserType, browserOptions, mode}) => {
  it.skip(mode !== 'default');

  const e = new Error('Dummy');
  const options = { ...browserOptions, __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain('Dummy');
});

it('should report launch log', async ({browserType, browserOptions, mode}) => {
  it.skip(mode !== 'default');

  const e = new Error('Dummy');
  const options = { ...browserOptions, __testHookBeforeCreateBrowser: () => { throw e; }, timeout: 9000 };
  const error = await browserType.launch(options).catch(e => e);
  expect(error.message).toContain('<launching>');
});

it('should accept objects as options', async ({browserType, browserOptions}) => {
  // @ts-expect-error process is not a real option.
  const browser = await browserType.launch({ ...browserOptions, process });
  await browser.close();
});

it('should fire close event for all contexts', async ({browserType, browserOptions}) => {
  const browser = await browserType.launch(browserOptions);
  const context = await browser.newContext();
  let closed = false;
  context.on('close', () => closed = true);
  await browser.close();
  expect(closed).toBe(true);
});

it('should be callable twice', async ({browserType, browserOptions}) => {
  const browser = await browserType.launch(browserOptions);
  await Promise.all([
    browser.close(),
    browser.close(),
  ]);
  await browser.close();
});

/**
 * Copyright 2019 Google Inc. All rights reserved.
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
import { it, expect } from '../fixtures';

import path from 'path';
import type { ChromiumBrowser, ChromiumBrowserContext } from '../..';

it('should throw with remote-debugging-pipe argument', (test, { browserName, mode }) => {
  test.skip(mode !== 'default' || browserName !== 'chromium');
}, async ({browserType, browserOptions}) => {
  const options = Object.assign({}, browserOptions);
  options.args = ['--remote-debugging-pipe'].concat(options.args || []);
  const error = await browserType.launchServer(options).catch(e => e);
  expect(error.message).toContain('Playwright manages remote debugging connection itself');
});

it('should not throw with remote-debugging-port argument', (test, { browserName, mode }) => {
  test.skip(mode !== 'default' || browserName !== 'chromium');
}, async ({browserType, browserOptions}) => {
  const options = Object.assign({}, browserOptions);
  options.args = ['--remote-debugging-port=0'].concat(options.args || []);
  const browser = await browserType.launchServer(options);
  await browser.close();
});

it('should open devtools when "devtools: true" option is given', (test, { mode, browserName, platform}) => {
  test.skip(browserName !== 'chromium' || mode !== 'default' || platform === 'win32');
}, async ({browserType, browserOptions}) => {
  let devtoolsCallback;
  const devtoolsPromise = new Promise(f => devtoolsCallback = f);
  const __testHookForDevTools = devtools => devtools.__testHookOnBinding = parsed => {
    if (parsed.method === 'getPreferences')
      devtoolsCallback();
  };
  const browser = await browserType.launch({...browserOptions, headless: false, devtools: true, __testHookForDevTools} as any);
  const context = await browser.newContext();
  await Promise.all([
    devtoolsPromise,
    context.newPage()
  ]);
  await browser.close();
});

it('should return background pages', (test, { browserName }) => {
  test.skip(browserName !== 'chromium');
}, async ({browserType, browserOptions, createUserDataDir}) => {
  const userDataDir = await createUserDataDir();
  const extensionPath = path.join(__dirname, '..', 'assets', 'simple-extension');
  const extensionOptions = {...browserOptions,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  };
  const context = await browserType.launchPersistentContext(userDataDir, extensionOptions) as ChromiumBrowserContext;
  const backgroundPages = context.backgroundPages();
  const backgroundPage = backgroundPages.length
    ? backgroundPages[0]
    : await context.waitForEvent('backgroundpage');
  expect(backgroundPage).toBeTruthy();
  expect(context.backgroundPages()).toContain(backgroundPage);
  expect(context.pages()).not.toContain(backgroundPage);
  await context.close();
});

it('should return background pages when recording video', (test, { browserName }) => {
  test.skip(browserName !== 'chromium');
}, async ({browserType, testInfo, browserOptions, createUserDataDir}) => {
  const userDataDir = await createUserDataDir();
  const extensionPath = path.join(__dirname, '..', 'assets', 'simple-extension');
  const extensionOptions = {...browserOptions,
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    recordVideo: {
      dir: testInfo.outputPath(''),
    },
  };
  const context = await browserType.launchPersistentContext(userDataDir, extensionOptions) as ChromiumBrowserContext;
  const backgroundPages = context.backgroundPages();
  const backgroundPage = backgroundPages.length
    ? backgroundPages[0]
    : await context.waitForEvent('backgroundpage');
  expect(backgroundPage).toBeTruthy();
  expect(context.backgroundPages()).toContain(backgroundPage);
  expect(context.pages()).not.toContain(backgroundPage);
  await context.close();
});

it('should not create pages automatically', (test, { browserName }) => {
  test.skip(browserName !== 'chromium');
}, async ({browserType, browserOptions}) => {
  const browser = await browserType.launch(browserOptions);
  const browserSession = await (browser as ChromiumBrowser).newBrowserCDPSession();
  const targets = [];
  browserSession.on('Target.targetCreated', async ({targetInfo}) => {
    if (targetInfo.type !== 'browser')
      targets.push(targetInfo);
  });
  await browserSession.send('Target.setDiscoverTargets', { discover: true });
  await browser.newContext();
  await browser.close();
  expect(targets.length).toBe(0);
});

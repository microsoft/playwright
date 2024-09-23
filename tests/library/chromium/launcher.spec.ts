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

import { playwrightTest as it, expect } from '../../config/browserTest';

it('should throw with remote-debugging-pipe argument', async ({ browserType, mode }) => {
  it.skip(mode !== 'default');

  const options: any = {};
  options.args = ['--remote-debugging-pipe'].concat(options.args || []);
  const error = await browserType.launchServer(options).catch(e => e);
  expect(error.message).toContain('Playwright manages remote debugging connection itself');
});

it('should not throw with remote-debugging-port argument', async ({ browserType, mode }) => {
  it.skip(mode !== 'default');

  const options: any = {};
  options.args = ['--remote-debugging-port=0'].concat(options.args || []);
  const browser = await browserType.launchServer(options);
  await browser.close();
});

it('should open devtools when "devtools: true" option is given', async ({ browserType, mode, platform, channel }) => {
  it.skip(mode !== 'default' || platform === 'win32' || !!channel);

  let devtoolsCallback;
  const devtoolsPromise = new Promise(f => devtoolsCallback = f);
  const __testHookForDevTools = devtools => devtools.__testHookOnBinding = parsed => {
    if (parsed.method === 'getPreferences')
      devtoolsCallback();
  };
  const browser = await browserType.launch({ headless: false, devtools: true, __testHookForDevTools } as any);
  const context = await browser.newContext();
  await Promise.all([
    devtoolsPromise,
    context.newPage()
  ]);
  await browser.close();
});

it('should return background pages', async ({ browserType, createUserDataDir, asset }) => {
  const userDataDir = await createUserDataDir();
  const extensionPath = asset('simple-extension');
  const extensionOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  };
  const context = await browserType.launchPersistentContext(userDataDir, extensionOptions);
  const backgroundPages = context.backgroundPages();
  const backgroundPage = backgroundPages.length
    ? backgroundPages[0]
    : await context.waitForEvent('backgroundpage');
  expect(backgroundPage).toBeTruthy();
  expect(context.backgroundPages()).toContain(backgroundPage);
  expect(context.pages()).not.toContain(backgroundPage);
  await context.close();
  expect(context.pages().length).toBe(0);
  expect(context.backgroundPages().length).toBe(0);
});

it('should return background pages when recording video', async ({ browserType, createUserDataDir, asset }, testInfo) => {
  const userDataDir = await createUserDataDir();
  const extensionPath = asset('simple-extension');
  const extensionOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
    recordVideo: {
      dir: testInfo.outputPath(''),
    },
  };
  const context = await browserType.launchPersistentContext(userDataDir, extensionOptions);
  const backgroundPages = context.backgroundPages();
  const backgroundPage = backgroundPages.length
    ? backgroundPages[0]
    : await context.waitForEvent('backgroundpage');
  expect(backgroundPage).toBeTruthy();
  expect(context.backgroundPages()).toContain(backgroundPage);
  expect(context.pages()).not.toContain(backgroundPage);
  await context.close();
});

it('should support request/response events when using backgroundPage()', async ({ browserType, createUserDataDir, asset, server }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html', 'x-response-foobar': 'BarFoo' });
    res.end(`<span>hello world!</span>`);
  });
  const userDataDir = await createUserDataDir();
  const extensionPath = asset('simple-extension');
  const extensionOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  };
  const context = await browserType.launchPersistentContext(userDataDir, extensionOptions);
  const backgroundPages = context.backgroundPages();
  const backgroundPage = backgroundPages.length
    ? backgroundPages[0]
    : await context.waitForEvent('backgroundpage');
  await backgroundPage.waitForURL(/chrome-extension\:\/\/.*/);
  const [request, response, contextRequest, contextResponse] = await Promise.all([
    backgroundPage.waitForEvent('request'),
    backgroundPage.waitForEvent('response'),
    context.waitForEvent('request'),
    context.waitForEvent('response'),
    backgroundPage.evaluate(url => fetch(url, {
      method: 'POST',
      body: 'foobar',
      headers: { 'X-FOOBAR': 'KEKBAR' }
    }), server.EMPTY_PAGE),
  ]);
  expect(request).toBe(contextRequest);
  expect(response).toBe(contextResponse);
  expect(request.url()).toBe(server.EMPTY_PAGE);
  expect(request.method()).toBe('POST');
  expect(await request.allHeaders()).toEqual(expect.objectContaining({ 'x-foobar': 'KEKBAR' }));
  expect(request.postData()).toBe('foobar');

  expect(response.status()).toBe(200);
  expect(response.url()).toBe(server.EMPTY_PAGE);
  expect(response.request()).toBe(request);
  expect(await response.text()).toBe('<span>hello world!</span>');
  expect(await response.allHeaders()).toEqual(expect.objectContaining({ 'x-response-foobar': 'BarFoo' }));

  await context.close();
});

it('should report console messages from content script', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32762' }
}, async ({ browserType, createUserDataDir, asset, server }) => {
  const userDataDir = await createUserDataDir();
  const extensionPath = asset('extension-with-logging');
  const extensionOptions = {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  };
  const context = await browserType.launchPersistentContext(userDataDir, extensionOptions);
  const page = await context.newPage();
  const consolePromise = page.waitForEvent('console', e => e.text().includes('Test console log from a third-party execution context'));
  await page.goto(server.EMPTY_PAGE);
  const message = await consolePromise;
  expect(message.text()).toContain('Test console log from a third-party execution context');
  await context.close();
});

it('should not create pages automatically', async ({ browserType }) => {
  const browser = await browserType.launch();
  const browserSession = await browser.newBrowserCDPSession();
  const targets = [];
  browserSession.on('Target.targetCreated', async ({ targetInfo }) => {
    if (targetInfo.type !== 'browser')
      targets.push(targetInfo);
  });
  await browserSession.send('Target.setDiscoverTargets', { discover: true });
  await browser.newContext();
  await browser.close();
  expect(targets.length).toBe(0);
});

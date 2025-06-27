/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { playwrightTest as it, expect } from '../../config/browserTest';

it.skip(({ isHeadlessShell }) => isHeadlessShell, 'Headless Shell has no support for extensions');

it.describe('MV2', () => {
  it('should return background pages', async ({ browserType, asset }) => {
    const extensionPath = asset('extension-mv2-simple');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
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

  it('should return background pages when recording video', async ({ browserType, asset }, testInfo) => {
    const extensionPath = asset('extension-mv2-simple');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
    const backgroundPages = context.backgroundPages();
    const backgroundPage = backgroundPages.length
      ? backgroundPages[0]
      : await context.waitForEvent('backgroundpage');
    expect(backgroundPage).toBeTruthy();
    expect(context.backgroundPages()).toContain(backgroundPage);
    expect(context.pages()).not.toContain(backgroundPage);
    await context.close();
  });

  it('should support request/response events when using backgroundPage()', async ({ browserType, asset, server }) => {
    server.setRoute('/empty.html', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'x-response-foobar': 'BarFoo' });
      res.end(`<span>hello world!</span>`);
    });
    const extensionPath = asset('extension-mv2-simple');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
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
});

it.describe('MV3', () => {
  it('should return background pages', async ({ browserType, asset }) => {
    const extensionPath = asset('extension-mv3-simple');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
    const serviceWorkers = context.serviceWorkers();
    const serviceWorker = serviceWorkers.length ? serviceWorkers[0] : await context.waitForEvent('serviceworker');
    expect(serviceWorker).toBeTruthy();
    expect(context.serviceWorkers()).toContain(serviceWorker);
    expect(await serviceWorker.evaluate(() => (globalThis as any).MAGIC)).toBe(42);
    await context.close();
    expect(context.backgroundPages().length).toBe(0);
  });

  it('should return background pages when recording video', async ({ browserType, asset }, testInfo) => {
    const extensionPath = asset('extension-mv3-simple');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
    const serviceWorkers = context.serviceWorkers();
    const serviceWorker = serviceWorkers.length ? serviceWorkers[0] : await context.waitForEvent('serviceworker');
    expect(serviceWorker).toBeTruthy();
    expect(context.serviceWorkers()).toContain(serviceWorker);
    expect(await serviceWorker.evaluate(() => (globalThis as any).MAGIC)).toBe(42);
    await context.close();
  });

  it('should support request/response events when using backgroundPage()', async ({ browserType, asset, server }) => {
    process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
    server.setRoute('/empty.html', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'x-response-foobar': 'BarFoo' });
      res.end(`<span>hello world!</span>`);
    });
    const extensionPath = asset('extension-mv3-simple');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
    const serviceWorkers = context.serviceWorkers();
    const serviceWorker = serviceWorkers.length ? serviceWorkers[0] : await context.waitForEvent('serviceworker');
    expect(serviceWorker.url()).toMatch(/chrome-extension\:\/\/.*/);
    const [request, response] = await Promise.all([
      context.waitForEvent('request'),
      context.waitForEvent('response'),
      serviceWorker.evaluate(url => fetch(url, {
        method: 'POST',
        body: 'foobar',
        headers: { 'X-FOOBAR': 'KEKBAR' }
      }), server.EMPTY_PAGE),
    ]);
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
    delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS;
  });

  it('should report console messages from content script via CLI', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32762' }
  }, async ({ browserType, asset, server }) => {
    const extensionPath = asset('extension-mv3-with-logging');
    const extensionOptions = {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
    const page = await context.newPage();
    const consolePromise = page.waitForEvent('console', e => e.text().includes('Test console log from a third-party execution context'));
    await page.goto(server.EMPTY_PAGE);
    const message = await consolePromise;
    expect(message.text()).toContain('Test console log from a third-party execution context');
    await context.close();
  });

  it('should report console messages from content script via CDP', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32762' }
  }, async ({ browserType, asset, server }) => {
    const extensionPath = asset('extension-mv3-with-logging');
    const extensionOptions = {
      args: ['--enable-unsafe-extension-debugging'],
      ignoreDefaultArgs: ['--disable-extensions']
    };
    const context = await browserType.launchPersistentContext('', extensionOptions);
    const browserSession = await context.browser().newBrowserCDPSession();
    await browserSession.send('Extensions.loadUnpacked', { path: extensionPath });
    const page = await context.newPage();
    const consolePromise = page.waitForEvent('console', e => e.text().includes('Test console log from a third-party execution context'));
    await page.goto(server.EMPTY_PAGE);
    const message = await consolePromise;
    expect(message.text()).toContain('Test console log from a third-party execution context');
    await context.close();
  });
});

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

import type { BrowserType, BrowserContext } from 'playwright-core';
import { playwrightTest as base, expect } from '../../config/browserTest';

const it = base.extend<{
  launchPersistentContext: (extensionPath: string, options?: Parameters<BrowserType['launchPersistentContext']>[1]) => Promise<BrowserContext>;
}>({
  launchPersistentContext: async ({ browserType }, use) => {
    const browsers: BrowserContext[] = [];
    await use(async (extensionPath, options = {}) => {
      const extensionOptions = {
        ...options,
        args: [
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`,
        ],
      };
      return await browserType.launchPersistentContext('', extensionOptions);
    });
    await Promise.all(browsers.map(browser => browser.close()));
  }
});

it.skip(({ isHeadlessShell }) => isHeadlessShell, 'Headless Shell has no support for extensions');

it.describe('MV3', () => {
  it.skip(({ channel }) => channel?.startsWith('chrome'), '--load-extension is not supported in Chrome anymore. https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ');

  it('should support service worker stop and restart lifecycle', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/39475' }
  }, async ({ launchPersistentContext, asset }) => {
    const extensionPath = asset('extension-mv3-sw-lifecycle');
    const context = await launchPersistentContext(extensionPath);

    const serviceWorkers = context.serviceWorkers();
    const sw1 = serviceWorkers.length ? serviceWorkers[0] : await context.waitForEvent('serviceworker');
    const startTime1 = await sw1.evaluate(() => (globalThis as any).startTime);

    // stopWorker keeps the same CDP target alive, matching Chrome's natural idle suspension behavior.
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    const waitForCdpEvent = <T>(event: string, predicate: (params: any) => T | undefined): Promise<T> => {
      return new Promise<T>(resolve => {
        const handler = (params: any) => {
          const result = predicate(params);
          if (result !== undefined) {
            cdp.off(event as any, handler);
            resolve(result);
          }
        };
        cdp.on(event as any, handler);
      });
    };

    const versionPromise = waitForCdpEvent('ServiceWorker.workerVersionUpdated', ({ versions }: any) => versions[0]?.versionId as string | undefined);
    const scopePromise = waitForCdpEvent('ServiceWorker.workerRegistrationUpdated', ({ registrations }: any) => registrations[0]?.scopeURL as string | undefined);
    await cdp.send('ServiceWorker.enable');
    const versionId = await versionPromise;
    const scopeURL = await scopePromise;

    const stoppedPromise = waitForCdpEvent('ServiceWorker.workerVersionUpdated', ({ versions }: any) => versions[0]?.runningStatus === 'stopped' ? true : undefined);
    await cdp.send('ServiceWorker.stopWorker', { versionId });
    await stoppedPromise;

    const runningPromise = waitForCdpEvent('ServiceWorker.workerVersionUpdated', ({ versions }: any) => versions[0]?.runningStatus === 'running' ? true : undefined);
    await cdp.send('ServiceWorker.startWorker', { scopeURL });
    await runningPromise;

    const startTime2 = await sw1.evaluate(() => (globalThis as any).startTime);
    expect(startTime2).toBeGreaterThan(startTime1);
    expect(context.serviceWorkers()).toStrictEqual([sw1]); // same object, no new event

    await context.close();
  });

  it('should give access to the service worker', async ({ launchPersistentContext, asset }) => {
    const extensionPath = asset('extension-mv3-simple');
    const context = await launchPersistentContext(extensionPath);
    const serviceWorkers = context.serviceWorkers();
    const serviceWorker = serviceWorkers.length ? serviceWorkers[0] : await context.waitForEvent('serviceworker');
    expect(serviceWorker).toBeTruthy();
    expect(context.serviceWorkers()).toContain(serviceWorker);
    await expect.poll(() => serviceWorker.evaluate(() => (globalThis as any).MAGIC)).toBe(42);
    await context.close();
    expect(context.backgroundPages().length).toBe(0);
  });

  it('should give access to the service worker when recording video', async ({ launchPersistentContext, asset }, testInfo) => {
    const extensionPath = asset('extension-mv3-simple');
    const context = await launchPersistentContext(extensionPath, {
      recordVideo: {
        dir: testInfo.outputPath(''),
      }
    });
    const serviceWorkers = context.serviceWorkers();
    const serviceWorker = serviceWorkers.length ? serviceWorkers[0] : await context.waitForEvent('serviceworker');
    expect(serviceWorker).toBeTruthy();
    expect(context.serviceWorkers()).toContain(serviceWorker);
    await expect.poll(() => serviceWorker.evaluate(() => (globalThis as any).MAGIC)).toBe(42);
    await context.close();
  });

  it('should support request/response events in the service worker', async ({ launchPersistentContext, asset, server, browserMajorVersion }) => {
    it.skip(browserMajorVersion < 143, 'needs workerScriptLoaded event');

    server.setRoute('/empty.html', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'x-response-foobar': 'BarFoo' });
      res.end(`<span>hello world!</span>`);
    });
    const extensionPath = asset('extension-mv3-simple');
    const context = await launchPersistentContext(extensionPath);
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
  });

  it('should report console messages from content script', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32762' }
  }, async ({ launchPersistentContext, asset, server }) => {
    const extensionPath = asset('extension-mv3-with-logging');
    const context = await launchPersistentContext(extensionPath);
    const page = await context.newPage();
    const consolePromise = page.waitForEvent('console', e => e.text().includes('Test console log from a third-party execution context'));
    await page.goto(server.EMPTY_PAGE);
    const message = await consolePromise;
    expect(message.text()).toContain('Test console log from a third-party execution context');
    await context.close();
  });
});

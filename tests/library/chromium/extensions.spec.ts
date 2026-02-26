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

  // Repro for https://github.com/microsoft/playwright/issues/27015
  //
  // MV3 service workers should be able to stop and restart so developers can
  // test state-restoration behavior.  This test uses the raw CDP
  // `ServiceWorker` domain (no Playwright API for this exists) to force the
  // lifecycle, then asserts the behavior a correct implementation would provide.
  //
  // Expected (desired) behavior:
  //   - after a SW stop+start cycle, context.waitForEvent('serviceworker') fires
  //   - the new Worker has a fresh execution context (startTime > original)
  //
  // Actual (broken) behavior:
  //   - Chrome reuses the same CDP target ID on restart, so no
  //     Target.attachedToTarget fires and the 'serviceworker' event is never
  //     emitted by Playwright.
  //   - The Runtime.executionContextCreated listener in CRServiceWorker is
  //     session.once(), so the fresh context after restart is never captured.
  //     Evaluating in the original Worker reference throws a stale-context error.
  it('should support service worker stop and restart lifecycle', {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27015' }
  }, async ({ launchPersistentContext, asset }) => {
    const extensionPath = asset('extension-mv3-sw-lifecycle');
    const context = await launchPersistentContext(extensionPath);

    // 1. Grab the initial service worker and record its start timestamp.
    const sw1 = context.serviceWorkers().length
        ? context.serviceWorkers()[0]
        : await context.waitForEvent('serviceworker');
    const startTime1 = await sw1.evaluate(() => (globalThis as any).startTime);
    console.log(`[repro] initial SW startTime: ${startTime1}`);

    // 2. Open a CDP session on a page to reach the ServiceWorker CDP domain.
    //    (No Playwright API to stop a SW exists today.)
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);

    // Set up listeners BEFORE calling ServiceWorker.enable — Chrome fires
    // workerVersionUpdated/workerRegistrationUpdated immediately on enable.
    let versionId: string | undefined;
    let scopeURL: string | undefined;
    let runningStatus: string | undefined;
    const statusHistory: string[] = [];
    cdp.on('ServiceWorker.workerVersionUpdated', ({ versions }: any) => {
      const v = versions[0];
      if (!v) return;
      versionId = v.versionId;
      runningStatus = v.runningStatus;
      statusHistory.push(v.runningStatus);
    });
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }: any) => {
      if (registrations.length)
        scopeURL = registrations[0].scopeURL;
    });
    await cdp.send('ServiceWorker.enable');
    await expect.poll(() => versionId && scopeURL, { timeout: 5000 }).toBeTruthy();

    // 3. Force a stop → start cycle via CDP.
    await cdp.send('ServiceWorker.stopWorker', { versionId });
    await cdp.send('ServiceWorker.startWorker', { scopeURL });

    // Wait for Chrome to confirm the SW is running again (proves the cycle
    // worked at the CDP level before we check Playwright's awareness of it).
    await expect.poll(() => runningStatus, { timeout: 5000 }).toBe('running');
    console.log(`[repro] CDP status history: ${statusHistory.join(' → ')}  (SW did stop and restart at the Chrome level)`);
    console.log(`[repro] context.serviceWorkers().length after restart: ${context.serviceWorkers().length}  (expected 1, still contains old stale worker)`);

    // 4. EXPECTED: Playwright should have emitted a 'serviceworker' event for
    //    the restarted SW (with a fresh execution context).
    //
    //    ACTUAL: the event never fires — Chrome reuses the same target ID so
    //    Target.attachedToTarget is never sent to Playwright.
    const sw2 = await context.waitForEvent('serviceworker', { timeout: 3000 });

    // 5. The restarted SW should have a fresh execution context.
    const startTime2 = await sw2.evaluate(() => (globalThis as any).startTime);
    console.log(`[repro] restarted SW startTime: ${startTime2}  (should be > ${startTime1})`);
    expect(startTime2).toBeGreaterThan(startTime1);
    expect(context.serviceWorkers()).toContain(sw2);
    expect(context.serviceWorkers()).not.toContain(sw1);

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

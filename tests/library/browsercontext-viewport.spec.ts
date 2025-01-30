/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { devices } from '@playwright/test';
import { contextTest as it, expect } from '../config/browserTest';
import { browserTest } from '../config/browserTest';
import { verifyViewport } from '../config/utils';
import { deviceDescriptors } from 'packages/playwright-core/lib/server/deviceDescriptors';

it('should get the proper default viewport size', async ({ page, server }) => {
  await verifyViewport(page, 1280, 720);
});

it('should set the proper viewport size', async ({ page, server }) => {
  await verifyViewport(page, 1280, 720);
  await page.setViewportSize({ width: 345, height: 456 });
  await verifyViewport(page, 345, 456);
});

it('should return correct outerWidth and outerHeight', async ({ page }) => {
  await page.setViewportSize({ width: 410, height: 420 });
  const size = await page.evaluate(() => {
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
    };
  });
  expect(size.innerWidth).toBe(410);
  expect(size.innerHeight).toBe(420);
  expect(size.outerWidth >= size.innerWidth).toBeTruthy();
  expect(size.outerHeight >= size.innerHeight).toBeTruthy();
});

it('landscape viewport should have width larger than height', async () => {
  for (const device in deviceDescriptors) {
    const configuration = deviceDescriptors[device];
    if (device.includes('landscape') || device.includes('Landscape'))
      expect(configuration.viewport.width).toBeGreaterThan(configuration.viewport.height);
  }
});

it('should emulate device width', async ({ page, server }) => {
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  await page.setViewportSize({ width: 300, height: 300 });
  expect(await page.evaluate(() => window.screen.width)).toBe(300);
  expect(await page.evaluate(() => matchMedia('(min-device-width: 200px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(min-device-width: 400px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-width: 200px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-width: 400px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(device-width: 600px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(device-width: 300px)').matches)).toBe(true);
  await page.setViewportSize({ width: 500, height: 500 });
  expect(await page.evaluate(() => window.screen.width)).toBe(500);
  expect(await page.evaluate(() => matchMedia('(min-device-width: 400px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(min-device-width: 600px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-width: 400px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-width: 600px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(device-width: 200px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(device-width: 500px)').matches)).toBe(true);
});

it('should emulate device height', async ({ page, server }) => {
  expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
  await page.setViewportSize({ width: 300, height: 300 });
  expect(await page.evaluate(() => window.screen.height)).toBe(300);
  expect(await page.evaluate(() => matchMedia('(min-device-height: 200px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(min-device-height: 400px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-height: 200px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-height: 400px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(device-height: 600px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(device-height: 300px)').matches)).toBe(true);
  await page.setViewportSize({ width: 500, height: 500 });
  expect(await page.evaluate(() => window.screen.height)).toBe(500);
  expect(await page.evaluate(() => matchMedia('(min-device-height: 400px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(min-device-height: 600px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-height: 400px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(max-device-height: 600px)').matches)).toBe(true);
  expect(await page.evaluate(() => matchMedia('(device-height: 200px)').matches)).toBe(false);
  expect(await page.evaluate(() => matchMedia('(device-height: 500px)').matches)).toBe(true);
});

it('should emulate availWidth and availHeight', async ({ page }) => {
  await page.setViewportSize({ width: 500, height: 600 });
  expect(await page.evaluate(() => window.screen.availWidth)).toBe(500);
  expect(await page.evaluate(() => window.screen.availHeight)).toBe(600);
});

it('should not have touch by default', async ({ page, server, browserName, platform }) => {
  await page.goto(server.PREFIX + '/mobile.html');
  expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(false);
});

it('should throw on tap if hasTouch is not enabled', async ({ page }) => {
  await page.setContent(`<div>a</div>`);
  {
    const error = await page.tap('div').catch(e => e);
    expect(error).toBeTruthy();
    expect(error.message).toContain('The page does not support tap');
  }
  {
    const error = await page.locator('div').tap().catch(e => e);
    expect(error).toBeTruthy();
    expect(error.message).toContain('The page does not support tap');
  }
});

browserTest('should support touch with null viewport', async ({ browser, server }) => {
  const context = await browser.newContext({ viewport: null, hasTouch: true });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/mobile.html');
  expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
  await context.close();
});

it('should set both screen and viewport options', async ({ contextFactory, browserName }) => {
  it.fail(browserName === 'firefox', 'Screen size is reset to viewport');
  const context = await contextFactory({
    screen: { 'width': 1280, 'height': 720 },
    viewport: { 'width': 1000, 'height': 600 },
  });
  const page = await context.newPage();
  const screen = await page.evaluate(() => ({ w: screen.width, h: screen.height }));
  expect(screen).toEqual({ w: 1280, h: 720 });
  const inner = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  expect(inner).toEqual({ w: 1000, h: 600 });
});

browserTest('should report null viewportSize when given null viewport', async ({ browser, server }) => {
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  expect(page.viewportSize()).toBe(null);
  await context.close();
});

browserTest('should drag with high dpi', async ({ browser, server, headless }) => {
  browserTest.fixme(!headless, 'Flaky on all browser in headed');

  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(server.PREFIX + '/drag-n-drop.html');
  await page.hover('#source');
  await page.mouse.down();
  await page.hover('#target');
  await page.mouse.up();
  expect(await page.$eval('#target', target => target.contains(document.querySelector('#source')))).toBe(true); // could not find source in target
  await page.close();
});

it('WebKit Windows headed should have a minimal viewport', async ({ contextFactory, browserName, headless, isWindows }) => {
  it.skip(browserName !== 'webkit' || headless || !isWindows, 'Not relevant for this browser');

  await expect(contextFactory({
    viewport: { 'width': 100, 'height': 100 },
  })).rejects.toThrow('WebKit on Windows has a minimal viewport of 250x240.');

  const context = await contextFactory();
  const page = await context.newPage();
  await expect(page.setViewportSize({ width: 100, height: 100 })).rejects.toThrow('WebKit on Windows has a minimal viewport of 250x240.');
  await context.close();
});

browserTest('should be able to get correct orientation angle on non-mobile devices', async ({ browser, browserName, server }) => {
  browserTest.skip(browserName === 'webkit', 'Desktop webkit dont support orientation API');

  const context = await browser.newContext({ viewport: { width: 300, height: 400 }, isMobile: false });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/index.html');
  expect(await page.evaluate(() => window.screen.orientation.angle)).toBe(0);
  await page.setViewportSize({ width: 400, height: 300 });
  expect(await page.evaluate(() => window.screen.orientation.angle)).toBe(0);
  await context.close();
});

it('should set window.screen.orientation.type for mobile devices', async ({ contextFactory, browserName, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31151' });
  it.skip(browserName === 'firefox', 'Firefox does not support mobile emulation');
  const context = await contextFactory(devices['iPhone 14']);
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/index.html');
  expect(await page.evaluate(() => window.screen.orientation.type)).toBe('portrait-primary');
  await context.close();
});

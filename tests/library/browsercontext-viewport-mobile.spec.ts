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

import { browserTest as it, expect } from '../config/browserTest';

it.describe('mobile viewport', () => {
  it.skip(({ browserName }) => browserName === 'firefox');

  it('should support mobile emulation', async ({ playwright, browser, server }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(375);
    await page.setViewportSize({ width: 400, height: 300 });
    expect(await page.evaluate(() => window.innerWidth)).toBe(400);
    await context.close();
  });

  it('should support touch emulation', async ({ playwright, browser, server }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => 'ontouchstart' in window)).toBe(true);
    expect(await page.evaluate(dispatchTouch)).toBe('Received touch');
    await context.close();

    function dispatchTouch() {
      let fulfill!: (s: string) => void;
      const promise = new Promise(x => fulfill = x);
      window.ontouchstart = function(e) {
        fulfill('Received touch');
      };
      window.dispatchEvent(new Event('touchstart'));

      fulfill('Did not receive touch');

      return promise;
    }
  });

  it('should be detectable', async ({ playwright, browser }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    expect(await page.evaluate(() => 'ontouchstart' in window || !!window.TouchEvent)).toBe(true);
    await context.close();
  });

  it('should detect touch when applying viewport with touches', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 800, height: 600 }, hasTouch: true });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    expect(await page.evaluate(() => 'ontouchstart' in window || !!window.TouchEvent)).toBe(true);
    await context.close();
  });

  it('should support landscape emulation', async ({ playwright, browser, server }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const iPhoneLandscape = playwright.devices['iPhone 6 landscape'];
    const context1 = await browser.newContext({ ...iPhone });
    const page1 = await context1.newPage();
    await page1.goto(server.PREFIX + '/mobile.html');
    expect(await page1.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(false);
    const context2 = await browser.newContext({ ...iPhoneLandscape });
    const page2 = await context2.newPage();
    expect(await page2.evaluate(() => matchMedia('(orientation: landscape)').matches)).toBe(true);
    await context1.close();
    await context2.close();
  });

  it('should support window.orientation emulation', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 300, height: 400 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.orientation)).toBe(0);
    await page.setViewportSize({ width: 400, height: 300 });
    expect(await page.evaluate(() => window.orientation)).toBe(90);
    await context.close();
  });

  it('should fire orientationchange event', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 300, height: 400 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    await page.evaluate(() => {
      let counter = 0;
      window.addEventListener('orientationchange', () => console.log(++counter));
    });

    const event1 = page.waitForEvent('console');
    await page.setViewportSize({ width: 400, height: 300 });
    expect((await event1).text()).toBe('1');

    const event2 = page.waitForEvent('console');
    await page.setViewportSize({ width: 300, height: 400 });
    expect((await event2).text()).toBe('2');
    await context.close();
  });

  it('default mobile viewports to 980 width', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/empty.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(980);
    await context.close();
  });

  it('respect meta viewport tag', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/mobile.html');
    expect(await page.evaluate(() => window.innerWidth)).toBe(320);
    await context.close();
  });

  it('should emulate the hover media feature', async ({ playwright, browser }) => {
    const iPhone = playwright.devices['iPhone 6'];
    const mobilepage = await browser.newPage({ ...iPhone });
    expect(await mobilepage.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false);
    expect(await mobilepage.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
    expect(await mobilepage.evaluate(() => matchMedia('(any-hover: hover)').matches)).toBe(false);
    expect(await mobilepage.evaluate(() => matchMedia('(any-hover: none)').matches)).toBe(true);
    expect(await mobilepage.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    expect(await mobilepage.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(false);
    expect(await mobilepage.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(true);
    expect(await mobilepage.evaluate(() => matchMedia('(any-pointer: fine)').matches)).toBe(false);
    await mobilepage.close();

    const desktopPage = await browser.newPage();
    expect(await desktopPage.evaluate(() => matchMedia('(hover: none)').matches)).toBe(false);
    expect(await desktopPage.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(true);
    expect(await desktopPage.evaluate(() => matchMedia('(any-hover: none)').matches)).toBe(false);
    expect(await desktopPage.evaluate(() => matchMedia('(any-hover: hover)').matches)).toBe(true);
    expect(await desktopPage.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    expect(await desktopPage.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
    expect(await desktopPage.evaluate(() => matchMedia('(any-pointer: coarse)').matches)).toBe(false);
    expect(await desktopPage.evaluate(() => matchMedia('(any-pointer: fine)').matches)).toBe(true);
    await desktopPage.close();
  });

  it('mouse should work with mobile viewports and cross process navigations', async ({ browser, server }) => {
    // @see https://crbug.com/929806
    const context = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await page.goto(server.CROSS_PROCESS_PREFIX + '/mobile.html');
    await page.evaluate(() => {
      document.addEventListener('click', event => {
        (window as any)['result'] = { x: event.clientX, y: event.clientY };
      });
    });

    await page.mouse.click(30, 40);

    expect(await page.evaluate('result')).toEqual({ x: 30, y: 40 });
    await context.close();
  });

  it('should scroll when emulating a mobile viewport', async ({ browser, server, browserName }) => {
    const context = await browser.newContext({
      viewport: { 'width': 1000, 'height': 600 },
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/scrollable.html');
    await page.mouse.move(50, 60);
    const error = await page.mouse.wheel(0, 100).catch(e => e);
    if (browserName === 'webkit')
      expect(error.message).toContain('Mouse wheel is not supported in mobile WebKit');
    else
      await page.waitForFunction('window.scrollY === 100');
    await context.close();
  });

  it('should scroll mobile page with background-attachment: fixed', {
    annotation: [
      { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31551' },
      { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/23573' },
    ]
  }, async ({ playwright, browser, server }) => {
    const iPhone = playwright.devices['iPhone 12'];
    const context = await browser.newContext({ ...iPhone });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/input/background-fixed.html');
    await page.getByRole('button').click();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    await context.close();
  });

  it('view scale should reset after navigation', async ({ browser }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26876' });
    const context = await browser.newContext({
      viewport: { width: 390, height: 664 },
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`data:text/html,<meta name='viewport' content='device-width, initial-scale=1'><button>Mobile Viewport</button>`);
    await page.route('**/button.html', route => {
      void route.fulfill({
        body: `<body>
          <button>Click me</button>
          <script>
            window.clicks = [];
            document.addEventListener('click', e => {
              const dot = document.createElement('div');
              dot.style.position = 'absolute';
              dot.style.width = '10px';
              dot.style.height = '10px';
              dot.style.borderRadius = '5px';
              dot.style.backgroundColor = 'red';
              dot.style.left = e.pageX + 'px';
              dot.style.top = e.pageY + 'px';
              dot.textContent = 'x: ' + e.pageX + ' y: ' + e.pageY;
              document.body.appendChild(dot);
              window.clicks.push({ x: e.pageX, y: e.pageY });
            });
          </script>
        </body>`,
        contentType: 'text/html',
      });
    });
    await page.goto('http://localhost/button.html');
    await page.getByText('Click me').click({ force: true });
    const box = (await page.locator('button').boundingBox())!;
    const clicks = await page.evaluate(() => (window as any).clicks);
    expect(clicks.length).toBe(1);
    const [{ x, y }] = clicks;
    const isClickInsideButton = box.x <= x && x <= box.x + box.width && box.y <= y && y <= box.y + box.height;
    expect(isClickInsideButton).toBe(true);
    await context.close();
  });
});

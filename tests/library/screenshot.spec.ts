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

import { expect, browserTest } from '../config/browserTest';
import { PNG } from 'playwright-core/lib/utilsBundle';
import { verifyViewport } from '../config/utils';

browserTest.describe('page screenshot', () => {
  browserTest.skip(({ browserName, headless }) => browserName === 'firefox' && !headless, 'Firefox headed produces a different image.');

  browserTest('should run in parallel in multiple pages', async ({ server, contextFactory, browserName, isHeadlessShell, channel }) => {
    browserTest.fixme(browserName === 'chromium' && !isHeadlessShell && channel !== 'chromium-tip-of-tree', 'https://github.com/microsoft/playwright/issues/33330');

    const context = await contextFactory();
    const N = 5;
    const pages = await Promise.all(Array(N).fill(0).map(async () => {
      const page = await context.newPage();
      await page.goto(server.PREFIX + '/grid.html');
      return page;
    }));
    const promises = [];
    for (let i = 0; i < N; ++i)
      promises.push(pages[i].screenshot({ clip: { x: 50 * (i % 2), y: 0, width: 50, height: 50 } }));
    const screenshots = await Promise.all(promises);
    for (let i = 0; i < N; ++i)
      expect(screenshots[i]).toMatchSnapshot(`grid-cell-${i % 2}.png`);
    await Promise.all(pages.map(page => page.close()));
  });

  browserTest('should work with a mobile viewport', async ({ browser, server, browserName }) => {
    browserTest.skip(browserName === 'firefox');

    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-mobile.png');
    await context.close();
  });

  browserTest('should work with a mobile viewport and clip', async ({ browser, server, browserName, channel }) => {
    browserTest.skip(browserName === 'firefox');

    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow.html');
    const screenshot = await page.screenshot({ clip: { x: 10, y: 10, width: 100, height: 150 } });
    expect(screenshot).toMatchSnapshot('screenshot-mobile-clip.png');
    await context.close();
  });

  browserTest('should work with a mobile viewport and fullPage', async ({ browser, server, browserName }) => {
    browserTest.skip(browserName === 'firefox');

    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow-large.html');
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchSnapshot('screenshot-mobile-fullpage.png');
    await context.close();
  });

  browserTest('should work with device scale factor', async ({ browser, server, isMac, browserName }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-device-scale-factor.png');
    await context.close();
  });

  browserTest('should work with device scale factor and clip', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 500, height: 500 }, deviceScaleFactor: 3 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({ clip: { x: 50, y: 100, width: 150, height: 100 } });
    expect(screenshot).toMatchSnapshot('screenshot-device-scale-factor-clip.png');
    await context.close();
  });

  browserTest('should work with device scale factor and scale:css', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({ scale: 'css' });
    expect(screenshot).toMatchSnapshot('screenshot-device-scale-factor-css-size.png');
    await context.close();
  });

  browserTest('should work with device scale factor, clip and scale:css', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 500, height: 500 }, deviceScaleFactor: 3 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({ clip: { x: 50, y: 100, width: 150, height: 100 }, scale: 'css' });
    expect(screenshot).toMatchSnapshot('screenshot-device-scale-factor-clip-css-size.png');
    await context.close();
  });

  browserTest('should throw if screenshot size is too large with device scale factor', async ({ browser, browserName, isMac }) => {
    browserTest.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16727' });
    const context = await browser.newContext({ viewport: { width: 500, height: 500 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    {
      await page.setContent(`<style>body {margin: 0; padding: 0;}</style><div style='min-height: 16383px; background: red;'></div>`);
      const result = await page.screenshot({ fullPage: true });
      expect(result).toBeTruthy();
    }
    {
      await page.setContent(`<style>body {margin: 0; padding: 0;}</style><div style='min-height: 16384px; background: red;'></div>`);
      const exception = await page.screenshot({ fullPage: true }).catch(e => e);
      if (browserName === 'firefox' || (browserName === 'webkit' && !isMac))
        expect(exception.message).toContain('Cannot take screenshot larger than 32767');

      const image = await page.screenshot({ fullPage: true, scale: 'css' });
      expect(image).toBeTruthy();
    }
    await context.close();
  });

  browserTest('should work with large size', async ({ browserName, headless, platform, contextFactory }) => {
    browserTest.fixme(browserName === 'chromium' && !headless && platform === 'linux', 'Chromium has gpu problems on linux with large screenshots');
    browserTest.slow(true, 'Large screenshot is slow');

    const context = await contextFactory();
    const page = await context.newPage();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      const div = document.createElement('div');
      div.style.width = '1250px';
      div.style.height = '8440px';
      div.style.background = 'linear-gradient(red, blue)';
      document.body.appendChild(div);
    });
    const buffer = await page.screenshot({ fullPage: true });
    const decoded = PNG.sync.read(buffer);

    const pixel = (x: number, y: number) => {
      const dst = new PNG({ width: 1, height: 1 });
      PNG.bitblt(decoded, dst, x, y, 1, 1);
      const pixels = dst.data;
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    };

    expect(pixel(0, 0).r).toBeGreaterThan(128);
    expect(pixel(0, 0).b).toBeLessThan(128);
    expect(pixel(0, 8339).r).toBeLessThan(128);
    expect(pixel(0, 8339).b).toBeGreaterThan(128);
  });

  browserTest('should handle vh units ', async ({ contextFactory }) => {
    const context = await contextFactory();
    const page = await context.newPage();

    await page.setViewportSize({ width: 800, height: 500 });
    await page.evaluate(() => {
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.documentElement.style.margin = '0';
      document.documentElement.style.padding = '0';
      const div = document.createElement('div');
      div.style.width = '100%';
      div.style.borderTop = '100vh solid red';
      div.style.borderBottom = '100vh solid blue';
      document.body.appendChild(div);
    });
    const buffer = await page.screenshot({ fullPage: true });
    const decoded = PNG.sync.read(buffer);

    const pixel = (x: number, y: number) => {
      const dst = new PNG({ width: 1, height: 1 });
      PNG.bitblt(decoded, dst, x, y, 1, 1);
      const pixels = dst.data;
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    };

    expect(pixel(0, 0).r).toBeGreaterThan(128);
    expect(pixel(0, 0).b).toBeLessThan(128);
    expect(pixel(0, 999).r).toBeLessThan(128);
    expect(pixel(0, 999).b).toBeGreaterThan(128);
  });
});

browserTest.describe('element screenshot', () => {
  browserTest.skip(({ browserName, headless }) => browserName === 'firefox' && !headless);

  browserTest('element screenshot should work with a mobile viewport', async ({ browser, server, browserName }) => {
    browserTest.skip(browserName === 'firefox');

    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-mobile.png');
    await context.close();
  });

  browserTest('element screenshot should work with device scale factor', async ({ browser, server, browserName, isMac }) => {
    browserTest.skip(browserName === 'firefox');

    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-mobile-dsf.png');
    await context.close();
  });

  browserTest('should take screenshots when default viewport is null', async ({ server, browser }) => {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.setContent(`<div style='height: 10000px; background: red'></div>`);
    const windowSize = await page.evaluate(() => ({ width: window.innerWidth * window.devicePixelRatio, height: window.innerHeight * window.devicePixelRatio }));
    const sizeBefore = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));

    const screenshot = await page.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
    const decoded = PNG.sync.read(screenshot);
    expect(decoded.width).toBe(windowSize.width);
    expect(decoded.height).toBe(windowSize.height);

    const sizeAfter = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
    expect(sizeBefore.width).toBe(sizeAfter.width);
    expect(sizeBefore.height).toBe(sizeAfter.height);
    await context.close();
  });

  browserTest('should take fullPage screenshots when default viewport is null', async ({ server, browser }) => {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const sizeBefore = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
    const screenshot = await page.screenshot({
      fullPage: true
    });
    expect(screenshot).toBeInstanceOf(Buffer);

    const sizeAfter = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
    expect(sizeBefore.width).toBe(sizeAfter.width);
    expect(sizeBefore.height).toBe(sizeAfter.height);
    await context.close();
  });

  browserTest('should restore default viewport after fullPage screenshot', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 456, height: 789 } });
    const page = await context.newPage();
    await verifyViewport(page, 456, 789);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeInstanceOf(Buffer);
    await verifyViewport(page, 456, 789);
    await context.close();
  });

  browserTest('should restore viewport after page screenshot and exception', async ({ browser, server, mode }) => {
    browserTest.skip(mode !== 'default');

    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const __testHookBeforeScreenshot = () => { throw new Error('oh my'); };
    const error = await page.screenshot({ fullPage: true, __testHookBeforeScreenshot } as any).catch(e => e);
    expect(error.message).toContain('oh my');
    await verifyViewport(page, 350, 360);
    await context.close();
  });

  browserTest('should restore viewport after page screenshot and timeout', async ({ browser, server, mode }) => {
    browserTest.skip(mode !== 'default');

    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const __testHookAfterScreenshot = () => new Promise(f => setTimeout(f, 5000));
    const error = await page.screenshot({ fullPage: true, __testHookAfterScreenshot, timeout: 3000 } as any).catch(e => e);
    expect(error.message).toContain('page.screenshot: Timeout 3000ms exceeded');
    await verifyViewport(page, 350, 360);
    await page.setViewportSize({ width: 400, height: 400 });
    await page.waitForTimeout(3000); // Give it some time to wrongly restore previous viewport.
    await verifyViewport(page, 400, 400);
    await context.close();
  });

  browserTest('should take element screenshot when default viewport is null and restore back', async ({ server, browser }) => {
    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();
    await page.setContent(`
      <div style="height: 14px">oooo</div>
      <style>
      div.to-screenshot {
        border: 1px solid blue;
        width: 600px;
        height: 600px;
        margin-left: 50px;
      }
      ::-webkit-scrollbar{
        display: none;
      }
      </style>
      <div class="to-screenshot"></div>
      <div class="to-screenshot"></div>
      <div class="to-screenshot"></div>
    `);
    const sizeBefore = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
    const elementHandle = await page.$('div.to-screenshot');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
    const sizeAfter = await page.evaluate(() => ({ width: document.body.offsetWidth, height: document.body.offsetHeight }));
    expect(sizeBefore.width).toBe(sizeAfter.width);
    expect(sizeBefore.height).toBe(sizeAfter.height);
    await context.close();
  });

  browserTest('should restore viewport after element screenshot and exception', async ({ browser, mode }) => {
    browserTest.skip(mode !== 'default');

    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.setContent(`<div style="width:600px;height:600px;"></div>`);
    const elementHandle = await page.$('div');
    const __testHookBeforeScreenshot = () => { throw new Error('oh my'); };
    const error = await elementHandle.screenshot({ __testHookBeforeScreenshot } as any).catch(e => e);
    expect(error.message).toContain('oh my');
    await verifyViewport(page, 350, 360);
    await context.close();
  });

  browserTest('element screenshots should handle vh units ', async ({ contextFactory }) => {
    const context = await contextFactory();
    const page = await context.newPage();

    await page.setViewportSize({ width: 800, height: 500 });
    await page.evaluate(() => {
      const div = document.createElement('div');
      div.style.width = '100%';
      div.style.borderTop = '100vh solid red';
      div.style.borderBottom = '100vh solid blue';
      document.body.appendChild(div);
    });
    const elementHandle = await page.$('div');
    const buffer = await elementHandle.screenshot();
    const decoded = PNG.sync.read(buffer);

    const pixel = (x: number, y: number) => {
      const dst = new PNG({ width: 1, height: 1 });
      PNG.bitblt(decoded, dst, x, y, 1, 1);
      const pixels = dst.data;
      return { r: pixels[0], g: pixels[1], b: pixels[2], a: pixels[3] };
    };

    expect(pixel(0, 0).r).toBeGreaterThan(128);
    expect(pixel(0, 0).b).toBeLessThan(128);
    expect(pixel(0, 999).r).toBeLessThan(128);
    expect(pixel(0, 999).b).toBeGreaterThan(128);
  });

  browserTest('should work if the main resource hangs', async ({ browser, browserName, mode, server }) => {
    browserTest.skip(mode !== 'default');
    browserTest.skip(browserName === 'chromium', 'https://github.com/microsoft/playwright/issues/9757');

    const page = await browser.newPage();
    server.setRoute('/slow', (req, res) => {
      res.writeHead(200, {
        'content-length': 4096,
        'content-type': 'text/html',
      });
    });
    try {
      await page.goto(server.PREFIX + '/slow', { timeout: 1000 }).catch(() => {});
      const screenshot = await page.screenshot();
      expect(screenshot).toMatchSnapshot('hanging-main-resource.png');
    } finally {
      await page.close();
    }
  });

  browserTest('should capture full element when larger than viewport with device scale factor', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 501, height: 501 }, deviceScaleFactor: 2.5 });
    const page = await context.newPage();
    await page.setContent(`
      <div style="height: 14px">oooo</div>
      <style>
      div.to-screenshot {
        border: 4px solid red;
        box-sizing: border-box;
        width: 600px;
        height: 600px;
        margin-left: 50px;
        background: rgb(0, 100, 200);
      }
      ::-webkit-scrollbar{
        display: none;
      }
      </style>
      <div class="to-screenshot"></div>
    `);
    const screenshot = await page.locator('div.to-screenshot').screenshot();
    expect(screenshot).toMatchSnapshot('element-larger-than-viewport-dsf.png');
    await context.close();
  });

  browserTest('should capture full element when larger than viewport with device scale factor and scale:css', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 501, height: 501 }, deviceScaleFactor: 2.5 });
    const page = await context.newPage();
    await page.setContent(`
      <div style="height: 14px">oooo</div>
      <style>
      div.to-screenshot {
        border: 4px solid red;
        box-sizing: border-box;
        width: 600px;
        height: 600px;
        margin-left: 50px;
        background: rgb(0, 100, 200);
      }
      ::-webkit-scrollbar{
        display: none;
      }
      </style>
      <div class="to-screenshot"></div>
    `);
    const screenshot = await page.locator('div.to-screenshot').screenshot({ scale: 'css' });
    expect(screenshot).toMatchSnapshot('element-larger-than-viewport-dsf-css-size.png');
    await context.close();
  });

  browserTest('page screenshot should capture css transform with device pixels', async function({ browser, browserName }) {
    browserTest.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26447' });
    browserTest.fixme(browserName === 'webkit');
    const context = await browser.newContext({
      viewport: { width: 500, height: 500 },
      deviceScaleFactor: 3,
    });
    const page = await context.newPage();
    await page.setContent(`
      <style>
      .container {
        width: 150px;
        height: 150px;
        margin: 75px 0 0 75px;
        border: none;
      }

      .cube {
        width: 100%;
        height: 100%;
        perspective: 550px;
        perspective-origin: 150% 150%;
      }

      .face {
        display: block;
        position: absolute;
        width: 100px;
        height: 100px;
        border: none;
      }

      .right {
        background: rgba(196, 0, 0, 0.7);
        transform: rotateY(70deg);
      }

      </style>
      <div class="container">
        <div class="cube showbf">
          <div class="face right"></div>
        </div>
      </div>
    `);

    await expect(page).toHaveScreenshot({ scale: 'device' });
    await context.close();
  });
});

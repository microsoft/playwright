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

import { test as it, expect } from './config/pageTest';
import { browserTest, slowBrowserTest } from './config/browserTest';
import { verifyViewport } from './config/utils';
import path from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';

it.describe('page screenshot', () => {
  it.beforeEach(async ({ browserName, headful, isAndroid }) => {
    it.skip(browserName === 'firefox' && headful, 'Firefox headful produces a different image.');
    it.skip(isAndroid, 'Different viewport');
  });

  it('should work', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-sanity.png');
  });

  it('should clip rect', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      clip: {
        x: 50,
        y: 100,
        width: 150,
        height: 100
      }
    });
    expect(screenshot).toMatchSnapshot('screenshot-clip-rect.png');
  });

  it('should clip rect with fullPage', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(150, 200));
    const screenshot = await page.screenshot({
      fullPage: true,
      clip: {
        x: 50,
        y: 100,
        width: 150,
        height: 100,
      },
    });
    expect(screenshot).toMatchSnapshot('screenshot-clip-rect.png');
  });

  it('should clip elements to the viewport', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      clip: {
        x: 50,
        y: 450,
        width: 1000,
        height: 100
      }
    });
    expect(screenshot).toMatchSnapshot('screenshot-offscreen-clip.png');
  });

  it('should throw on clip outside the viewport', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshotError = await page.screenshot({
      clip: {
        x: 50,
        y: 650,
        width: 100,
        height: 100
      }
    }).catch(error => error);
    expect(screenshotError.message).toContain('Clipped area is either empty or outside the resulting image');
  });

  it('should run in parallel', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const promises = [];
    for (let i = 0; i < 3; ++i) {
      promises.push(page.screenshot({
        clip: {
          x: 50 * i,
          y: 0,
          width: 50,
          height: 50
        }
      }));
    }
    const screenshots = await Promise.all(promises);
    expect(screenshots[1]).toMatchSnapshot('grid-cell-1.png');
  });

  it('should take fullPage screenshots', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      fullPage: true
    });
    expect(screenshot).toMatchSnapshot('screenshot-grid-fullpage.png');
  });

  it('should restore viewport after fullPage screenshot', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeInstanceOf(Buffer);
    await verifyViewport(page, 500, 500);
  });

  it('should allow transparency', async ({page, browserName}) => {
    it.fail(browserName === 'firefox');

    await page.setViewportSize({ width: 50, height: 150 });
    await page.setContent(`
      <style>
        body { margin: 0 }
        div { width: 50px; height: 50px; }
      </style>
      <div style="background:black"></div>
      <div style="background:white"></div>
      <div style="background:transparent"></div>
    `);
    const screenshot = await page.screenshot({omitBackground: true});
    expect(screenshot).toMatchSnapshot('transparent.png');
  });

  it('should render white background on jpeg file', async ({page, server, isElectron}) => {
    it.fixme(isElectron, 'omitBackground with jpeg does not work');

    await page.setViewportSize({ width: 100, height: 100 });
    await page.goto(server.EMPTY_PAGE);
    const screenshot = await page.screenshot({omitBackground: true, type: 'jpeg'});
    expect(screenshot).toMatchSnapshot('white.jpg');
  });

  it('should work with odd clip size on Retina displays', async ({page}) => {
    const screenshot = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width: 11,
        height: 11,
      }
    });
    expect(screenshot).toMatchSnapshot('screenshot-clip-odd-size.png');
  });

  it('should work for canvas', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/screenshots/canvas.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-canvas.png', { threshold: 0.4 });
  });

  it('should work for webgl', async ({page, server, browserName}) => {
    it.fixme(browserName === 'firefox' || browserName === 'webkit');

    await page.setViewportSize({width: 640, height: 480});
    await page.goto(server.PREFIX + '/screenshots/webgl.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-webgl.png');
  });

  it('should work for translateZ', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/screenshots/translateZ.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-translateZ.png');
  });

  it('should work while navigating', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/redirectloop1.html');
    for (let i = 0; i < 10; i++) {
      const screenshot = await page.screenshot({ fullPage: true }).catch(e => {
        if (e.message.includes('Cannot take a screenshot while page is navigating'))
          return Buffer.from('');
        throw e;
      });
      expect(screenshot).toBeInstanceOf(Buffer);
    }
  });

  it('should work with iframe in shadow', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid-iframe-in-shadow.html');
    expect(await page.screenshot()).toMatchSnapshot('screenshot-iframe.png');
  });

  it('path option should work', async ({page, server}, testInfo) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const outputPath = testInfo.outputPath('screenshot.png');
    await page.screenshot({path: outputPath});
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('screenshot-sanity.png');
  });

  it('path option should create subdirectories', async ({page, server}, testInfo) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const outputPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'screenshot.png'));
    await page.screenshot({path: outputPath});
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('screenshot-sanity.png');
  });

  it('path option should detect jpeg', async ({page, server, isElectron}, testInfo) => {
    it.fixme(isElectron, 'omitBackground with jpeg does not work');

    await page.setViewportSize({ width: 100, height: 100 });
    await page.goto(server.EMPTY_PAGE);
    const outputPath = testInfo.outputPath('screenshot.jpg');
    const screenshot = await page.screenshot({omitBackground: true, path: outputPath});
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('white.jpg');
    expect(screenshot).toMatchSnapshot('white.jpg');
  });

  it('path option should throw for unsupported mime type', async ({page}) => {
    const error = await page.screenshot({ path: 'file.txt' }).catch(e => e);
    expect(error.message).toContain('path: unsupported mime type "text/plain"');
  });

  it('quality option should throw for png', async ({page}) => {
    const error = await page.screenshot({ quality: 10 }).catch(e => e);
    expect(error.message).toContain('options.quality is unsupported for the png');
  });

  it('zero quality option should throw for png', async ({page}) => {
    const error = await page.screenshot({ quality: 0, type: 'png' }).catch(e => e);
    expect(error.message).toContain('options.quality is unsupported for the png');
  });

  it('should prefer type over extension', async ({page}, testInfo) => {
    const outputPath = testInfo.outputPath('file.png');
    const buffer = await page.screenshot({ path: outputPath, type: 'jpeg' });
    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xFF, 0xD8, 0xFF]);
  });

  it('should not issue resize event', async ({page, server}) => {
    await page.goto(server.PREFIX + '/grid.html');
    let resizeTriggered = false;
    await page.exposeFunction('resize', () => {
      resizeTriggered = true;
    });
    await page.evaluate(() => {
      window.addEventListener('resize', () => (window as any).resize());
    });
    await page.screenshot();
    expect(resizeTriggered).toBeFalsy();
  });
});

browserTest.describe('page screenshot', () => {
  browserTest.beforeEach(async ({ browserName, headful, isAndroid }) => {
    browserTest.skip(browserName === 'firefox' && headful, 'Firefox headful produces a different image.');
    browserTest.skip(isAndroid, 'Different viewport');
  });

  browserTest('should run in parallel in multiple pages', async ({server, contextFactory}) => {
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

  browserTest('should work with a mobile viewport', async ({browser, server, browserName}) => {
    browserTest.skip(browserName === 'firefox');
    browserTest.fixme(browserName === 'chromium');

    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-mobile.png');
    await context.close();
  });

  browserTest('should work with a mobile viewport and clip', async ({browser, server, browserName}) => {
    browserTest.skip(browserName === 'firefox');
    browserTest.skip(process.env.CRPATH); // Does not work in stable Chrome.

    const context = await browser.newContext({viewport: { width: 320, height: 480 }, isMobile: true});
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow.html');
    const screenshot = await page.screenshot({ clip: { x: 10, y: 10, width: 100, height: 150 } });
    expect(screenshot).toMatchSnapshot('screenshot-mobile-clip.png');
    await context.close();
  });

  browserTest('should work with a mobile viewport and fullPage', async ({browser, server, browserName}) => {
    browserTest.skip(browserName === 'firefox');

    const context = await browser.newContext({viewport: { width: 320, height: 480 }, isMobile: true});
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow-large.html');
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchSnapshot('screenshot-mobile-fullpage.png');
    await context.close();
  });


  browserTest('should work with device scale factor', async ({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-device-scale-factor.png');
    await context.close();
  });

  // Large screenshot is slow.
  slowBrowserTest('should work with large size', async ({ browserName, headful, platform, contextFactory }) => {
    slowBrowserTest.fixme(browserName === 'chromium' && headful === true && platform === 'linux', 'Chromium has gpu problems on linux with large screnshots');

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

  it('should take fullPage screenshots during navigation', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const reloadSeveralTimes = async () => {
      for (let i = 0; i < 5; ++i)
        await page.reload();
    };
    const screenshotSeveralTimes = async () => {
      for (let i = 0; i < 5; ++i)
        await page.screenshot({ fullPage: true });
    };
    await Promise.all([
      reloadSeveralTimes(),
      screenshotSeveralTimes()
    ]);
  });
});

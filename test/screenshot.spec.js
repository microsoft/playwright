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

const {WIN, LINUX, MAC, HEADLESS, USES_HOOKS} = utils = require('./utils');
const {FIREFOX, CHROMIUM, WEBKIT} = require('playwright-runner');
const {it} = require('./environments/server');
const {PNG} = require('pngjs');

// Firefox headful produces a different image.
const ffheadful = FIREFOX && !HEADLESS;

describe.skip(ffheadful)('Page.screenshot', function() {
  it('should work', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchGolden('screenshot-sanity.png');
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
    expect(screenshot).toMatchGolden('screenshot-clip-rect.png');
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
    expect(screenshot).toMatchGolden('screenshot-clip-rect.png');
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
    expect(screenshot).toMatchGolden('screenshot-offscreen-clip.png');
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
    expect(screenshots[1]).toMatchGolden('grid-cell-1.png');
  });
  it('should take fullPage screenshots', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({
      fullPage: true
    });
    expect(screenshot).toMatchGolden('screenshot-grid-fullpage.png');
  });
  it('should restore viewport after fullPage screenshot', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeInstanceOf(Buffer);
    await utils.verifyViewport(page, 500, 500);
  });
  it('should run in parallel in multiple pages', async ({page, server, context}) => {
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
      expect(screenshots[i]).toMatchGolden(`grid-cell-${i % 2}.png`);
    await Promise.all(pages.map(page => page.close()));
  });
  it.todo(FIREFOX)('should allow transparency', async ({page}) => {
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
    expect(screenshot).toMatchGolden('transparent.png');
  });
  it('should render white background on jpeg file', async ({page, server}) => {
    await page.setViewportSize({ width: 100, height: 100 });
    await page.goto(server.EMPTY_PAGE);
    const screenshot = await page.screenshot({omitBackground: true, type: 'jpeg'});
    expect(screenshot).toMatchGolden('white.jpg');
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
    expect(screenshot).toMatchGolden('screenshot-clip-odd-size.png');
  });
  it.skip(FIREFOX)('should work with a mobile viewport', async ({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, isMobile: true });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchGolden('screenshot-mobile.png');
    await context.close();
  });
  it.skip(FIREFOX)('should work with a mobile viewport and clip', async ({browser, server}) => {
    const context = await browser.newContext({viewport: { width: 320, height: 480 }, isMobile: true});
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow.html');
    const screenshot = await page.screenshot({ clip: { x: 10, y: 10, width: 100, height: 150 } });
    expect(screenshot).toMatchGolden('screenshot-mobile-clip.png');
    await context.close();
  });
  it.skip(FIREFOX)('should work with a mobile viewport and fullPage', async ({browser, server}) => {
    const context = await browser.newContext({viewport: { width: 320, height: 480 }, isMobile: true});
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/overflow-large.html');
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchGolden('screenshot-mobile-fullpage.png');
    await context.close();
  });
  it('should work for canvas', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/screenshots/canvas.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchGolden('screenshot-canvas.png');
  });
  it('should work for translateZ', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/screenshots/translateZ.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchGolden('screenshot-translateZ.png');
  });
  it.todo(FIREFOX || WEBKIT)('should work for webgl', async ({page, server}) => {
    await page.setViewportSize({width: 640, height: 480});
    await page.goto(server.PREFIX + '/screenshots/webgl.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchGolden('screenshot-webgl.png');
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
  it('should work with device scale factor', async ({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const screenshot = await page.screenshot();
    expect(screenshot).toMatchGolden('screenshot-device-scale-factor.png');
    await context.close();
  });
  it('should work with iframe in shadow', async ({browser, page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid-iframe-in-shadow.html');
    expect(await page.screenshot()).toMatchGolden('screenshot-iframe.png');
  });
});

describe.skip(ffheadful)('ElementHandle.screenshot', function() {
  it('should work', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-bounding-box.png');
  });
  it('should take into account padding and border', async ({page}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.setContent(`
      <div style="height: 14px">oooo</div>
      <style>div {
        border: 2px solid blue;
        background: green;
        width: 50px;
        height: 50px;
      }
      </style>
      <div id="d"></div>
    `);
    const elementHandle = await page.$('div#d');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-padding-border.png');
  });
  it('should capture full element when larger than viewport in parallel', async ({page}) => {
    await page.setViewportSize({width: 500, height: 500});

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
    const elementHandles = await page.$$('div.to-screenshot');
    const promises = elementHandles.map(handle => handle.screenshot());
    const screenshots = await Promise.all(promises);
    expect(screenshots[2]).toMatchGolden('screenshot-element-larger-than-viewport.png');

    await utils.verifyViewport(page, 500, 500);
  });
  it('should capture full element when larger than viewport', async ({page}) => {
    await page.setViewportSize({width: 500, height: 500});

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
    const elementHandle = await page.$('div.to-screenshot');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-larger-than-viewport.png');

    await utils.verifyViewport(page, 500, 500);
  });
  it('should scroll element into view', async ({page}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.setContent(`
      <div style="height: 14px">oooo</div>
      <style>div.above {
        border: 2px solid blue;
        background: red;
        height: 1500px;
      }
      div.to-screenshot {
        border: 2px solid blue;
        background: green;
        width: 50px;
        height: 50px;
      }
      </style>
      <div class="above"></div>
      <div class="to-screenshot"></div>
    `);
    const elementHandle = await page.$('div.to-screenshot');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-scrolled-into-view.png');
  });
  it('should scroll 15000px into view', async ({page}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.setContent(`
      <div style="height: 14px">oooo</div>
      <style>div.above {
        border: 2px solid blue;
        background: red;
        height: 15000px;
      }
      div.to-screenshot {
        border: 2px solid blue;
        background: green;
        width: 50px;
        height: 50px;
      }
      </style>
      <div class="above"></div>
      <div class="to-screenshot"></div>
    `);
    const elementHandle = await page.$('div.to-screenshot');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-scrolled-into-view.png');
  });
  it('should work with a rotated element', async ({page}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.setContent(`<div style="position:absolute;
                                      top: 100px;
                                      left: 100px;
                                      width: 100px;
                                      height: 100px;
                                      background: green;
                                      transform: rotateZ(200deg);">&nbsp;</div>`);
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-rotate.png');
  });
  it('should fail to screenshot a detached element', async ({page, server}) => {
    await page.setContent('<h1>remove this</h1>');
    const elementHandle = await page.$('h1');
    await page.evaluate(element => element.remove(), elementHandle);
    const screenshotError = await elementHandle.screenshot().catch(error => error);
    expect(screenshotError.message).toContain('Element is not attached to the DOM');
  });
  it('should timeout waiting for visible', async ({page, server}) => {
    await page.setContent('<div style="width: 50px; height: 0"></div>');
    const div = await page.$('div');
    const error = await div.screenshot({ timeout: 3000 }).catch(e => e);
    expect(error.message).toContain('Timeout 3000ms exceeded during elementHandle.screenshot');
    expect(error.message).toContain('element is not visible');
  });
  it('should wait for visible', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    await elementHandle.evaluate(e => e.style.visibility = 'hidden');
    let done = false;
    const promise = elementHandle.screenshot().then(buffer => {
      done = true;
      return buffer;
    });
    for (let i = 0; i < 10; i++)
      await page.evaluate(() => new Promise(f => requestAnimationFrame(f)));
    expect(done).toBe(false);
    await elementHandle.evaluate(e => e.style.visibility = 'visible');
    const screenshot = await promise;
    expect(screenshot).toMatchGolden('screenshot-element-bounding-box.png');
  });
  it('should work for an element with fractional dimensions', async ({page}) => {
    await page.setContent('<div style="width:48.51px;height:19.8px;border:1px solid black;"></div>');
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-fractional.png');
  });
  it.skip(FIREFOX)('should work with a mobile viewport', async ({browser, server}) => {
    const context = await browser.newContext({viewport: { width: 320, height: 480, isMobile: true }});
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-mobile.png');
    await context.close();
  });
  it.skip(FIREFOX)('should work with device scale factor', async ({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-mobile-dsf.png');
    await context.close();
  });
  it('should work for an element with an offset', async ({page}) => {
    await page.setContent('<div style="position:absolute; top: 10.3px; left: 20.4px;width:50.3px;height:20.2px;border:1px solid black;"></div>');
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchGolden('screenshot-element-fractional-offset.png');
  });
  it('should take screenshots when default viewport is null', async ({server, browser}) => {
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
  it('should take fullPage screenshots when default viewport is null', async ({server, browser}) => {
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
  it('should restore default viewport after fullPage screenshot', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 456, height: 789 } });
    const page = await context.newPage();
    await utils.verifyViewport(page, 456, 789);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeInstanceOf(Buffer);
    await utils.verifyViewport(page, 456, 789);
    await context.close();
  });
  it.skip(USES_HOOKS)('should restore viewport after page screenshot and exception', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const __testHookBeforeScreenshot = () => { throw new Error('oh my'); };
    const error = await page.screenshot({ fullPage: true, __testHookBeforeScreenshot }).catch(e => e);
    expect(error.message).toContain('oh my');
    await utils.verifyViewport(page, 350, 360);
    await context.close();
  });
  it.skip(USES_HOOKS)('should restore viewport after page screenshot and timeout', async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const __testHookAfterScreenshot = () => new Promise(f => setTimeout(f, 5000));
    const error = await page.screenshot({ fullPage: true, __testHookAfterScreenshot, timeout: 3000 }).catch(e => e);
    expect(error.message).toContain('Timeout 3000ms exceeded during page.screenshot');
    await utils.verifyViewport(page, 350, 360);
    await page.setViewportSize({ width: 400, height: 400 });
    await page.waitForTimeout(3000); // Give it some time to wrongly restore previous viewport.
    await utils.verifyViewport(page, 400, 400);
    await context.close();
  });
  it('should take element screenshot when default viewport is null and restore back', async ({server, browser}) => {
    const context = await browser.newContext({viewport: null});
    const page = await context.newPage({ viewport: null });
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
  it.skip(USES_HOOKS)('should restore viewport after element screenshot and exception', async ({server, browser}) => {
    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.setContent(`<div style="width:600px;height:600px;"></div>`);
    const elementHandle = await page.$('div');
    const __testHookBeforeScreenshot = () => { throw new Error('oh my'); };
    const error = await elementHandle.screenshot({ __testHookBeforeScreenshot }).catch(e => e);
    expect(error.message).toContain('oh my');
    await utils.verifyViewport(page, 350, 360);
    await context.close();
  });
});

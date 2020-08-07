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
require('./base.fixture');

const utils = require('./utils');
const {FFOX, CHROMIUM, WEBKIT, USES_HOOKS, HEADLESS} = testOptions;
const {PNG} = require('pngjs');

// Firefox headful produces a different image.
const ffheadful = FFOX && !HEADLESS;

it.skip(ffheadful)('should work', async({page, server}) => {
  await page.setViewportSize({width: 500, height: 500});
  await page.goto(server.PREFIX + '/grid.html');
  await page.evaluate(() => window.scrollBy(50, 100));
  const elementHandle = await page.$('.box:nth-of-type(3)');
  const screenshot = await elementHandle.screenshot();
  expect(screenshot).toBeGolden('screenshot-element-bounding-box.png');
});

it.skip(ffheadful)('should take into account padding and border', async({page}) => {
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
  expect(screenshot).toBeGolden('screenshot-element-padding-border.png');
});

it.skip(ffheadful)('should capture full element when larger than viewport in parallel', async({page}) => {
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
  expect(screenshots[2]).toBeGolden('screenshot-element-larger-than-viewport.png');

  await utils.verifyViewport(page, 500, 500);
});

it.skip(ffheadful)('should capture full element when larger than viewport', async({page}) => {
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
  expect(screenshot).toBeGolden('screenshot-element-larger-than-viewport.png');

  await utils.verifyViewport(page, 500, 500);
});

it.skip(ffheadful)('should scroll element into view', async({page}) => {
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
  expect(screenshot).toBeGolden('screenshot-element-scrolled-into-view.png');
});

it.skip(ffheadful)('should scroll 15000px into view', async({page}) => {
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
  expect(screenshot).toBeGolden('screenshot-element-scrolled-into-view.png');
});

it.skip(ffheadful)('should work with a rotated element', async({page}) => {
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
  expect(screenshot).toBeGolden('screenshot-element-rotate.png');
});

it.skip(ffheadful)('should fail to screenshot a detached element', async({page, server}) => {
  await page.setContent('<h1>remove this</h1>');
  const elementHandle = await page.$('h1');
  await page.evaluate(element => element.remove(), elementHandle);
  const screenshotError = await elementHandle.screenshot().catch(error => error);
  expect(screenshotError.message).toContain('Element is not attached to the DOM');
});

it.skip(ffheadful)('should timeout waiting for visible', async({page, server}) => {
  await page.setContent('<div style="width: 50px; height: 0"></div>');
  const div = await page.$('div');
  const error = await div.screenshot({ timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('elementHandle.screenshot: Timeout 3000ms exceeded');
  expect(error.message).toContain('element is not visible');
});

it.skip(ffheadful)('should wait for visible', async({page, server}) => {
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
  expect(screenshot).toBeGolden('screenshot-element-bounding-box.png');
});

it.skip(ffheadful)('should work for an element with fractional dimensions', async({page}) => {
  await page.setContent('<div style="width:48.51px;height:19.8px;border:1px solid black;"></div>');
  const elementHandle = await page.$('div');
  const screenshot = await elementHandle.screenshot();
  expect(screenshot).toBeGolden('screenshot-element-fractional.png');
});

it.skip(FFOX)('should work with a mobile viewport', async({browser, server}) => {
  const context = await browser.newContext({viewport: { width: 320, height: 480, isMobile: true }});
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/grid.html');
  await page.evaluate(() => window.scrollBy(50, 100));
  const elementHandle = await page.$('.box:nth-of-type(3)');
  const screenshot = await elementHandle.screenshot();
  expect(screenshot).toBeGolden('screenshot-element-mobile.png');
  await context.close();
});

it.skip(FFOX)('should work with device scale factor', async({browser, server}) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/grid.html');
  await page.evaluate(() => window.scrollBy(50, 100));
  const elementHandle = await page.$('.box:nth-of-type(3)');
  const screenshot = await elementHandle.screenshot();
  expect(screenshot).toBeGolden('screenshot-element-mobile-dsf.png');
  await context.close();
});

it.skip(ffheadful)('should work for an element with an offset', async({page}) => {
  await page.setContent('<div style="position:absolute; top: 10.3px; left: 20.4px;width:50.3px;height:20.2px;border:1px solid black;"></div>');
  const elementHandle = await page.$('div');
  const screenshot = await elementHandle.screenshot();
  expect(screenshot).toBeGolden('screenshot-element-fractional-offset.png');
});

it.skip(ffheadful)('should take screenshots when default viewport is null', async({server, browser}) => {
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

it.skip(ffheadful)('should take fullPage screenshots when default viewport is null', async({server, browser}) => {
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

it.skip(ffheadful)('should restore default viewport after fullPage screenshot', async({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 456, height: 789 } });
  const page = await context.newPage();
  await utils.verifyViewport(page, 456, 789);
  const screenshot = await page.screenshot({ fullPage: true });
  expect(screenshot).toBeInstanceOf(Buffer);
  await utils.verifyViewport(page, 456, 789);
  await context.close();
});

it.skip(ffheadful || USES_HOOKS)('should restore viewport after page screenshot and exception', async({ browser, server }) => {
  const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/grid.html');
  const __testHookBeforeScreenshot = () => { throw new Error('oh my') };
  const error = await page.screenshot({ fullPage: true, __testHookBeforeScreenshot }).catch(e => e);
  expect(error.message).toContain('oh my');
  await utils.verifyViewport(page, 350, 360);
  await context.close();
});

it.skip(ffheadful || USES_HOOKS)('should restore viewport after page screenshot and timeout', async({ browser, server }) => {
  const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/grid.html');
  const __testHookAfterScreenshot = () => new Promise(f => setTimeout(f, 5000));
  const error = await page.screenshot({ fullPage: true, __testHookAfterScreenshot, timeout: 3000 }).catch(e => e);
  expect(error.message).toContain('page.screenshot: Timeout 3000ms exceeded');
  await utils.verifyViewport(page, 350, 360);
  await page.setViewportSize({ width: 400, height: 400 });
  await page.waitForTimeout(3000); // Give it some time to wrongly restore previous viewport.
  await utils.verifyViewport(page, 400, 400);
  await context.close();
});

it.skip(ffheadful)('should take element screenshot when default viewport is null and restore back', async({server, browser}) => {
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

it.skip(ffheadful || USES_HOOKS)('should restore viewport after element screenshot and exception', async({server, browser}) => {
  const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
  const page = await context.newPage();
  await page.setContent(`<div style="width:600px;height:600px;"></div>`);
  const elementHandle = await page.$('div');
  const __testHookBeforeScreenshot = () => { throw new Error('oh my') };
  const error = await elementHandle.screenshot({ __testHookBeforeScreenshot }).catch(e => e);
  expect(error.message).toContain('oh my');
  await utils.verifyViewport(page, 350, 360);
  await context.close();
});

it.skip(ffheadful)('should wait for element to stop moving', async({page, server}) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/grid.html');
  const elementHandle = await page.$('.box:nth-of-type(3)');
  await elementHandle.evaluate(e => {
    e.classList.add('animation');
    return new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
  });
  const screenshot = await elementHandle.screenshot();
  expect(screenshot).toBeGolden('screenshot-element-bounding-box.png');
});

it.skip(ffheadful)('should take screenshot of disabled button', async({page}) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.setContent(`<button disabled>Click me</button>`);
  const button = await page.$('button');
  const screenshot = await button.screenshot();
  expect(screenshot).toBeInstanceOf(Buffer);
});

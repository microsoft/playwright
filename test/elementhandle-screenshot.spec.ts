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

import { it, expect, describe } from './fixtures';
import { verifyViewport } from './utils';

import {PNG} from 'pngjs';
import path from 'path';
import fs from 'fs';

describe('element screenshot', (suite, parameters) => {
  suite.skip(parameters.browserName === 'firefox' && parameters.headful);
}, () => {
  it('should work', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
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
    expect(screenshot).toMatchSnapshot('screenshot-element-padding-border.png');
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
    expect(screenshots[2]).toMatchSnapshot('screenshot-element-larger-than-viewport.png');

    await verifyViewport(page, 500, 500);
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
    expect(screenshot).toMatchSnapshot('screenshot-element-larger-than-viewport.png');

    await verifyViewport(page, 500, 500);
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
    expect(screenshot).toMatchSnapshot('screenshot-element-scrolled-into-view.png');
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
    expect(screenshot).toMatchSnapshot('screenshot-element-scrolled-into-view.png');
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
    expect(screenshot).toMatchSnapshot('screenshot-element-rotate.png');
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
    expect(error.message).toContain('elementHandle.screenshot: Timeout 3000ms exceeded');
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
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should work for an element with fractional dimensions', async ({page}) => {
    await page.setContent('<div style="width:48.51px;height:19.8px;border:1px solid black;"></div>');
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-fractional.png');
  });

  it('should work with a mobile viewport', (test, { browserName }) => {
    test.skip(browserName === 'firefox');
  }, async ({browser, server}) => {
    const context = await browser.newContext({viewport: { width: 320, height: 480 }, isMobile: true});
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-mobile.png');
    await context.close();
  });

  it('should work with device scale factor', (test, { browserName }) => {
    test.skip(browserName === 'firefox');
  }, async ({browser, server}) => {
    const context = await browser.newContext({ viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-mobile-dsf.png');
    await context.close();
  });

  it('should work for an element with an offset', async ({page}) => {
    await page.setContent('<div style="position:absolute; top: 10.3px; left: 20.4px;width:50.3px;height:20.2px;border:1px solid black;"></div>');
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-fractional-offset.png');
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
    await verifyViewport(page, 456, 789);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toBeInstanceOf(Buffer);
    await verifyViewport(page, 456, 789);
    await context.close();
  });

  it('should restore viewport after page screenshot and exception', (test, { wire }) => {
    test.skip(wire);
  }, async ({ browser, server }) => {
    const context = await browser.newContext({ viewport: { width: 350, height: 360 } });
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/grid.html');
    const __testHookBeforeScreenshot = () => { throw new Error('oh my'); };
    const error = await page.screenshot({ fullPage: true, __testHookBeforeScreenshot } as any).catch(e => e);
    expect(error.message).toContain('oh my');
    await verifyViewport(page, 350, 360);
    await context.close();
  });

  it('should restore viewport after page screenshot and timeout', (test, { wire }) => {
    test.skip(wire);
  }, async ({ browser, server }) => {
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

  it('should take element screenshot when default viewport is null and restore back', async ({server, browser}) => {
    const context = await browser.newContext({viewport: null});
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

  it('should restore viewport after element screenshot and exception', (test, { wire }) => {
    test.skip(wire);
  }, async ({browser}) => {
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

  it('should wait for element to stop moving', (test, { browserName, headful, platform }) => {
    test.flaky(browserName === 'webkit' && headful && platform === 'linux');
  }, async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const elementHandle = await page.$('.box:nth-of-type(3)');
    await elementHandle.evaluate(e => {
      e.classList.add('animation');
      return new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
    });
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should take screenshot of disabled button', async ({page}) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.setContent(`<button disabled>Click me</button>`);
    const button = await page.$('button');
    const screenshot = await button.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
  });

  it('path option should create subdirectories', async ({page, server, testInfo}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const outputPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'screenshot.png'));
    await elementHandle.screenshot({path: outputPath});
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('screenshot-element-bounding-box.png');
  });
});

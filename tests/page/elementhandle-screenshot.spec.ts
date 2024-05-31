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

import { test as it, expect, rafraf } from './pageTest';
import { verifyViewport } from '../config/utils';
import path from 'path';
import fs from 'fs';

it.describe('element screenshot', () => {
  it.skip(({ browserName, headless }) => browserName === 'firefox' && !headless);
  it.skip(({ isAndroid }) => isAndroid, 'Different dpr. Remove after using 1x scale for screenshots.');

  it('should work', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should work when main world busts JSON.stringify', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => {
      window.scrollBy(50, 100);
      JSON.stringify = () => undefined;
    });
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should take into account padding and border', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 500 });
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

  it('should capture full element when larger than viewport in parallel', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 500, height: 500 });

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

  it('should capture full element when larger than viewport', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 500 });

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

  it('should scroll element into view', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 500 });
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

  it('should scroll 15000px into view', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 500 });
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

  it('should work with a rotated element', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 500 });
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

  it('should fail to screenshot a detached element', async ({ page, server }) => {
    await page.setContent('<h1>remove this</h1>');
    const elementHandle = await page.$('h1');
    await page.evaluate(element => element.remove(), elementHandle);
    const screenshotError = await elementHandle.screenshot().catch(error => error);
    expect(screenshotError.message).toContain('Element is not attached to the DOM');
  });

  it('should timeout waiting for visible', async ({ page, server }) => {
    await page.setContent('<div style="width: 50px; height: 0"></div>');
    const div = await page.$('div');
    const error = await div.screenshot({ timeout: 3000 }).catch(e => e);
    expect(error.message).toContain('elementHandle.screenshot: Timeout 3000ms exceeded');
    expect(error.message).toContain('element is not visible');
  });

  it('should wait for visible', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    await elementHandle.evaluate(e => e.style.visibility = 'hidden');
    let done = false;
    const promise = elementHandle.screenshot().then(buffer => {
      done = true;
      return buffer;
    });
    await rafraf(page, 10);
    expect(done).toBe(false);
    await elementHandle.evaluate(e => e.style.visibility = 'visible');
    const screenshot = await promise;
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should work for an element with fractional dimensions', async ({ page }) => {
    await page.setContent('<div style="width:48.51px;height:19.8px;border:1px solid black;"></div>');
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-fractional.png');
  });

  it('should work for an element with an offset', async ({ page }) => {
    await page.setContent('<div style="position:absolute; top: 10.3px; left: 20.4px;width:50.3px;height:20.2px;border:1px solid black;"></div>');
    const elementHandle = await page.$('div');
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-fractional-offset.png');
  });

  it('should wait for element to stop moving', async ({ page, server }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    const elementHandle = await page.$('.box:nth-of-type(3)');
    await elementHandle.evaluate(e => e.classList.add('animation'));
    await rafraf(page);
    const screenshot = await elementHandle.screenshot();
    expect(screenshot).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should take screenshot of disabled button', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.setContent(`<button disabled>Click me</button>`);
    const button = await page.$('button');
    const screenshot = await button.screenshot();
    expect(screenshot).toBeInstanceOf(Buffer);
  });

  it('path option should create subdirectories', async ({ page, server }, testInfo) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const outputPath = testInfo.outputPath(path.join('these', 'are', 'directories', 'screenshot.png'));
    await elementHandle.screenshot({ path: outputPath });
    expect(await fs.promises.readFile(outputPath)).toMatchSnapshot('screenshot-element-bounding-box.png');
  });

  it('should prefer type over extension', async ({ page, server }, testInfo) => {
    await page.setViewportSize({ width: 500, height: 500 });
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => window.scrollBy(50, 100));
    const elementHandle = await page.$('.box:nth-of-type(3)');
    const outputPath = testInfo.outputPath('file.png');
    const buffer = await elementHandle.screenshot({ path: outputPath, type: 'jpeg' });
    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xFF, 0xD8, 0xFF]);
  });

  it('should not issue resize event', async ({ page, server }) => {
    await page.goto(server.PREFIX + '/grid.html');
    let resizeTriggered = false;
    await page.exposeFunction('resize', () => {
      resizeTriggered = true;
    });
    await page.evaluate(() => {
      window.addEventListener('resize', () => (window as any).resize());
    });
    const elementHandle = await page.$('.box:nth-of-type(3)');
    await elementHandle.screenshot();
    expect(resizeTriggered).toBeFalsy();
  });
});

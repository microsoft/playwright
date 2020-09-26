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

import { it, expect } from './fixtures';


it('should work', (test, { browserName, headful }) => {
  test.fail(browserName === 'firefox' && headful);
}, async ({ page, server }) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/grid.html');
  const elementHandle = await page.$('.box:nth-of-type(13)');
  const box = await elementHandle.boundingBox();
  expect(box).toEqual({ x: 100, y: 50, width: 50, height: 50 });
});

it('should handle nested frames', async ({ page, server }) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.goto(server.PREFIX + '/frames/nested-frames.html');
  const nestedFrame = page.frames().find(frame => frame.name() === 'dos');
  const elementHandle = await nestedFrame.$('div');
  const box = await elementHandle.boundingBox();
  expect(box).toEqual({ x: 24, y: 224, width: 268, height: 18 });
});

it('should return null for invisible elements', async ({ page, server }) => {
  await page.setContent('<div style="display:none">hi</div>');
  const element = await page.$('div');
  expect(await element.boundingBox()).toBe(null);
});

it('should force a layout', async ({ page, server }) => {
  await page.setViewportSize({ width: 500, height: 500 });
  await page.setContent('<div style="width: 100px; height: 100px">hello</div>');
  const elementHandle = await page.$('div');
  await page.evaluate(element => element.style.height = '200px', elementHandle);
  const box = await elementHandle.boundingBox();
  expect(box).toEqual({ x: 8, y: 8, width: 100, height: 200 });
});

it('should work with SVG nodes', async ({ page, server }) => {
  await page.setContent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
        <rect id="theRect" x="30" y="50" width="200" height="300"></rect>
      </svg>
    `);
  const element = await page.$('#therect');
  const pwBoundingBox = await element.boundingBox();
  const webBoundingBox = await page.evaluate(e => {
    const rect = e.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }, element);
  expect(pwBoundingBox).toEqual(webBoundingBox);
});

it('should work with page scale', (test, { browserName }) => {
  test.skip(browserName === 'firefox');
}, async ({ browser, server }) => {
  const context = await browser.newContext({ viewport: { width: 400, height: 400 }, isMobile: true });
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/input/button.html');
  const button = await page.$('button');
  await button.evaluate(button => {
    document.body.style.margin = '0';
    button.style.borderWidth = '0';
    button.style.width = '200px';
    button.style.height = '20px';
    button.style.marginLeft = '17px';
    button.style.marginTop = '23px';
  });
  const box = await button.boundingBox();
  expect(Math.round(box.x * 100)).toBe(17 * 100);
  expect(Math.round(box.y * 100)).toBe(23 * 100);
  expect(Math.round(box.width * 100)).toBe(200 * 100);
  expect(Math.round(box.height * 100)).toBe(20 * 100);
  await context.close();
});

it('should work when inline box child is outside of viewport', async ({ page, server }) => {
  await page.setContent(`
      <style>
      i {
        position: absolute;
        top: -1000px;
      }
      body {
        margin: 0;
        font-size: 12px;
      }
      </style>
      <span><i>woof</i><b>doggo</b></span>
    `);
  const handle = await page.$('span');
  const box = await handle.boundingBox();
  const webBoundingBox = await handle.evaluate(e => {
    const rect = e.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const round = box => ({
    x: Math.round(box.x * 100),
    y: Math.round(box.y * 100),
    width: Math.round(box.width * 100),
    height: Math.round(box.height * 100),
  });
  expect(round(box)).toEqual(round(webBoundingBox));
});

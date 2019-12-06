/**
 * Copyright 2018 Google Inc. All rights reserved.
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

const utils = require('./utils');

module.exports.addTests = function({testRunner, expect, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('ElementHandle.boundingBox', function() {
    it('should work', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const elementHandle = await page.$('.box:nth-of-type(13)');
      const box = await elementHandle.boundingBox();
      expect(box).toEqual({ x: 100, y: 50, width: 50, height: 50 });
    });
    it('should handle nested frames', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/frames/nested-frames.html');
      const nestedFrame = page.frames().find(frame => frame.name() === 'dos');
      const elementHandle = await nestedFrame.$('div');
      const box = await elementHandle.boundingBox();
      expect(box).toEqual({ x: 24, y: 224, width: 268, height: 18 });
    });
    it('should return null for invisible elements', async({page, server}) => {
      await page.setContent('<div style="display:none">hi</div>');
      const element = await page.$('div');
      expect(await element.boundingBox()).toBe(null);
    });
    it('should force a layout', async({page, server}) => {
      await page.setViewport({ width: 500, height: 500 });
      await page.setContent('<div style="width: 100px; height: 100px">hello</div>');
      const elementHandle = await page.$('div');
      await page.evaluate(element => element.style.height = '200px', elementHandle);
      const box = await elementHandle.boundingBox();
      expect(box).toEqual({ x: 8, y: 8, width: 100, height: 200 });
    });
    it('should work with SVG nodes', async({page, server}) => {
      await page.setContent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="500" height="500">
          <rect id="theRect" x="30" y="50" width="200" height="300"></rect>
        </svg>
      `);
      const element = await page.$('#therect');
      const pptrBoundingBox = await element.boundingBox();
      const webBoundingBox = await page.evaluate(e => {
        const rect = e.getBoundingClientRect();
        return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      }, element);
      expect(pptrBoundingBox).toEqual(webBoundingBox);
    });
  });

  describe.skip(WEBKIT)('ElementHandle.contentFrame', function() {
    it('should work', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const elementHandle = await page.$('#frame1');
      const frame = await elementHandle.contentFrame();
      expect(frame).toBe(page.frames()[1]);
    });
  });

  describe('ElementHandle.click', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await button.click();
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should work for Shadow DOM v1', async({page, server}) => {
      await page.goto(server.PREFIX + '/shadow.html');
      const buttonHandle = await page.evaluateHandle(() => button);
      await buttonHandle.click();
      expect(await page.evaluate(() => clicked)).toBe(true);
    });
    it('should work for TextNodes', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const buttonTextNode = await page.evaluateHandle(() => document.querySelector('button').firstChild);
      let error = null;
      await buttonTextNode.click().catch(err => error = err);
      expect(error.message).toBe('Node is not of type HTMLElement');
    });
    it('should throw for detached nodes', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await page.evaluate(button => button.remove(), button);
      let error = null;
      await button.click().catch(err => error = err);
      expect(error.message).toBe('Node is detached from document');
    });
    it('should throw for hidden nodes', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await page.evaluate(button => button.style.display = 'none', button);
      const error = await button.click().catch(err => err);
      expect(error.message).toBe('Node is either not visible or not an HTMLElement');
    });
    it('should throw for recursively hidden nodes', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await page.evaluate(button => button.parentElement.style.display = 'none', button);
      const error = await button.click().catch(err => err);
      expect(error.message).toBe('Node is either not visible or not an HTMLElement');
    });
    it('should throw for <br> elements', async({page, server}) => {
      await page.setContent('hello<br>goodbye');
      const br = await page.$('br');
      const error = await br.click().catch(err => err);
      expect(error.message).toBe('Node is either not visible or not an HTMLElement');
    });
  });

  describe('ElementHandle.hover', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/scrollable.html');
      const button = await page.$('#button-6');
      await button.hover();
      expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
    });
  });

  describe('ElementHandle.isIntersectingViewport', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/offscreenbuttons.html');
      for (let i = 0; i < 11; ++i) {
        const button = await page.$('#btn' + i);
        // All but last button are visible.
        const visible = i < 10;
        expect(await button.isIntersectingViewport()).toBe(visible);
      }
    });
  });
};

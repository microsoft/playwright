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

const utils = require('./utils');

/**
 * @type {PageTestSuite}
 */
module.exports.describe = function({testRunner, expect, FFOX, CHROMIUM, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit, dit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('ElementHandle.boundingBox', function() {
    it('should work', async({page, server}) => {
      await page.setViewportSize({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const elementHandle = await page.$('.box:nth-of-type(13)');
      const box = await elementHandle.boundingBox();
      expect(box).toEqual({ x: 100, y: 50, width: 50, height: 50 });
    });
    it('should handle nested frames', async({page, server}) => {
      await page.setViewportSize({width: 500, height: 500});
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
      await page.setViewportSize({ width: 500, height: 500 });
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
      const pwBoundingBox = await element.boundingBox();
      const webBoundingBox = await page.evaluate(e => {
        const rect = e.getBoundingClientRect();
        return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      }, element);
      expect(pwBoundingBox).toEqual(webBoundingBox);
    });
    it('should work with page scale', async({browser, server}) => {
      const context = await browser.newContext({ viewport: { width: 400, height: 400, isMobile: true} });
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
    it('should work when inline box child is outside of viewport', async({page, server}) => {
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
        return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      });
      const round = box => ({
        x: Math.round(box.x * 100),
        y: Math.round(box.y * 100),
        width: Math.round(box.width * 100),
        height: Math.round(box.height * 100),
      });
      expect(round(box)).toEqual(round(webBoundingBox));
    });
  });

  describe('ElementHandle.contentFrame', function() {
    it('should work', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const elementHandle = await page.$('#frame1');
      const frame = await elementHandle.contentFrame();
      expect(frame).toBe(page.frames()[1]);
    });
    it('should work for cross-process iframes', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
      const elementHandle = await page.$('#frame1');
      const frame = await elementHandle.contentFrame();
      expect(frame).toBe(page.frames()[1]);
    });
    it('should work for cross-frame evaluations', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.frames()[1];
      const elementHandle = await frame.evaluateHandle(() => window.top.document.querySelector('#frame1'));
      expect(await elementHandle.contentFrame()).toBe(frame);
    });
    it('should return null for non-iframes', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.frames()[1];
      const elementHandle = await frame.evaluateHandle(() => document.body);
      expect(await elementHandle.contentFrame()).toBe(null);
    });
    it('should return null for document.documentElement', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.frames()[1];
      const elementHandle = await frame.evaluateHandle(() => document.documentElement);
      expect(await elementHandle.contentFrame()).toBe(null);
    });
  });

  describe('ElementHandle.ownerFrame', function() {
    it('should work', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.frames()[1];
      const elementHandle = await frame.evaluateHandle(() => document.body);
      expect(await elementHandle.ownerFrame()).toBe(frame);
    });
    it('should work for cross-process iframes', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.CROSS_PROCESS_PREFIX + '/empty.html');
      const frame = page.frames()[1];
      const elementHandle = await frame.evaluateHandle(() => document.body);
      expect(await elementHandle.ownerFrame()).toBe(frame);
    });
    it('should work for document', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.frames()[1];
      const elementHandle = await frame.evaluateHandle(() => document);
      expect(await elementHandle.ownerFrame()).toBe(frame);
    });
    it('should work for iframe elements', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.mainFrame();
      const elementHandle = await frame.evaluateHandle(() => document.querySelector('#frame1'));
      expect(await elementHandle.ownerFrame()).toBe(frame);
    });
    it('should work for cross-frame evaluations', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      await utils.attachFrame(page, 'frame1', server.EMPTY_PAGE);
      const frame = page.mainFrame();
      const elementHandle = await frame.evaluateHandle(() => document.querySelector('#frame1').contentWindow.document.body);
      expect(await elementHandle.ownerFrame()).toBe(frame.childFrames()[0]);
    });
    it('should work for detached elements', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      const divHandle = await page.evaluateHandle(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        return div;
      });
      expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
      await page.evaluate(() => {
        const div = document.querySelector('div');
        document.body.removeChild(div);
      });
      expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
    });
    it('should work for adopted elements', async({page,server}) => {
      await page.goto(server.EMPTY_PAGE);
      const [popup] = await Promise.all([
        page.waitForEvent('popup').then(async popup => { await popup.waitForLoadState(); return popup; }),
        page.evaluate(url => window.__popup = window.open(url), server.EMPTY_PAGE),
      ]);
      const divHandle = await page.evaluateHandle(() => {
        const div = document.createElement('div');
        document.body.appendChild(div);
        return div;
      });
      expect(await divHandle.ownerFrame()).toBe(page.mainFrame());
      await page.evaluate(() => {
        const div = document.querySelector('div');
        window.__popup.document.body.appendChild(div);
      });
      expect(await divHandle.ownerFrame()).toBe(popup.mainFrame());
    });
  });

  describe('ElementHandle.click', function() {
    it('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await button.click();
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should work with Node removed', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      await page.evaluate(() => delete window['Node']);
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
      await buttonTextNode.click();
      expect(await page.evaluate(() => result)).toBe('Clicked');
    });
    it('should throw for detached nodes', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/button.html');
      const button = await page.$('button');
      await page.evaluate(button => button.remove(), button);
      let error = null;
      await button.click().catch(err => error = err);
      expect(error.message).toContain('Element is not attached to the DOM');
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
    it('should work when Node is removed', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/scrollable.html');
      await page.evaluate(() => delete window['Node']);
      const button = await page.$('#button-6');
      await button.hover();
      expect(await page.evaluate(() => document.querySelector('button:hover').id)).toBe('button-6');
    });
  });

  describe('ElementHandle.scrollIntoViewIfNeeded', function() {
    it.skip(FFOX)('should work', async({page, server}) => {
      await page.goto(server.PREFIX + '/offscreenbuttons.html');
      for (let i = 0; i < 11; ++i) {
        const button = await page.$('#btn' + i);
        const before = await button.evaluate(button => {
          return button.getBoundingClientRect().right - window.innerWidth;
        });
        expect(before).toBe(10 * i);
        await button.scrollIntoViewIfNeeded();
        const after = await button.evaluate(button => {
          return button.getBoundingClientRect().right - window.innerWidth;
        });
        expect(after <= 0).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    });
  });

  describe('ElementHandle.fill', function() {
    it('should fill input', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      const handle = await page.$('input');
      await handle.fill('some value');
      expect(await page.evaluate(() => result)).toBe('some value');
    });
    it('should fill input when Node is removed', async({page, server}) => {
      await page.goto(server.PREFIX + '/input/textarea.html');
      await page.evaluate(() => delete window['Node']);
      const handle = await page.$('input');
      await handle.fill('some value');
      expect(await page.evaluate(() => result)).toBe('some value');
    });
  });
};

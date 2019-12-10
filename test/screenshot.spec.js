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

module.exports.addTests = function({testRunner, expect, product, FFOX, CHROME, WEBKIT}) {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner;
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Page.screenshot', function() {
    it('should work', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const screenshot = await page.screenshot();
      expect(screenshot).toBeGolden('screenshot-sanity.png');
    });
    it('should clip rect', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const screenshot = await page.screenshot({
        clip: {
          x: 50,
          y: 100,
          width: 150,
          height: 100
        }
      });
      expect(screenshot).toBeGolden('screenshot-clip-rect.png');
    });
    it('should clip elements to the viewport', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const screenshot = await page.screenshot({
        clip: {
          x: 50,
          y: 450,
          width: 1000,
          height: 100
        }
      });
      expect(screenshot).toBeGolden('screenshot-offscreen-clip.png');
    });
    it('should throw on clip outside the viewport', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const screenshotError = await page.screenshot({
        clip: {
          x: 50,
          y: 650,
          width: 100,
          height: 100
        }
      }).catch(error => error);
      expect(screenshotError.message).toBe('Clipped area is either empty or outside the viewport');
    });
    it('should run in parallel', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
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
      expect(screenshots[1]).toBeGolden('grid-cell-1.png');
    });
    it('should take fullPage screenshots', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const screenshot = await page.screenshot({
        fullPage: true
      });
      expect(screenshot).toBeGolden('screenshot-grid-fullpage.png');
    });
    it('should run in parallel in multiple pages', async({page, server, context}) => {
      const N = 2;
      const pages = await Promise.all(Array(N).fill(0).map(async() => {
        const page = await context.newPage();
        await page.goto(server.PREFIX + '/grid.html');
        return page;
      }));
      const promises = [];
      for (let i = 0; i < N; ++i)
        promises.push(pages[i].screenshot({ clip: { x: 50 * i, y: 0, width: 50, height: 50 } }));
      const screenshots = await Promise.all(promises);
      for (let i = 0; i < N; ++i)
        expect(screenshots[i]).toBeGolden(`grid-cell-${i}.png`);
      await Promise.all(pages.map(page => page.close()));
    });
    it.skip(FFOX)('should allow transparency', async({page, server}) => {
      await page.setViewport({ width: 50, height: 150 });
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
      expect(screenshot).toBeGolden('transparent.png');
    });
    it('should render white background on jpeg file', async({page, server}) => {
      await page.setViewport({ width: 100, height: 100 });
      await page.goto(server.EMPTY_PAGE);
      const screenshot = await page.screenshot({omitBackground: true, type: 'jpeg'});
      expect(screenshot).toBeGolden('white.jpg');
    });
    it('should work with odd clip size on Retina displays', async({page, server}) => {
      const screenshot = await page.screenshot({
        clip: {
          x: 0,
          y: 0,
          width: 11,
          height: 11,
        }
      });
      expect(screenshot).toBeGolden('screenshot-clip-odd-size.png');
    });
    it('should return base64', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      const screenshot = await page.screenshot({
        encoding: 'base64'
      });
      expect(Buffer.from(screenshot, 'base64')).toBeGolden('screenshot-sanity.png');
    });
  });

  describe('ElementHandle.screenshot', function() {
    it('should work', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
      await page.goto(server.PREFIX + '/grid.html');
      await page.evaluate(() => window.scrollBy(50, 100));
      const elementHandle = await page.$('.box:nth-of-type(3)');
      const screenshot = await elementHandle.screenshot();
      expect(screenshot).toBeGolden('screenshot-element-bounding-box.png');
    });
    it('should take into account padding and border', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
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
    it('should capture full element when larger than viewport in parallel', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});

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

      expect(await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))).toEqual({ w: 500, h: 500 });
    });
    it('should capture full element when larger than viewport', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});

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

      expect(await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))).toEqual({ w: 500, h: 500 });
    });
    it('should scroll element into view', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
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
    it('should work with a rotated element', async({page, server}) => {
      await page.setViewport({width: 500, height: 500});
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
    it('should fail to screenshot a detached element', async({page, server}) => {
      await page.setContent('<h1>remove this</h1>');
      const elementHandle = await page.$('h1');
      await page.evaluate(element => element.remove(), elementHandle);
      const screenshotError = await elementHandle.screenshot().catch(error => error);
      expect(screenshotError.message).toBe('Node is either not visible or not an HTMLElement');
    });
    it('should not hang with zero width/height element', async({page, server}) => {
      await page.setContent('<div style="width: 50px; height: 0"></div>');
      const div = await page.$('div');
      const error = await div.screenshot().catch(e => e);
      expect(error.message).toBe('Node has 0 height.');
    });
    it('should work for an element with fractional dimensions', async({page}) => {
      await page.setContent('<div style="width:48.51px;height:19.8px;border:1px solid black;"></div>');
      const elementHandle = await page.$('div');
      const screenshot = await elementHandle.screenshot();
      expect(screenshot).toBeGolden('screenshot-element-fractional.png');
    });
    it('should work for an element with an offset', async({page}) => {
      await page.setContent('<div style="position:absolute; top: 10.3px; left: 20.4px;width:50.3px;height:20.2px;border:1px solid black;"></div>');
      const elementHandle = await page.$('div');
      const screenshot = await elementHandle.screenshot();
      expect(screenshot).toBeGolden('screenshot-element-fractional-offset.png');
    });
  });

};

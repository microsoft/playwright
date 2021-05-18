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

import { test as it, expect } from './pageTest';
import { verifyViewport } from '../config/utils';
import path from 'path';
import fs from 'fs';

it.describe('page screenshot', () => {
  it.skip(({ browserName, headless }) => browserName === 'firefox' && !headless, 'Firefox headed produces a different image.');
  it.skip(({ isAndroid }) => isAndroid, 'Different viewport');

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

  it('should work with odd clip size on Retina displays', async ({page, isElectron}) => {
    it.fixme(isElectron, 'Scale is wrong');

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

  it('should work with Array deleted', async ({page, server}) => {
    await page.setViewportSize({width: 500, height: 500});
    await page.goto(server.PREFIX + '/grid.html');
    await page.evaluate(() => delete window.Array);
    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchSnapshot('screenshot-grid-fullpage.png');
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

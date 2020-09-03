/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import { options } from './playwright.fixtures';
import { it, expect, describe, registerFixture } from '@playwright/test-runner';
import type { Page } from '..';

import fs from 'fs';
import path from 'path';
import { TestServer } from '../utils/testserver';
import { _Screencast } from '..';


declare global {
  interface TestState {
    videoPlayer: VideoPlayer;
  }
}

registerFixture('videoPlayer', async ({playwright, context, server}, test) => {
  let chromium;
  if (options.WEBKIT && !LINUX) {
    // WebKit on Mac & Windows cannot replay webm/vp8 video, so we launch chromium.
    chromium = await playwright.chromium.launch();
    context = await chromium.newContext();
  }

  const page = await context.newPage();
  const player = new VideoPlayer(page, server);
  await test(player);
  if (chromium)
    await chromium.close();
  else
    await page.close();
});

function almostRed(r, g, b, alpha) {
  expect(r).toBeGreaterThan(240);
  expect(g).toBeLessThan(50);
  expect(b).toBeLessThan(50);
  expect(alpha).toBe(255);
}

function almostBlack(r, g, b, alpha) {
  expect(r).toBeLessThan(10);
  expect(g).toBeLessThan(10);
  expect(b).toBeLessThan(10);
  expect(alpha).toBe(255);
}

function almostGrey(r, g, b, alpha) {
  expect(r).toBeGreaterThanOrEqual(90);
  expect(g).toBeGreaterThanOrEqual(90);
  expect(b).toBeGreaterThanOrEqual(90);
  expect(r).toBeLessThan(110);
  expect(g).toBeLessThan(110);
  expect(b).toBeLessThan(110);
  expect(alpha).toBe(255);
}

function expectAll(pixels, rgbaPredicate) {
  const checkPixel = i => {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const alpha = pixels[i + 3];
    rgbaPredicate(r, g, b, alpha);
  };
  try {
    for (let i = 0, n = pixels.length; i < n; i += 4)
      checkPixel(i);
  } catch (e) {
    // Log pixel values on failure.
    e.message += `\n\nActual pixels=[${pixels}]`;
    throw e;
  }
}

class VideoPlayer {
  private readonly _page: Page;
  private readonly _server: TestServer;
  constructor(page: Page, server: TestServer) {
    this._page = page;
    this._server = server;
  }

  async load(videoFile: string) {
    const servertPath = '/v.webm';
    this._server.setRoute(servertPath, (req, response) => {
      this._server.serveFile(req, response, videoFile);
    });

    await this._page.goto(this._server.PREFIX + '/player.html');
  }

  async duration() {
    return await this._page.$eval('video', (v: HTMLVideoElement) => v.duration);
  }

  async videoWidth() {
    return await this._page.$eval('video', (v: HTMLVideoElement) => v.videoWidth);
  }

  async videoHeight() {
    return await this._page.$eval('video', (v: HTMLVideoElement) => v.videoHeight);
  }

  async seekFirstNonEmptyFrame() {
    await this._page.evaluate(async () => await (window as any).playToTheEnd());
    while (true) {
      await this._page.evaluate(async () => await (window as any).playOneFrame());
      const ended = await this._page.$eval('video', (video: HTMLVideoElement) => video.ended);
      if (ended)
        throw new Error('All frames are empty');
      const pixels = await this.pixels();
      if (!pixels.every(p => p === 255))
        return;
    }
  }

  async countFrames() {
    return await this._page.evaluate(async () => await (window as any).countFrames());
  }
  async currentTime() {
    return await this._page.$eval('video', (v: HTMLVideoElement) => v.currentTime);
  }
  async playOneFrame() {
    return await this._page.evaluate(async () => await (window as any).playOneFrame());
  }

  async seekLastFrame() {
    const isWPE = LINUX && options.WEBKIT && options.HEADLESS;
    return await this._page.evaluate(async x => await (window as any).seekLastFrame(x), isWPE);
  }

  async pixels(point = {x: 0, y: 0}) {
    const pixels = await this._page.$eval('video', (video: HTMLVideoElement, point) => {
      const canvas = document.createElement('canvas');
      if (!video.videoWidth || !video.videoHeight)
        throw new Error('Video element is empty');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0);
      const imgd = context.getImageData(point.x, point.y, 10, 10);
      return Array.from(imgd.data);
    }, point);
    return pixels;
  }
}

describe('screencast', suite => {
  suite.slow();
  suite.flaky();
  suite.skip(options.WIRE);
}, () => {
  it('should capture static page', test => {
    test.flaky(options.CHROMIUM && LINUX && !options.HEADLESS);
    test.flaky(options.WEBKIT && LINUX);
  }, async ({page, tmpDir, videoPlayer, toImpl}) => {
    const videoFile = path.join(tmpDir, 'v.webm');
    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);

    expect(await videoPlayer.videoWidth()).toBe(320);
    expect(await videoPlayer.videoHeight()).toBe(240);

    await videoPlayer.seekLastFrame();
    const pixels = await videoPlayer.pixels();
    expectAll(pixels, almostRed);
  });

  it('should capture navigation', test => {
    test.flaky(options.CHROMIUM && MAC);
    test.flaky(options.FIREFOX);
    test.flaky(options.WEBKIT);
  }, async ({page, tmpDir, server, videoPlayer, toImpl}) => {
    const videoFile = path.join(tmpDir, 'v.webm');
    await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    await new Promise(r => setTimeout(r, 1000));
    await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);

    {
      await videoPlayer.seekFirstNonEmptyFrame();
      const pixels = await videoPlayer.pixels();
      expectAll(pixels, almostBlack);
    }

    {
      await videoPlayer.seekLastFrame();
      const pixels = await videoPlayer.pixels();
      expectAll(pixels, almostGrey);
    }
  });

  it('should capture css transformation', test => {
    test.fixme(options.WEBKIT && WIN, 'Accelerated compositing is disabled in WebKit on Windows.');
    test.flaky(options.WEBKIT && LINUX);
  }, async ({page, tmpDir, server, videoPlayer, toImpl}) => {
    const videoFile = path.join(tmpDir, 'v.webm');
    // Set viewport equal to screencast frame size to avoid scaling.
    await page.setViewportSize({width: 320, height: 240});
    await page.goto(server.PREFIX + '/rotate-z.html');
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);

    {
      await videoPlayer.seekLastFrame();
      const pixels = await videoPlayer.pixels({x: 95, y: 45});
      expectAll(pixels, almostRed);
    }
  });

  it('should automatically start/finish when new page is created/closed', test => {
    test.flaky(options.FIREFOX, 'Even slow is not slow enough');
  }, async ({browser, tmpDir}) => {
    const context = await browser.newContext();
    let screencastCallback;
    await context._enableScreencast({width: 320, height: 240, dir: tmpDir}, s => {
      screencastCallback(s);
    });

    const [screencast, newPage] = await Promise.all([
      new Promise<_Screencast>(r => screencastCallback = r),
      context.newPage(),
    ]);
    expect(screencast.page() === newPage).toBe(true);

    const [videoFile] = await Promise.all([
      screencast.path(),
      newPage.close(),
    ]);
    expect(path.dirname(videoFile)).toBe(tmpDir);
    await context.close();
  });

  it('should finish when contex closes', async ({browser, tmpDir}) => {
    const context = await browser.newContext();
    let screencastCallback;
    await context._enableScreencast({width: 320, height: 240, dir: tmpDir}, s => {
      screencastCallback(s);
    });

    const [screencast, newPage] = await Promise.all([
      new Promise<_Screencast>(r => screencastCallback = r),
      context.newPage(),
    ]);
    expect(screencast.page() === newPage).toBe(true);

    const [videoFile] = await Promise.all([
      screencast.path(),
      context.close(),
    ]);
    expect(path.dirname(videoFile)).toBe(tmpDir);
  });

  it('should fire start event for popups', async ({browser, tmpDir, server}) => {
    const context = await browser.newContext();
    let screencastCallback;
    await context._enableScreencast({width: 320, height: 240, dir: tmpDir}, s => {
      screencastCallback(s);
    });

    const [page] = await Promise.all([
      context.newPage(),
      new Promise<_Screencast>(r => screencastCallback = r),
    ]);
    await page.mainFrame().goto(server.EMPTY_PAGE);

    const [screencast, popup] = await Promise.all([
      new Promise<_Screencast>(r => screencastCallback = r),
      new Promise<Page>(resolve => context.on('page', resolve)),
      page.evaluate(() => {
        const win = window.open('about:blank');
        win.close();
      }, true)
    ]);
    expect(screencast.page() === popup).toBe(true);
    expect(path.dirname(await screencast.path())).toBe(tmpDir);
    await context.close();
  });

  it('should scale frames down to the requested size ', async ({page, videoPlayer, tmpDir, server, toImpl}) => {
    await page.setViewportSize({width: 640, height: 480});
    const videoFile = path.join(tmpDir, 'v.webm');
    await page.goto(server.PREFIX + '/checkerboard.html');
    // Set size to 1/2 of the viewport.
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    // Update the picture to ensure enough frames are generated.
    await page.$eval('.container', container => {
      container.firstElementChild.classList.remove('red');
    });
    await new Promise(r => setTimeout(r, 300));
    await page.$eval('.container', container => {
      container.firstElementChild.classList.add('red');
    });
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);

    await videoPlayer.seekLastFrame();
    {
      const pixels = await videoPlayer.pixels({x: 0, y: 0});
      expectAll(pixels, almostRed);
    }
    {
      const pixels = await videoPlayer.pixels({x: 300, y: 0});
      expectAll(pixels, almostGrey);
    }
    {
      const pixels = await videoPlayer.pixels({x: 0, y: 200});
      expectAll(pixels, almostGrey);
    }
    {
      const pixels = await videoPlayer.pixels({x: 300, y: 200});
      expectAll(pixels, almostRed);
    }
  });
});
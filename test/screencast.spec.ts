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
import { mkdirIfNeeded } from '../lib/utils/utils';

declare global {
  interface TestState {
    videoPlayer: VideoPlayer;
    videoFile: string;
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

registerFixture('videoFile', async ({browserType}, runTest, info) => {
  const { test, config } = info;
  const sanitizedTitle = test.title.replace(/[^\w\d]+/g, '_');
  const headless = options.HEADLESS ? 'headless-' : '';
  const videoFile = path.join(config.outputDir, 'video', `${headless}${sanitizedTitle}-${browserType.name()}_v.webm`);
  await mkdirIfNeeded(videoFile);
  await runTest(videoFile);
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
  }, async ({page, tmpDir, videoFile, videoPlayer, toImpl}) => {
    const start = Date.now();
    console.log('___ started should capture static page ' + (Date.now() - start) / 1000);
    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    console.log('started screencast ' + (Date.now() - start) / 1000);
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    console.log('stopped screencast ' + (Date.now() - start) / 1000);
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    console.log('loaded video ' + (Date.now() - start) / 1000);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);
    console.log('got duration ' + (Date.now() - start) / 1000);

    expect(await videoPlayer.videoWidth()).toBe(320);
    console.log('got videoWidth ' + (Date.now() - start) / 1000);
    expect(await videoPlayer.videoHeight()).toBe(240);
    console.log('got videoHeight ' + (Date.now() - start) / 1000);

    await videoPlayer.seekLastFrame();
    console.log('sought last frame ' + (Date.now() - start) / 1000);
    const pixels = await videoPlayer.pixels();
    console.log('got pixels ' + (Date.now() - start) / 1000);
    expectAll(pixels, almostRed);
  });

  it('should capture navigation', test => {
    test.flaky(options.CHROMIUM && MAC);
    test.flaky(options.FIREFOX);
    test.flaky(options.WEBKIT);
    test.fixme(options.WEBKIT && LINUX, 'Times out on bots');
  }, async ({page, tmpDir, server, videoFile, videoPlayer, toImpl}) => {
    const start = Date.now();
    console.log('___ started should capture navigation ' + (Date.now() - start) / 1000);
    await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
    console.log('navigated to first page ' + (Date.now() - start) / 1000);
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    console.log('started screencast ' + (Date.now() - start) / 1000);
    await new Promise(r => setTimeout(r, 1000));
    await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
    console.log('navigated to second page ' + (Date.now() - start) / 1000);
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    console.log('stopped screencast ' + (Date.now() - start) / 1000);
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    console.log('loaded video ' + (Date.now() - start) / 1000);
    const duration = await videoPlayer.duration();
    console.log('got duration ' + (Date.now() - start) / 1000);
    expect(duration).toBeGreaterThan(0);

    {
      await videoPlayer.seekFirstNonEmptyFrame();
      console.log('after seekFirstNonEmptyFrame ' + (Date.now() - start) / 1000);
      const pixels = await videoPlayer.pixels();
      console.log('got pixles ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostBlack);
    }

    {
      await videoPlayer.seekLastFrame();
      console.log('after seekLastFrame ' + (Date.now() - start) / 1000);
      const pixels = await videoPlayer.pixels();
      console.log('got pixles ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostGrey);
    }
  });

  it('should capture css transformation', test => {
  }, async ({page, tmpDir, server, videoFile, videoPlayer, toImpl}) => {
    const start = Date.now();
    console.log('___ started should capture css transformation ' + (Date.now() - start) / 1000);
    // Set viewport equal to screencast frame size to avoid scaling.
    await page.setViewportSize({width: 320, height: 240});
    await page.goto(server.PREFIX + '/rotate-z.html');
    console.log('navigated to first page ' + (Date.now() - start) / 1000);
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    console.log('started screencast ' + (Date.now() - start) / 1000);
    // TODO: in WebKit figure out why video size is not reported correctly for
    // static pictures.
    await new Promise(r => setTimeout(r, 1000));
    await toImpl(page)._delegate.stopScreencast();
    console.log('stopped screencast ' + (Date.now() - start) / 1000);
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    console.log('loaded video ' + (Date.now() - start) / 1000);
    const duration = await videoPlayer.duration();
    console.log('got duration ' + (Date.now() - start) / 1000);
    expect(duration).toBeGreaterThan(0);

    {
      await videoPlayer.seekLastFrame();
      console.log('after seekLastFrame ' + (Date.now() - start) / 1000);
      const pixels = await videoPlayer.pixels({x: 95, y: 45});
      console.log('got pixles ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostRed);
    }
  });

  it('should automatically start/finish when new page is created/closed', test => {
    test.flaky(options.FIREFOX, 'Even slow is not slow enough');
  }, async ({browserType, tmpDir}) => {
    const browser = await browserType.launch({_videosPath: tmpDir});
    const context = await browser.newContext({_recordVideos: {width: 320, height: 240}});
    const [screencast, newPage] = await Promise.all([
      new Promise<any>(r => context.on('page', page => page.on('_videostarted', r))),
      context.newPage(),
    ]);

    const [videoFile] = await Promise.all([
      screencast.path(),
      newPage.close(),
    ]);
    expect(path.dirname(videoFile)).toBe(tmpDir);
    await context.close();
    await browser.close();
  });

  it('should finish when contex closes', async ({browserType, tmpDir}) => {
    const browser = await browserType.launch({_videosPath: tmpDir});
    const context = await browser.newContext({_recordVideos: {width: 320, height: 240}});

    const [video] = await Promise.all([
      new Promise<any>(r => context.on('page', page => page.on('_videostarted', r))),
      context.newPage(),
    ]);

    const [videoFile] = await Promise.all([
      video.path(),
      context.close(),
    ]);
    expect(path.dirname(videoFile)).toBe(tmpDir);

    await browser.close();
  });

  it('should fire striclty after context.newPage', async ({browser, tmpDir}) => {
    const context = await browser.newContext({_recordVideos: {width: 320, height: 240}});
    const page = await context.newPage();
    // Should not hang.
    await page.waitForEvent('_videostarted');
    await context.close();
  });

  it('should fire start event for popups', async ({browserType, tmpDir, server}) => {
    const browser = await browserType.launch({_videosPath: tmpDir});
    const context = await browser.newContext({_recordVideos: {width: 320, height: 240}});

    const [page] = await Promise.all([
      context.newPage(),
      new Promise<any>(r => context.on('page', page => page.on('_videostarted', r))),
    ]);
    await page.goto(server.EMPTY_PAGE);
    const [video, popup] = await Promise.all([
      new Promise<any>(r => context.on('page', page => page.on('_videostarted', r))),
      new Promise<Page>(resolve => context.on('page', resolve)),
      page.evaluate(() => { window.open('about:blank'); })
    ]);
    const [videoFile] = await Promise.all([
      video.path(),
      popup.close()
    ]);
    expect(path.dirname(videoFile)).toBe(tmpDir);

    await browser.close();
  });

  it('should scale frames down to the requested size ', test => {
    test.fixme(options.WEBKIT && LINUX, 'Times out on bots');
  }, async ({page, videoPlayer, videoFile, tmpDir, server, toImpl}) => {
    const start = Date.now();
    await page.setViewportSize({width: 640, height: 480});
    console.log('___ should scale frames down to the requested size ' + (Date.now() - start) / 1000);
    await page.goto(server.PREFIX + '/checkerboard.html');
    // Set size to 1/2 of the viewport.
    await toImpl(page)._delegate.startScreencast({outputFile: videoFile, width: 320, height: 240});
    console.log('started screencast ' + (Date.now() - start) / 1000);
    // Update the picture to ensure enough frames are generated.
    await page.$eval('.container', container => {
      container.firstElementChild.classList.remove('red');
    });
    await new Promise(r => setTimeout(r, 300));
    console.log('after remove red ' + (Date.now() - start) / 1000);
    await page.$eval('.container', container => {
      container.firstElementChild.classList.add('red');
    });
    console.log('after add red ' + (Date.now() - start) / 1000);
    await new Promise(r => setTimeout(r, 1000));
    console.log('after wait ' + (Date.now() - start) / 1000);
    await toImpl(page)._delegate.stopScreencast();
    console.log('after stopScreencast ' + (Date.now() - start) / 1000);
    expect(fs.existsSync(videoFile)).toBe(true);

    await videoPlayer.load(videoFile);
    console.log('after load ' + (Date.now() - start) / 1000);
    const duration = await videoPlayer.duration();
    console.log('after duration ' + (Date.now() - start) / 1000);
    expect(duration).toBeGreaterThan(0);

    await videoPlayer.seekLastFrame();
    console.log('after seekLastFrame ' + (Date.now() - start) / 1000);
    {
      const pixels = await videoPlayer.pixels({x: 0, y: 0});
      console.log('1 after pixels ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostRed);
    }
    {
      const pixels = await videoPlayer.pixels({x: 300, y: 0});
      console.log('2 after pixels ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostGrey);
    }
    {
      const pixels = await videoPlayer.pixels({x: 0, y: 200});
      console.log('3 after pixels ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostGrey);
    }
    {
      const pixels = await videoPlayer.pixels({x: 300, y: 200});
      console.log('4 after pixels ' + (Date.now() - start) / 1000);
      expectAll(pixels, almostRed);
    }
  });
});
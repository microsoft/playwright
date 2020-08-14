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
import './base.fixture';
import { registerFixture } from './runner/fixtures';
import { Page } from '..';

import fs from 'fs';
import path from 'path';
import url from 'url';

const { HEADLESS } = testOptions;

declare global {
  interface FixtureState {
    videoPlayer: VideoPlayer;
  }
}

registerFixture('videoPlayer', async ({playwright, context}, test) => {
  let firefox;
  if (WEBKIT && !LINUX) {
    // WebKit on Mac & Windows cannot replay webm/vp8 video, so we launch Firefox.
    firefox = await playwright.firefox.launch();
    context = await firefox.newContext();
  }

  const page = await context.newPage();
  const player = new VideoPlayer(page);
  await test(player);
  if (firefox)
    await firefox.close();
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
  const checkPixel = (i) => {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const alpha = pixels[i + 3];
    rgbaPredicate(r, g, b, alpha);
  }
  try {
    for (var i = 0, n = pixels.length; i < n; i += 4)
      checkPixel(i);
  } catch(e) {
    // Log pixel values on failure.
    e.message += `\n\nActual pixels=[${pixels}]`;
    throw e;
  }
}

class VideoPlayer {
  private readonly _page: Page;
  constructor(page: Page) {
    this._page = page;
  }

  async load(videoFile) {
    await this._page.goto(url.pathToFileURL(videoFile).href);
    await this._page.$eval('video', (v:HTMLVideoElement) => {
      return new Promise(fulfil => {
        // In case video playback autostarts.
        v.pause();
        v.onplaying = fulfil;
        v.play();
      });
    });
    await this._page.$eval('video', (v:HTMLVideoElement) => {
      v.pause();
      const result = new Promise(f => v.onseeked = f);
      v.currentTime = v.duration;
      return result;
    });
  }

  async duration() {
    return await this._page.$eval('video', (v:HTMLVideoElement) => v.duration);
  }

  async videoWidth() {
    return await this._page.$eval('video', (v:HTMLVideoElement) => v.videoWidth);
  }

  async videoHeight() {
    return await this._page.$eval('video', (v:HTMLVideoElement) => v.videoHeight);
  }

  async seek(timestamp) {
    await this._page.$eval('video', (v:HTMLVideoElement, timestamp) => {
      v.pause();
      const result = new Promise(f => v.onseeked = f);
      v.currentTime = timestamp;
      return result;
    }, timestamp);
  }

  async seekFirstNonEmptyFrame() {
    let time = 0;
    for (let i = 0; i < 10; i++) {
      await this.seek(time);
      const pixels = await this.pixels();
      if (!pixels.every(p => p === 255))
        return;
      time += 0.1;
    }
  }

  async seekLastNonEmptyFrame() {
    const duration = await this.duration();
    let time = duration - 0.01;
    for (let i = 0; i < 10; i++) {
      await this.seek(time);
      const pixels = await this.pixels();
      if (!pixels.every(p => p === 0))
        return;
      time -= 0.1;
    }
  }

  async pixels(point = {x: 0, y: 0}) {
    const pixels = await this._page.$eval('video', (video:HTMLVideoElement, point) => {
      let canvas = document.createElement("canvas");
      if (!video.videoWidth || !video.videoHeight)
        throw new Error("Video element is empty");
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

it.fail(CHROMIUM)('should capture static page', async({page, tmpDir, videoPlayer, toImpl}) => {
  if (!toImpl)
    return;
  const videoFile = path.join(tmpDir, 'v.webm');
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await toImpl(page)._delegate.startVideoRecording({outputFile: videoFile, width: 640, height: 480});
  // TODO: in WebKit figure out why video size is not reported correctly for
  // static pictures.
  if (HEADLESS && WEBKIT)
    await page.setViewportSize({width: 1270, height: 950});
  await new Promise(r => setTimeout(r, 300));
  await toImpl(page)._delegate.stopVideoRecording();
  expect(fs.existsSync(videoFile)).toBe(true);

  await videoPlayer.load(videoFile);
  const duration = await videoPlayer.duration();
  expect(duration).toBeGreaterThan(0);

  expect(await videoPlayer.videoWidth()).toBe(640);
  expect(await videoPlayer.videoHeight()).toBe(480);

  await videoPlayer.seekLastNonEmptyFrame();
  const pixels = await videoPlayer.pixels();
  expectAll(pixels, almostRed);
});

it.fail(CHROMIUM)('should capture navigation', async({page, tmpDir, server, videoPlayer, toImpl}) => {
  if (!toImpl)
    return;
  const videoFile = path.join(tmpDir, 'v.webm');
  await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
  await toImpl(page)._delegate.startVideoRecording({outputFile: videoFile, width: 640, height: 480});
  // TODO: in WebKit figure out why video size is not reported correctly for
  // static pictures.
  if (HEADLESS && WEBKIT)
    await page.setViewportSize({width: 1270, height: 950});
  await new Promise(r => setTimeout(r, 300));
  await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
  await new Promise(r => setTimeout(r, 300));
  await toImpl(page)._delegate.stopVideoRecording();
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
    await videoPlayer.seekLastNonEmptyFrame();
    const pixels = await videoPlayer.pixels();
    expectAll(pixels, almostGrey);
  }
});

// Accelerated compositing is disabled in WebKit on Windows.
it.fail(CHROMIUM || (WEBKIT && WIN))('should capture css transformation', async({page, tmpDir, server, videoPlayer, toImpl}) => {
  if (!toImpl)
    return;
  const videoFile = path.join(tmpDir, 'v.webm');
  await page.goto(server.PREFIX + '/rotate-z.html');
  await toImpl(page)._delegate.startVideoRecording({outputFile: videoFile, width: 640, height: 480});
  // TODO: in WebKit figure out why video size is not reported correctly for
  // static pictures.
  if (HEADLESS && WEBKIT)
    await page.setViewportSize({width: 1270, height: 950});
  await new Promise(r => setTimeout(r, 300));
  await toImpl(page)._delegate.stopVideoRecording();
  expect(fs.existsSync(videoFile)).toBe(true);

  await videoPlayer.load(videoFile);
  const duration = await videoPlayer.duration();
  expect(duration).toBeGreaterThan(0);

  {
    await videoPlayer.seekLastNonEmptyFrame();
    const pixels = await videoPlayer.pixels({x: 95, y: 45});
    expectAll(pixels, almostRed);
  }
});

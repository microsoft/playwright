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

import { options, playwrightFixtures, config } from './playwright.fixtures';
import type { Page, Browser } from '..';

import fs from 'fs';
import path from 'path';
import { TestServer } from '../utils/testserver';

type WorkerState = {
  videoPlayerBrowser: Browser,
};
type TestState = {
  videoPlayer: VideoPlayer;
  relativeArtifactsPath: string;
  videoDir: string;
};
const fixtures = playwrightFixtures.declareWorkerFixtures<WorkerState>().declareTestFixtures<TestState>();
const { it, expect, describe, defineTestFixture, defineWorkerFixture, overrideWorkerFixture } = fixtures;

overrideWorkerFixture('browser', async ({ browserType, defaultBrowserOptions }, test) => {
  const browser = await browserType.launch({
    ...defaultBrowserOptions,
    // Make sure videos are stored on the same volume as the test output dir.
    artifactsPath: path.join(config.outputDir, '.screencast'),
  });
  await test(browser);
  await browser.close();
});

defineWorkerFixture('videoPlayerBrowser', async ({playwright}, runTest) => {
  // WebKit on Mac & Windows cannot replay webm/vp8 video, is unrelyable
  // on Linux (times out) and in Firefox, so we always launch chromium for
  // playback.
  const browser = await playwright.chromium.launch();
  await runTest(browser);
  await browser.close();
});

defineTestFixture('videoPlayer', async ({videoPlayerBrowser, server}, test) => {
  const page = await videoPlayerBrowser.newPage();
  await test(new VideoPlayer(page, server));
  await page.close();
});

defineTestFixture('relativeArtifactsPath', async ({ browserType, testInfo }, runTest) => {
  const sanitizedTitle = testInfo.title.replace(/[^\w\d]+/g, '_');
  const relativeArtifactsPath = `${browserType.name()}-${sanitizedTitle}`;
  await runTest(relativeArtifactsPath);
});

defineTestFixture('videoDir', async ({ relativeArtifactsPath }, runTest) => {
  await runTest(path.join(config.outputDir, '.screencast', relativeArtifactsPath));
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

async function findVideo(videoDir: string) {
  const files = await fs.promises.readdir(videoDir);
  return path.join(videoDir, files.find(file => file.endsWith('webm')));
}

async function findVideos(videoDir: string) {
  const files = await fs.promises.readdir(videoDir);
  return files.filter(file => file.endsWith('webm')).map(file => path.join(videoDir, file));
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
      // Quick check if all pixels are almost white. In Firefox blank page is not
      // truly white so whe check approximately.
      if (!pixels.every(p => p > 245))
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
    return await this._page.evaluate(async x => await (window as any).seekLastFrame());
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
  suite.flaky('We should migrate these to ffmpeg');
}, () => {
  it('should require artifactsPath', async ({browserType, defaultBrowserOptions}) => {
    const browser = await browserType.launch({
      ...defaultBrowserOptions,
      artifactsPath: undefined,
    });
    const error = await browser.newContext({ recordVideos: true }).catch(e => e);
    expect(error.message).toContain('"recordVideos" option requires "artifactsPath" to be specified');
    await browser.close();
  });

  it('should capture static page', async ({browser, videoPlayer, relativeArtifactsPath, videoDir}) => {
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
      videoSize: { width: 320, height: 240 }
    });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await findVideo(videoDir);
    await videoPlayer.load(videoFile);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);

    expect(await videoPlayer.videoWidth()).toBe(320);
    expect(await videoPlayer.videoHeight()).toBe(240);

    await videoPlayer.seekLastFrame();
    const pixels = await videoPlayer.pixels();
    expectAll(pixels, almostRed);
  });

  it('should capture navigation', async ({browser, server, videoPlayer, relativeArtifactsPath, videoDir}) => {
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
      videoSize: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
    await new Promise(r => setTimeout(r, 1000));
    await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await findVideo(videoDir);
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

  it('should capture css transformation', (test, parameters) => {
    test.fail(options.WEBKIT(parameters) && options.WIN(parameters), 'Does not work on WebKit Windows');
    test.fixme(!options.HEADLESS, 'Fails on headful');
  }, async ({browser, server, videoPlayer, relativeArtifactsPath, videoDir}) => {
    const size = {width: 320, height: 240};
    // Set viewport equal to screencast frame size to avoid scaling.
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
      videoSize: size,
      viewport: size,
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/rotate-z.html');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await findVideo(videoDir);
    await videoPlayer.load(videoFile);
    const duration = await videoPlayer.duration();
    expect(duration).toBeGreaterThan(0);

    {
      await videoPlayer.seekLastFrame();
      const pixels = await videoPlayer.pixels({x: 95, y: 45});
      expectAll(pixels, almostRed);
    }
  });

  it('should work for popups', async ({browser, relativeArtifactsPath, videoDir, server}) => {
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
      videoSize: { width: 320, height: 240 }
    });

    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => { window.open('about:blank'); }),
    ]);
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFiles = await findVideos(videoDir);
    expect(videoFiles.length).toBe(2);
  });

  it('should scale frames down to the requested size ', test => {
    test.fixme(!options.HEADLESS, 'Fails on headful');
  }, async ({browser, videoPlayer, relativeArtifactsPath, videoDir, server}) => {
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
      viewport: {width: 640, height: 480},
      // Set size to 1/2 of the viewport.
      videoSize: { width: 320, height: 240 },
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/checkerboard.html');
    // Update the picture to ensure enough frames are generated.
    await page.$eval('.container', container => {
      container.firstElementChild.classList.remove('red');
    });
    await new Promise(r => setTimeout(r, 300));
    await page.$eval('.container', container => {
      container.firstElementChild.classList.add('red');
    });
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await findVideo(videoDir);
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

  it('should use viewport as default size', async ({browser, videoPlayer, relativeArtifactsPath, videoDir}) => {
    const size = {width: 800, height: 600};
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
      viewport: size,
    });

    await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await findVideo(videoDir);
    await videoPlayer.load(videoFile);
    expect(await videoPlayer.videoWidth()).toBe(size.width);
    expect(await videoPlayer.videoHeight()).toBe(size.height);
  });

  it('should be 1280x720 by default', async ({browser, videoPlayer, relativeArtifactsPath, videoDir}) => {
    const context = await browser.newContext({
      relativeArtifactsPath,
      recordVideos: true,
    });

    await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await findVideo(videoDir);
    await videoPlayer.load(videoFile);
    expect(await videoPlayer.videoWidth()).toBe(1280);
    expect(await videoPlayer.videoHeight()).toBe(720);
  });
});

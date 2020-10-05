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

import { fixtures } from './fixtures';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PNG } from 'pngjs';

const { it, expect, describe } = fixtures;

let ffmpegName = '';
if (process.platform === 'win32')
  ffmpegName = process.arch === 'ia32' ? 'ffmpeg-win32' : 'ffmpeg-win64';
else if (process.platform === 'darwin')
  ffmpegName = 'ffmpeg-mac';
else if (process.platform === 'linux')
  ffmpegName = 'ffmpeg-linux';
const ffmpeg = path.join(__dirname, '..', 'third_party', 'ffmpeg', ffmpegName);

export class VideoPlayer {
  fileName: string;
  output: string;
  duration: number;
  frames: number;
  videoWidth: number;
  videoHeight: number;
  cache = new Map<number, PNG>();

  constructor(fileName: string) {
    this.fileName = fileName;
    this.output = spawnSync(ffmpeg, ['-i', this.fileName, `${this.fileName}-%03d.png`]).stderr.toString();

    const lines = this.output.split('\n');
    let framesLine = lines.find(l => l.startsWith('frame='))!;
    framesLine = framesLine.substring(framesLine.lastIndexOf('frame='));
    const framesMatch = framesLine.match(/frame=\s+(\d+)/);
    const streamLine = lines.find(l => l.trim().startsWith('Stream #0:0'));
    const resolutionMatch = streamLine.match(/, (\d+)x(\d+),/);
    const durationMatch = lines.find(l => l.trim().startsWith('Duration'))!.match(/Duration: (\d+):(\d\d):(\d\d.\d\d)/);
    this.duration = (((parseInt(durationMatch![1], 10) * 60) + parseInt(durationMatch![2], 10)) * 60 + parseFloat(durationMatch![3])) * 1000;
    this.frames = parseInt(framesMatch![1], 10);
    this.videoWidth = parseInt(resolutionMatch![1], 10);
    this.videoHeight = parseInt(resolutionMatch![2], 10);
  }

  seekFirstNonEmptyFrame(offset?: { x: number, y: number } | undefined): PNG | undefined {
    for (let f = 1; f <= this.frames; ++f) {
      const frame = this.frame(f, { x: 0, y: 0 });
      let hasColor = false;
      for (let i = 0; i < frame.data.length; i += 4) {
        if (frame.data[i + 0] < 230 || frame.data[i + 1] < 230 || frame.data[i + 2] < 230) {
          hasColor = true;
          break;
        }
      }
      if (hasColor)
        return this.frame(f, offset);
    }
  }

  seekLastFrame(offset?: { x: number, y: number }): PNG {
    return this.frame(this.frames, offset);
  }

  frame(frame: number, offset = { x: 10, y: 10 }): PNG {
    if (!this.cache.has(frame)) {
      const gap = '0'.repeat(3 - String(frame).length);
      const buffer = fs.readFileSync(`${this.fileName}-${gap}${frame}.png`);
      this.cache.set(frame, PNG.sync.read(buffer));
    }
    const decoded = this.cache.get(frame);
    const dst = new PNG({ width: 10, height: 10 });
    PNG.bitblt(decoded, dst, offset.x, offset.y, 10, 10, 0, 0);
    return dst;
  }
}

function almostRed(r, g, b, alpha) {
  expect(g).toBeLessThan(50);
  expect(b).toBeLessThan(50);
  expect(alpha).toBe(255);
}

function almostBlack(r, g, b, alpha) {
  expect(r).toBeLessThan(30);
  expect(g).toBeLessThan(30);
  expect(b).toBeLessThan(30);
  expect(alpha).toBe(255);
}

function almostGrey(r, g, b, alpha) {
  expect(r).toBeGreaterThan(70);
  expect(g).toBeGreaterThan(70);
  expect(b).toBeGreaterThan(70);
  expect(r).toBeLessThan(130);
  expect(g).toBeLessThan(130);
  expect(b).toBeLessThan(130);
  expect(alpha).toBe(255);
}

function expectAll(pixels: Buffer, rgbaPredicate) {
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

function findVideo(videoDir: string) {
  const files = fs.readdirSync(videoDir);
  return path.join(videoDir, files.find(file => file.endsWith('webm')));
}

function findVideos(videoDir: string) {
  const files = fs.readdirSync(videoDir);
  return files.filter(file => file.endsWith('webm')).map(file => path.join(videoDir, file));
}

describe('screencast', suite => {
  suite.slow();
}, () => {
  it('videoSize should require videosPath', async ({browser}) => {
    const error = await browser.newContext({ videoSize: { width: 100, height: 100 } }).catch(e => e);
    expect(error.message).toContain('"videoSize" option requires "videosPath" to be specified');
  });

  it('should capture static page', (test, { browserName }) => {
    test.fixme(browserName === 'firefox', 'Always clips to square');
  }, async ({browser, testInfo}) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      videosPath,
      viewport: size,
      videoSize: size
    });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    expect(videoPlayer.videoWidth).toBe(320);
    expect(videoPlayer.videoHeight).toBe(240);

    {
      const pixels = videoPlayer.seekLastFrame().data;
      expectAll(pixels, almostRed);
    }
    {
      const pixels = videoPlayer.seekLastFrame({ x: 300, y: 0}).data;
      expectAll(pixels, almostRed);
    }
  });

  it('should capture navigation', async ({browser, server, testInfo}) => {
    const videosPath = testInfo.outputPath('');
    const context = await browser.newContext({
      videosPath,
      videoSize: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
    await new Promise(r => setTimeout(r, 1000));
    await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekFirstNonEmptyFrame().data;
      expectAll(pixels, almostBlack);
    }

    {
      const pixels = videoPlayer.seekLastFrame().data;
      expectAll(pixels, almostGrey);
    }
  });

  it('should capture css transformation', (test, { browserName, platform, headful }) => {
    test.fixme(headful, 'Fails on headful');
  }, async ({browser, server, testInfo}) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    // Set viewport equal to screencast frame size to avoid scaling.
    const context = await browser.newContext({
      videosPath,
      videoSize: size,
      viewport: size,
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/rotate-z.html');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekLastFrame({ x: 95, y: 45 }).data;
      expectAll(pixels, almostRed);
    }
  });

  it('should work for popups', async ({browser, testInfo, server}) => {
    const videosPath = testInfo.outputPath('');
    const context = await browser.newContext({
      videosPath,
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

    const videoFiles = findVideos(videosPath);
    expect(videoFiles.length).toBe(2);
  });

  it('should scale frames down to the requested size ', (test, parameters) => {
    test.fixme(parameters.headful, 'Fails on headful');
  }, async ({browser, testInfo, server}) => {
    const videosPath = testInfo.outputPath('');
    const context = await browser.newContext({
      videosPath,
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

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekLastFrame({x: 0, y: 0}).data;
      expectAll(pixels, almostRed);
    }
    {
      const pixels = videoPlayer.seekLastFrame({x: 300, y: 0}).data;
      expectAll(pixels, almostGrey);
    }
    {
      const pixels = videoPlayer.seekLastFrame({x: 0, y: 200}).data;
      expectAll(pixels, almostGrey);
    }
    {
      const pixels = videoPlayer.seekLastFrame({x: 300, y: 200}).data;
      expectAll(pixels, almostRed);
    }
  });

  it('should use viewport as default size', async ({browser, testInfo}) => {
    const videosPath = testInfo.outputPath('');
    const size = {width: 800, height: 600};
    const context = await browser.newContext({
      videosPath,
      viewport: size,
    });

    await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    expect(await videoPlayer.videoWidth).toBe(size.width);
    expect(await videoPlayer.videoHeight).toBe(size.height);
  });

  it('should be 1280x720 by default', async ({browser, testInfo}) => {
    const videosPath = testInfo.outputPath('');
    const context = await browser.newContext({
      videosPath,
    });

    await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    expect(await videoPlayer.videoWidth).toBe(1280);
    expect(await videoPlayer.videoHeight).toBe(720);
  });

  it('should capture static page in persistent context', async ({launchPersistent, testInfo}) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const { context, page } = await launchPersistent({
      videosPath,
      viewport: size,
      videoSize: size
    });

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = findVideo(videosPath);
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    expect(videoPlayer.videoWidth).toBe(320);
    expect(videoPlayer.videoHeight).toBe(240);

    {
      const pixels = videoPlayer.seekLastFrame().data;
      expectAll(pixels, almostRed);
    }
  });
});

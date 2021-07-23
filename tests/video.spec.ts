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

import { browserTest as it, expect } from './config/browserTest';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PNG } from 'pngjs';
import { registry } from '../src/utils/registry';

const ffmpeg = registry.findExecutable('ffmpeg')!.executablePath();

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
    // Force output frame rate to 25 fps as otherwise it would produce one image per timebase unit
    // which is 1 / (25 * 1000).
    this.output = spawnSync(ffmpeg, ['-i', this.fileName, '-r', '25', `${this.fileName}-%03d.png`]).stderr.toString();

    const lines = this.output.split('\n');
    let framesLine = lines.find(l => l.startsWith('frame='))!;
    if (!framesLine)
      throw new Error(`No frame data in the output:\n${this.output}`);
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
  expect(r).toBeGreaterThan(185);
  expect(g).toBeLessThan(70);
  expect(b).toBeLessThan(70);
  expect(alpha).toBe(255);
}

function almostBlack(r, g, b, alpha) {
  expect(r).toBeLessThan(70);
  expect(g).toBeLessThan(70);
  expect(b).toBeLessThan(70);
  expect(alpha).toBe(255);
}

function almostGray(r, g, b, alpha) {
  expect(r).toBeGreaterThan(70);
  expect(g).toBeGreaterThan(70);
  expect(b).toBeGreaterThan(70);
  expect(r).toBeLessThan(185);
  expect(g).toBeLessThan(185);
  expect(b).toBeLessThan(185);
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
    e.message += `\n\nActual pixels=[${pixels.join(',')}]`;
    throw e;
  }
}

function findVideos(videoDir: string) {
  const files = fs.readdirSync(videoDir);
  return files.filter(file => file.endsWith('webm')).map(file => path.join(videoDir, file));
}

function expectRedFrames(videoFile: string, size: { width: number, height: number }) {
  const videoPlayer = new VideoPlayer(videoFile);
  const duration = videoPlayer.duration;
  expect(duration).toBeGreaterThan(0);

  expect(videoPlayer.videoWidth).toBe(size.width);
  expect(videoPlayer.videoHeight).toBe(size.height);

  {
    const pixels = videoPlayer.seekLastFrame().data;
    expectAll(pixels, almostRed);
  }
  {
    const pixels = videoPlayer.seekLastFrame({ x: size.width - 20, y: 0 }).data;
    expectAll(pixels, almostRed);
  }
}

it.describe('screencast', () => {
  it.slow();

  it('videoSize should require videosPath', async ({browser}) => {
    const error = await browser.newContext({ videoSize: { width: 100, height: 100 } }).catch(e => e);
    expect(error.message).toContain('"videoSize" option requires "videosPath" to be specified');
  });

  it('should work with old options', async ({browser}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 450, height: 240 };
    const context = await browser.newContext({
      videosPath,
      viewport: size,
      videoSize: size
    });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    expectRedFrames(videoFile, size);
  });

  it('should throw without recordVideo.dir', async ({ browser }) => {
    const error = await browser.newContext({ recordVideo: {} as any }).catch(e => e);
    expect(error.message).toContain('recordVideo.dir: expected string, got undefined');
  });

  it('should capture static page', async ({browser}, testInfo) => {
    const size = { width: 450, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size
      },
      viewport: size,
    });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    expectRedFrames(videoFile, size);
  });

  it('should expose video path', async ({browser}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    const path = await page.video()!.path();
    expect(path).toContain(videosPath);
    await context.close();
    expect(fs.existsSync(path)).toBeTruthy();
  });

  it('should saveAs video', async ({browser}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await page.waitForTimeout(1000);
    await context.close();

    const saveAsPath = testInfo.outputPath('my-video.webm');
    await page.video().saveAs(saveAsPath);
    expect(fs.existsSync(saveAsPath)).toBeTruthy();
  });

  it('saveAs should throw when no video frames', async ({browser, browserName}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });

    const page = await context.newPage();
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      page.evaluate(() => {
        const win = window.open('about:blank');
        win.close();
      }),
    ]);
    await page.close();

    const saveAsPath = testInfo.outputPath('my-video.webm');
    const error = await popup.video().saveAs(saveAsPath).catch(e => e);
    // WebKit pauses renderer before win.close() and actually writes something.
    if (browserName === 'webkit')
      expect(fs.existsSync(saveAsPath)).toBeTruthy();
    else
      expect(error.message).toContain('Page did not produce any video frames');
  });

  it('should delete video', async ({browser}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    const deletePromise = page.video().delete();
    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await page.waitForTimeout(1000);
    await context.close();

    const videoPath = await page.video().path();
    await deletePromise;
    expect(fs.existsSync(videoPath)).toBeFalsy();
  });

  it('should expose video path blank page', async ({browser}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    const path = await page.video()!.path();
    expect(path).toContain(videosPath);
    await context.close();
    expect(fs.existsSync(path)).toBeTruthy();
  });

  it('should expose video path blank popup', async ({browser}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate('window.open("about:blank")')
    ]);
    const path = await popup.video()!.path();
    expect(path).toContain(videosPath);
    await context.close();
    expect(fs.existsSync(path)).toBeTruthy();
  });

  it('should capture navigation', async ({browser, server}, testInfo) => {
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size: { width: 1280, height: 720 }
      },
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
    await new Promise(r => setTimeout(r, 1000));
    await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekFirstNonEmptyFrame().data;
      expectAll(pixels, almostBlack);
    }

    {
      const pixels = videoPlayer.seekLastFrame().data;
      expectAll(pixels, almostGray);
    }
  });

  it('should capture css transformation', async ({browser, server, headless, browserName, platform}, testInfo) => {
    it.fixme(!headless, 'Fails on headed');
    it.fixme(browserName === 'webkit' && platform === 'win32');

    const size = { width: 320, height: 240 };
    // Set viewport equal to screencast frame size to avoid scaling.
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/rotate-z.html');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekLastFrame({ x: 95, y: 45 }).data;
      expectAll(pixels, almostRed);
    }
  });

  it('should work for popups', async ({browser, server}, testInfo) => {
    const videosPath = testInfo.outputPath('');
    const size = { width: 450, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.evaluate(() => { window.open('about:blank'); }),
    ]);
    await popup.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const pageVideoFile = await page.video().path();
    const popupVideoFile = await popup.video().path();
    expect(pageVideoFile).not.toEqual(popupVideoFile);
    expectRedFrames(popupVideoFile, size);

    const videoFiles = findVideos(videosPath);
    expect(videoFiles.length).toBe(2);
  });

  it('should scale frames down to the requested size ', async ({browser, server, headless}, testInfo) => {
    it.fixme(!headless, 'Fails on headed');

    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        // Set size to 1/2 of the viewport.
        size: { width: 320, height: 240 },
      },
      viewport: {width: 640, height: 480},
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

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekLastFrame({x: 0, y: 0}).data;
      expectAll(pixels, almostRed);
    }
    {
      const pixels = videoPlayer.seekLastFrame({x: 300, y: 0}).data;
      expectAll(pixels, almostGray);
    }
    {
      const pixels = videoPlayer.seekLastFrame({x: 0, y: 200}).data;
      expectAll(pixels, almostGray);
    }
    {
      const pixels = videoPlayer.seekLastFrame({x: 300, y: 200}).data;
      expectAll(pixels, almostRed);
    }
  });

  it('should use viewport scaled down to fit into 800x800 as default size', async ({browser}, testInfo) => {
    const size = {width: 1600, height: 1200};
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
      viewport: size,
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    expect(videoPlayer.videoWidth).toBe(800);
    expect(videoPlayer.videoHeight).toBe(600);
  });

  it('should be 800x450 by default', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    expect(videoPlayer.videoWidth).toBe(800);
    expect(videoPlayer.videoHeight).toBe(450);
  });

  it('should be 800x600 with null viewport', async ({ browser, headless, browserName }, testInfo) => {
    it.fixme(browserName === 'firefox' && headless, 'Fails in headless on bots');

    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
      viewport: null
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    expect(videoPlayer.videoWidth).toBe(800);
    expect(videoPlayer.videoHeight).toBe(600);
  });

  it('should capture static page in persistent context', async ({launchPersistent}, testInfo) => {
    const size = { width: 320, height: 240 };
    const { context, page } = await launchPersistent({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
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

  it('should emulate an iphone', async ({contextFactory, playwright, contextOptions, browserName}, testInfo) => {
    it.skip(browserName === 'firefox', 'isMobile is not supported in Firefox');

    const device = playwright.devices['iPhone 6'];
    const context = await contextFactory({
      ...contextOptions,
      ...device,
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    expect(videoPlayer.videoWidth).toBe(374);
    expect(videoPlayer.videoHeight).toBe(666);
  });

  it('should throw on browser close', async ({browserType, browserOptions, contextOptions}, testInfo) => {
    const size = { width: 320, height: 240 };
    const browser = await browserType.launch(browserOptions);
    const context = await browser.newContext({
      ...contextOptions,
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await browser.close();

    const file = testInfo.outputPath('saved-video-');
    const saveResult = await page.video().saveAs(file).catch(e => e);
    expect(saveResult.message).toContain('browser has been closed');
  });

  it('should throw if browser dies', async ({browserType, browserOptions, contextOptions}, testInfo) => {
    const size = { width: 320, height: 240 };
    const browser = await browserType.launch(browserOptions);

    const context = await browser.newContext({
      ...contextOptions,
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await (browser as any)._channel.killForTests();

    const file = testInfo.outputPath('saved-video-');
    const saveResult = await page.video().saveAs(file).catch(e => e);
    expect(saveResult.message).toContain('rowser has been closed');
  });

  it('should wait for video to finish if page was closed', async ({browserType, browserOptions, contextOptions}, testInfo) => {
    const size = { width: 320, height: 240 };
    const browser = await browserType.launch(browserOptions);

    const videoDir = testInfo.outputPath('');
    const context = await browser.newContext({
      ...contextOptions,
      recordVideo: {
        dir: videoDir,
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await new Promise(r => setTimeout(r, 1000));
    await page.close();
    await context.close();
    await browser.close();

    const videoFiles = findVideos(videoDir);
    expect(videoFiles.length).toBe(1);
    const videoPlayer = new VideoPlayer(videoFiles[0]);
    expect(videoPlayer.videoWidth).toBe(320);
    expect(videoPlayer.videoHeight).toBe(240);
  });

  it('should not create video for internal pages', async ({browser, browserName, contextOptions, server}, testInfo) => {
    it.fixme(true, 'https://github.com/microsoft/playwright/issues/6743');
    server.setRoute('/empty.html', (req, res) => {
      res.setHeader('Set-Cookie', 'name=value');
      res.end();
    });

    const videoDir = testInfo.outputPath('');
    const context = await browser.newContext({
      ...contextOptions,
      recordVideo: {
        dir: videoDir
      }
    });

    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await new Promise(r => setTimeout(r, 1000));

    const cookies = await context.cookies();
    expect(cookies.length).toBe(1);
    await context.storageState();
    await context.close();

    const files = fs.readdirSync(videoDir);
    expect(files.length).toBe(1);
  });

});

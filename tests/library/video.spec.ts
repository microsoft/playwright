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

import { browserTest as it, expect } from '../config/browserTest';
import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright-core';
import { spawnSync } from 'child_process';
import { PNG, jpegjs } from 'playwright-core/lib/utilsBundle';
import { registry } from '../../packages/playwright-core/lib/server';
import { rewriteErrorMessage } from '../../packages/playwright-core/lib/utils/stackTrace';
import { parseTraceRaw } from '../config/utils';

const ffmpeg = registry.findExecutable('ffmpeg')!.executablePath('javascript');

export class VideoPlayer {
  fileName: string;
  output: string;
  duration: number;
  frames: number;
  videoWidth: number;
  videoHeight: number;
  cache = new Map<number, any>();

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

  seekFirstNonEmptyFrame(offset?: { x: number, y: number }): any | undefined {
    for (let f = 1; f <= this.frames; ++f) {
      const frame = this.frame(f, offset);
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

  seekLastFrame(offset?: { x: number, y: number }): any {
    return this.frame(this.frames, offset);
  }

  frame(frame: number, offset = { x: 10, y: 10 }): any {
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
    rewriteErrorMessage(e, e.message + `\n\nActual pixels=[${pixels.join(',')}]`);
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
  it.skip(({ mode }) => mode !== 'default', 'video.path() is not available in remote mode');

  it('videoSize should require videosPath', async ({ browser }) => {
    const error = await browser.newContext({ videoSize: { width: 100, height: 100 } }).catch(e => e);
    expect(error.message).toContain('"videoSize" option requires "videosPath" to be specified');
  });

  it('should work with old options', async ({ browser, browserName, trace, headless, isWindows }, testInfo) => {
    const videosPath = testInfo.outputPath('');
    // Firefox does not have a mobile variant and has a large minimum size (500 on windows and 450 elsewhere).
    const size = browserName === 'firefox' ? { width: 500, height: 400 } : { width: 320, height: 240 };
    const context = await browser.newContext({
      videosPath,
      viewport: size,
      videoSize: size
    });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    expectRedFrames(videoFile, size);
  });

  it('should throw without recordVideo.dir', async ({ browser }) => {
    const error = await browser.newContext({ recordVideo: {} as any }).catch(e => e);
    expect(error.message).toContain('recordVideo.dir: expected string, got undefined');
  });

  it('should capture static page', async ({ browser, browserName, trace, headless, isWindows }, testInfo) => {
    // Firefox does not have a mobile variant and has a large minimum size (500 on windows and 450 elsewhere).
    const size = browserName === 'firefox' ? { width: 500, height: 400 } : { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size
      },
      viewport: size,
    });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    expectRedFrames(videoFile, size);
  });

  it('should continue recording main page after popup closes', async ({ browser, browserName }, testInfo) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30837' });
    // Firefox does not have a mobile variant and has a large minimum size (500 on windows and 450 elsewhere).
    const size = browserName === 'firefox' ? { width: 500, height: 400 } : { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    await page.setContent('<a target=_blank href="about:blank">clickme</a>');
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      await page.click('a'),
    ]);
    await popup.close();

    await page.evaluate(() => {
      document.body.textContent = ''; // remove link
      document.body.style.backgroundColor = 'red';
    });
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    expectRedFrames(videoFile, size);
  });

  it('should expose video path', async ({ browser }, testInfo) => {
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

  it('saveAs should throw when no video frames', async ({ browser }, testInfo) => {
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
    // WebKit pauses renderer before win.close() and actually writes something,
    // and other browsers are sometimes fast as well.
    if (!fs.existsSync(saveAsPath))
      expect(error.message).toContain('Page did not produce any video frames');
    await context.close();
  });

  it('should delete video', async ({ browser }, testInfo) => {
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
    await waitForRafs(page, 100);
    await context.close();

    const videoPath = await page.video().path();
    await deletePromise;
    expect(fs.existsSync(videoPath)).toBeFalsy();
  });

  it('should expose video path blank page', async ({ browser }, testInfo) => {
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

  it('should work with weird screen resolution', async ({ browser }, testInfo) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22069' });
    const videosPath = testInfo.outputPath('');
    const size = { width: 1904, height: 609 };
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

  it('should work with relative path for recordVideo.dir', async ({ browser }, testInfo) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27086' });
    const videosPath = path.relative(process.cwd(), testInfo.outputPath(''));
    const size = { width: 320, height: 240 };
    const context = await browser.newContext({
      recordVideo: {
        dir: videosPath,
        size
      },
      viewport: size,
    });
    const page = await context.newPage();
    const videoPath = await page.video()!.path();
    await context.close();
    expect(fs.existsSync(videoPath)).toBeTruthy();
  });

  it('should expose video path blank popup', async ({ browser }, testInfo) => {
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

  it('should capture navigation', async ({ browser, browserName, server, trace }, testInfo) => {
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size: { width: 1280, height: 720 }
      },
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/background-color.html#rgb(0,0,0)');
    await waitForRafs(page, 100);
    await page.goto(server.CROSS_PROCESS_PREFIX + '/background-color.html#rgb(100,100,100)');
    await waitForRafs(page, 100);
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

  it('should capture css transformation', async ({ browser, server, headless, browserName, platform, trace }, testInfo) => {
    it.fixme(!headless, 'Fails on headed');
    it.fixme(browserName === 'webkit' && platform === 'win32');

    const size = { width: 600, height: 400 };
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
    await waitForRafs(page, 100);
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

  it('should work for popups', async ({ browser, server, browserName, trace }, testInfo) => {
    it.fixme(browserName === 'firefox', 'https://github.com/microsoft/playwright/issues/14557');
    const videosPath = testInfo.outputPath('');
    const size = { width: 600, height: 400 };
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
    await Promise.all([
      waitForRafs(page, 100),
      waitForRafs(popup, 100),
    ]);
    await context.close();

    const pageVideoFile = await page.video().path();
    const popupVideoFile = await popup.video().path();
    expect(pageVideoFile).not.toEqual(popupVideoFile);
    expectRedFrames(popupVideoFile, size);

    const videoFiles = findVideos(videosPath);
    expect(videoFiles.length).toBe(2);
  });

  it('should scale frames down to the requested size ', async ({ browser, browserName, server, headless, trace }, testInfo) => {
    const isChromiumHeadlessNew = browserName === 'chromium' && !!headless && !!process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW;
    it.fixme(!headless || isChromiumHeadlessNew, 'Fails on headed');

    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        // Set size to 1/2 of the viewport.
        size: { width: 320, height: 240 },
      },
      viewport: { width: 640, height: 480 },
    });
    const page = await context.newPage();

    await page.goto(server.PREFIX + '/checkerboard.html');
    // Update the picture to ensure enough frames are generated.
    await page.$eval('.container', container => {
      container.firstElementChild.classList.remove('red');
    });
    await waitForRafs(page, 100);
    await page.$eval('.container', container => {
      container.firstElementChild.classList.add('red');
    });
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    {
      const pixels = videoPlayer.seekLastFrame({ x: 0, y: 0 }).data;
      expectAll(pixels, almostRed);
    }
    {
      const pixels = videoPlayer.seekLastFrame({ x: 300, y: 0 }).data;
      expectAll(pixels, almostGray);
    }
    {
      const pixels = videoPlayer.seekLastFrame({ x: 0, y: 200 }).data;
      expectAll(pixels, almostGray);
    }
    {
      const pixels = videoPlayer.seekLastFrame({ x: 300, y: 200 }).data;
      expectAll(pixels, almostRed);
    }
  });

  it('should use viewport scaled down to fit into 800x800 as default size', async ({ browser }, testInfo) => {
    const size = { width: 1600, height: 1200 };
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
      viewport: size,
    });

    const page = await context.newPage();
    await waitForRafs(page, 100);
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
    await waitForRafs(page, 100);
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
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    expect(videoPlayer.videoWidth).toBe(800);
    expect(videoPlayer.videoHeight).toBe(600);
  });

  it('should capture static page in persistent context @smoke', async ({ launchPersistent, browserName, trace, isMac }, testInfo) => {
    it.skip(browserName === 'webkit' && isMac && process.arch === 'arm64', 'Is only failing on self-hosted github actions runner on M1 mac; not reproducible locally');
    const size = { width: 600, height: 400 };
    const { context, page } = await launchPersistent({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    const duration = videoPlayer.duration;
    expect(duration).toBeGreaterThan(0);

    expect(videoPlayer.videoWidth).toBe(600);
    expect(videoPlayer.videoHeight).toBe(400);

    {
      const pixels = videoPlayer.seekLastFrame().data;
      expectAll(pixels, almostRed);
    }
  });

  it('should emulate an iphone', async ({ contextFactory, playwright, browserName }, testInfo) => {
    it.skip(browserName === 'firefox', 'isMobile is not supported in Firefox');

    const device = playwright.devices['iPhone 6'];
    const context = await contextFactory({
      ...device,
      recordVideo: {
        dir: testInfo.outputPath(''),
      },
    });

    const page = await context.newPage();
    await waitForRafs(page, 100);
    await context.close();

    const videoFile = await page.video().path();
    const videoPlayer = new VideoPlayer(videoFile);
    expect(videoPlayer.videoWidth).toBe(374);
    expect(videoPlayer.videoHeight).toBe(666);
  });

  it('should throw on browser close', async ({ browserType }, testInfo) => {
    const size = { width: 320, height: 240 };
    const browser = await browserType.launch();
    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await waitForRafs(page, 100);
    await browser.close();

    const file = testInfo.outputPath('saved-video-');
    const saveResult = await page.video().saveAs(file).catch(e => e);
    expect(saveResult.message).toContain('browser has been closed');
  });

  it('should throw if browser dies', async ({ browserType }, testInfo) => {
    const size = { width: 320, height: 240 };
    const browser = await browserType.launch();

    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await waitForRafs(page, 100);
    await (browser as any)._channel.killForTests();

    const file = testInfo.outputPath('saved-video-');
    const saveResult = await page.video().saveAs(file).catch(e => e);
    expect(saveResult.message).toContain('rowser has been closed');
  });

  it('should wait for video to finish if page was closed', async ({ browserType }, testInfo) => {
    const size = { width: 320, height: 240 };
    const browser = await browserType.launch();

    const videoDir = testInfo.outputPath('');
    const context = await browser.newContext({
      recordVideo: {
        dir: videoDir,
        size,
      },
      viewport: size,
    });

    const page = await context.newPage();
    await waitForRafs(page, 100);
    await page.close();
    await context.close();
    await browser.close();

    const videoFiles = findVideos(videoDir);
    expect(videoFiles.length).toBe(1);
    const videoPlayer = new VideoPlayer(videoFiles[0]);
    expect(videoPlayer.videoWidth).toBe(320);
    expect(videoPlayer.videoHeight).toBe(240);
  });

  it('should not create video for internal pages', async ({ browser, server }, testInfo) => {
    it.fixme(true, 'https://github.com/microsoft/playwright/issues/6743');
    server.setRoute('/empty.html', (req, res) => {
      res.setHeader('Set-Cookie', 'name=value');
      res.end();
    });

    const videoDir = testInfo.outputPath('');
    const context = await browser.newContext({
      recordVideo: {
        dir: videoDir
      }
    });

    const page = await context.newPage();
    await page.goto(server.EMPTY_PAGE);
    await waitForRafs(page, 100);

    const cookies = await context.cookies();
    expect(cookies.length).toBe(1);
    await context.storageState();
    await context.close();

    const files = fs.readdirSync(videoDir);
    expect(files.length).toBe(1);
  });

  it('should capture full viewport', async ({ browserType, browserName, headless, isWindows }, testInfo) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22411' });
    it.fixme(browserName === 'chromium' && (!headless || !!process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW), 'The square is not on the video');
    it.fixme(browserName === 'firefox' && isWindows, 'https://github.com/microsoft/playwright/issues/14405');
    const size = { width: 600, height: 400 };
    const browser = await browserType.launch();

    const videoDir = testInfo.outputPath('');
    const context = await browser.newContext({
      viewport: size,
      recordVideo: {
        dir: videoDir,
        size,
      },
    });

    const page = await context.newPage();
    await page.setContent(`<div style='margin: 0; background: red; position: fixed; right:0; bottom:0; width: 30; height: 30;'></div>`);
    await waitForRafs(page, 100);
    await page.close();
    await context.close();
    await browser.close();

    const videoFiles = findVideos(videoDir);
    expect(videoFiles.length).toBe(1);
    const videoPlayer = new VideoPlayer(videoFiles[0]);
    expect(videoPlayer.videoWidth).toBe(size.width);
    expect(videoPlayer.videoHeight).toBe(size.height);

    // Bottom right corner should be part of the red border.
    // However, headed browsers on mac have rounded corners, so offset by 10.
    const pixels = videoPlayer.seekLastFrame({ x: size.width - 20, y: size.height - 20 }).data;
    expectAll(pixels, almostRed);
  });

  it('should capture full viewport on hidpi', async ({ browserType, browserName, headless, isWindows, isLinux }, testInfo) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22411' });
    it.fixme(browserName === 'chromium' && (!headless || !!process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW), 'The square is not on the video');
    it.fixme(browserName === 'firefox' && isWindows, 'https://github.com/microsoft/playwright/issues/14405');
    it.fixme(browserName === 'webkit' && isLinux && !headless, 'https://github.com/microsoft/playwright/issues/22617');
    const size = { width: 600, height: 400 };
    const browser = await browserType.launch();

    const videoDir = testInfo.outputPath('');
    const context = await browser.newContext({
      viewport: size,
      deviceScaleFactor: 3,
      recordVideo: {
        dir: videoDir,
        size,
      },
    });

    const page = await context.newPage();
    await page.setContent(`<div style='margin: 0; background: red; position: fixed; right:0; bottom:0; width: 30; height: 30;'></div>`);
    await waitForRafs(page, 100);
    await page.close();
    await context.close();
    await browser.close();

    const videoFiles = findVideos(videoDir);
    expect(videoFiles.length).toBe(1);
    const videoPlayer = new VideoPlayer(videoFiles[0]);
    expect(videoPlayer.videoWidth).toBe(size.width);
    expect(videoPlayer.videoHeight).toBe(size.height);

    // Bottom right corner should be part of the red border.
    // However, headed browsers on mac have rounded corners, so offset by 10.
    const pixels = videoPlayer.seekLastFrame({ x: size.width - 20, y: size.height - 20 }).data;
    expectAll(pixels, almostRed);
  });

  it('should work with video+trace', async ({ browser, trace, headless }, testInfo) => {
    it.skip(trace === 'on');
    it.fixme(!headless || !!process.env.PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW, 'different trace screencast image size on all browsers');

    const size = { width: 500, height: 400 };
    const traceFile = testInfo.outputPath('trace.zip');

    const context = await browser.newContext({
      recordVideo: {
        dir: testInfo.outputPath(''),
        size
      },
      viewport: size,
    });
    await context.tracing.start({ screenshots: true });
    const page = await context.newPage();

    await page.evaluate(() => document.body.style.backgroundColor = 'red');
    await waitForRafs(page, 100);
    await context.tracing.stop({ path: traceFile });
    await context.close();

    const videoFile = await page.video().path();
    expectRedFrames(videoFile, size);

    const { events, resources } = await parseTraceRaw(traceFile);
    const frame = events.filter(e => e.type === 'screencast-frame').pop();
    const buffer = resources.get('resources/' + frame.sha1);
    const image = jpegjs.decode(buffer);
    expect(image.width).toBe(size.width);
    expect(image.height).toBe(size.height);
    const offset = size.width * size.height / 2 * 4 + size.width * 4 / 2; // Center should be red.
    almostRed(image.data.readUInt8(offset), image.data.readUInt8(offset + 1), image.data.readUInt8(offset + 2), image.data.readUInt8(offset + 3));
  });
});

it('should saveAs video', async ({ browser }, testInfo) => {
  it.slow();

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
  await waitForRafs(page, 100);
  await context.close();

  const saveAsPath = testInfo.outputPath('my-video.webm');
  await page.video().saveAs(saveAsPath);
  expect(fs.existsSync(saveAsPath)).toBeTruthy();
});

async function waitForRafs(page: Page, count: number): Promise<void> {
  await page.evaluate(count => new Promise<void>(resolve => {
    const onRaf = () => {
      --count;
      if (!count)
        resolve();
      else
        window.builtinRequestAnimationFrame(onRaf);
    };
    window.builtinRequestAnimationFrame(onRaf);
  }), count);
}

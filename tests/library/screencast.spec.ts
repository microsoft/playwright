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

import fs from 'fs';
import path from 'path';
import { expect, browserTest as test } from '../config/browserTest';
import { rafraf } from '../config/utils';
import { kTargetClosedErrorMessage } from '../config/errors';
import { VideoPlayer } from './videoPlayer';

test.skip(({ mode }) => mode !== 'default', 'screencast is not available in remote mode');
test.skip(({ video }) => video === 'on', 'conflicts with built-in video recording');
test.slow();

test('screencast.start delivers frames via onFrame callback', async ({ browser, server, trace }) => {
  test.skip(trace === 'on', 'trace=on has different screencast image configuration');
  const context = await browser.newContext({ viewport: { width: 1000, height: 400 } });
  const page = await context.newPage();

  const frames: Buffer[] = [];
  const size = { width: 500, height: 400 };
  await page.screencast.start({ onFrame: ({ data }) => frames.push(data), size });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await page.screencast.stop();

  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    // Each frame must be a valid JPEG (starts with FF D8)
    expect(frame[0]).toBe(0xff);
    expect(frame[1]).toBe(0xd8);
    const { width, height } = jpegDimensions(frame);
    // Frame should be scaled down to fit the maximum size.
    expect(width).toBe(500);
    expect(height).toBe(200);
  }

  await context.close();
});

test('start throws if screencast is already started', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 500, height: 400 } });
  const page = await context.newPage();

  await page.screencast.start({ onFrame: () => {} });
  await expect(page.screencast.start({ onFrame: () => {} })).rejects.toThrow('Screencast is already started');

  await page.screencast.stop();
  await context.close();
});

test('start allows restart with different options after stop', async ({ browser, trace }) => {
  test.skip(trace === 'on', 'trace=on enables screencast with different options');

  const context = await browser.newContext({ viewport: { width: 500, height: 400 } });
  const page = await context.newPage();

  await page.screencast.start({ onFrame: () => {}, size: { width: 500, height: 400 } });
  await page.screencast.stop();
  // Different options should succeed once the previous screencast is stopped.
  await page.screencast.start({ onFrame: () => {}, size: { width: 320, height: 240 } });
  await page.screencast.stop();
  await context.close();
});

test('start returns a disposable that stops screencast', async ({ browser, server, trace }) => {
  test.skip(trace === 'on', 'trace=on has different screencast image configuration');
  const context = await browser.newContext({ viewport: { width: 500, height: 400 } });
  const page = await context.newPage();

  const frames: Buffer[] = [];
  await page.screencast.start({ onFrame: ({ data }) => frames.push(data), size: { width: 500, height: 400 } });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await page.screencast.stop();

  const frameCountAfterDispose = frames.length;
  expect(frameCountAfterDispose).toBeGreaterThan(0);

  // No more frames should arrive after dispose.
  await page.evaluate(() => document.body.style.backgroundColor = 'blue');
  await rafraf(page, 100);
  expect(frames.length).toBe(frameCountAfterDispose);

  await context.close();
});

test('start/stop twice without path creates two files in artifactsDir', async ({ browserType }, testInfo) => {
  test.slow();
  const artifactsDir = testInfo.outputPath('artifacts');
  const browser = await browserType.launch({ artifactsDir });
  const size = { width: 800, height: 800 };
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();

  await page.screencast.start({ path: testInfo.outputPath('video1.webm'), size });
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await page.screencast.stop();

  await page.screencast.start({ path: testInfo.outputPath('video2.webm'), size });
  await page.evaluate(() => document.body.style.backgroundColor = 'blue');
  await rafraf(page, 100);
  await page.screencast.stop();

  const videoFiles = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.webm'));
  expect(videoFiles).toHaveLength(2);

  await context.close();
  await browser.close();
});

test('start should work when recordVideo is set', async ({ browser }, testInfo) => {
  test.slow();
  const autoDir = testInfo.outputPath('auto');
  const manualDir = testInfo.outputPath('manual');
  const context = await browser.newContext({
    recordVideo: {
      dir: autoDir,
    },
  });
  const page = await context.newPage();

  await page.screencast.start({ path: path.join(manualDir, 'video.webm') });
  await page.evaluate(() => document.body.style.backgroundColor = 'blue');
  await rafraf(page, 100);
  await page.screencast.stop();
  const videoFiles1 = fs.readdirSync(manualDir).filter(f => f.endsWith('.webm'));
  expect(videoFiles1).toHaveLength(1);

  await context.close();
  const videoFiles2 = fs.readdirSync(autoDir).filter(f => f.endsWith('.webm'));
  expect(videoFiles2).toHaveLength(1);
});

test('start should fail when another recording is in progress', async ({ page, trace }, testInfo) => {
  test.skip(trace === 'on', 'trace=on has different screencast image configuration');
  await page.screencast.start({ path: testInfo.outputPath('video.webm') });
  const error = await page.screencast.start({ path: testInfo.outputPath('video2.webm') }).catch(e => e);
  expect(error.message).toContain('Screencast is already started');
});

test('stop should not fail when no recording is in progress', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // stop() is a no-op when screencast is not started.
  await page.screencast.stop();
  await context.close();
});

test('start should finish when page is closed', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const videoPath = testInfo.outputPath('video.webm');
  await page.screencast.start({ path: videoPath, size: { width: 800, height: 800 } });
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await page.close();
  const error = await page.screencast.stop().catch(e => e);
  expect(error.message).toContain(kTargetClosedErrorMessage);
  await context.close();
});

test('empty video', async ({ browser }, testInfo) => {
  test.slow();
  const size = { width: 800, height: 800 };
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  const videoPath = testInfo.outputPath('empty-video.webm');
  await page.screencast.start({ path: videoPath, size });
  await page.screencast.stop();
  await context.close();
  expectFrames(videoPath, size, isAlmostWhite);
});

test('start dispose stops recording', async ({ browser }, testInfo) => {
  test.slow();
  const size = { width: 800, height: 800 };
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  const videoPath = testInfo.outputPath('dispose-video.webm');
  const disposable = await page.screencast.start({ path: videoPath, size });
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await disposable.dispose();
  expectRedFrames(videoPath, size);
  await context.close();
});

type Pixel = { r: number, g: number, b: number, alpha: number };
type PixelPredicate = (pixel: Pixel) => boolean;

function isAlmostWhite({ r, g, b, alpha }: Pixel): boolean {
  return r > 185 && g > 185 && b > 185 && alpha === 255;
}

function isAlmostRed({ r, g, b, alpha }: Pixel): boolean {
  return r > 185 && g < 70 && b < 70 && alpha === 255;
}

function findPixel(pixels: Buffer, pixelPredicate: PixelPredicate): Pixel|undefined {
  for (let i = 0, n = pixels.length; i < n; i += 4) {
    const pixel = {
      r: pixels[i],
      g: pixels[i + 1],
      b: pixels[i + 2],
      alpha: pixels[i + 3],
    };
    if (pixelPredicate(pixel))
      return pixel;
  }
  return undefined;
}

function expectAll(pixels: Buffer, pixelPredicate: PixelPredicate) {
  const badPixel = findPixel(pixels, pixel => !pixelPredicate(pixel));
  if (!badPixel)
    return;
  const rgba = [badPixel.r, badPixel.g, badPixel.b, badPixel.alpha].join(', ');
  throw new Error([
    `Expected all pixels to satisfy ${pixelPredicate.name}, found bad pixel (${rgba})`,
    `Actual pixels=[${pixels.join(',')}]`,
  ].join('\n'));
}

function expectRedFrames(videoFile: string, size: { width: number, height: number }) {
  expectFrames(videoFile, size, isAlmostRed);
}

function expectFrames(videoFile: string, size: { width: number, height: number }, pixelPredicate: PixelPredicate) {
  const videoPlayer = new VideoPlayer(videoFile);
  const duration = videoPlayer.duration;
  expect(duration).toBeGreaterThan(0);

  expect(videoPlayer.videoWidth).toBe(size.width);
  expect(videoPlayer.videoHeight).toBe(size.height);

  {
    const pixels = videoPlayer.seekLastFrame().data;
    expectAll(pixels, pixelPredicate);
  }
  {
    const pixels = videoPlayer.seekLastFrame({ x: size.width - 20, y: 10 }).data;
    expectAll(pixels, pixelPredicate);
  }
}

function jpegDimensions(buffer: Buffer): { width: number, height: number } {
  let i = 2; // skip SOI marker (FF D8)
  while (i < buffer.length - 8) {
    if (buffer[i] !== 0xFF)
      break;
    const marker = buffer[i + 1];
    const segmentLength = buffer.readUInt16BE(i + 2);
    // SOF markers: C0 (baseline), C2 (progressive), C1, C3, C5-C7, C9-CB, CD-CF
    if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7) ||
        (marker >= 0xC9 && marker <= 0xCB) || (marker >= 0xCD && marker <= 0xCF)) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      return { width, height };
    }
    i += 2 + segmentLength;
  }
  throw new Error('Could not parse JPEG dimensions');
}

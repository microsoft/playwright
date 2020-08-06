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

const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
const {mkdtempAsync, removeFolderAsync} = require('./utils');

const {FFOX, CHROMIUM, WEBKIT, MAC, LINUX, WIN, HEADLESS} = testOptions;

registerFixture('persistentDirectory', async ({}, test) => {
  const persistentDirectory = await mkdtempAsync(path.join(os.tmpdir(), 'playwright-test-'));
  try {
    await test(persistentDirectory);
  } finally {
    await removeFolderAsync(persistentDirectory);
  }
});

registerFixture('firefox', async ({playwright}, test) => {
  if (WEBKIT && !LINUX) {
    const firefox = await playwright.firefox.launch();
    try {
      await test(firefox);
    } finally {
      await firefox.close();
    }
  } else {
    await test(null);
  }
});

it.fail(CHROMIUM || (WEBKIT && WIN && HEADLESS))('should capture static page', async({page, persistentDirectory, firefox}) => {
  const videoFile = path.join(persistentDirectory, 'v.webm');
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await page._delegate.startVideoRecording({outputFile: videoFile, width: 640, height: 480});
  // TODO: in WebKit figure out why video size is not reported correctly for
  // static pictures.
  if (HEADLESS && WEBKIT)
    await page.setViewportSize({width: 1270, height: 950});
  await new Promise(r => setTimeout(r, 300));
  await page._delegate.stopVideoRecording();
  expect(fs.existsSync(videoFile)).toBe(true);

  if (WEBKIT && !LINUX) {
    // WebKit on Mac & Windows cannot replay webm/vp8 video, so we launch Firefox.
    const context = await firefox.newContext();
    page = await context.newPage();
  }

  await page.goto(url.pathToFileURL(videoFile).href);
  await page.$eval('video', v => {
    return new Promise(fulfil => {
      // In case video playback autostarts.
      v.pause();
      v.onplaying = fulfil;
      v.play();
    });
  });
  await page.$eval('video', v => {
    v.pause();
    const result = new Promise(f => v.onseeked = f);
    v.currentTime = v.duration - 0.01;
    return result;
  });

  const duration = await page.$eval('video', v => v.duration);
  expect(duration).toBeGreaterThan(0);
  const videoWidth = await page.$eval('video', v => v.videoWidth);
  expect(videoWidth).toBe(640);
  const videoHeight = await page.$eval('video', v => v.videoHeight);
  expect(videoHeight).toBe(480);

  const pixels = await page.$eval('video', (video, x) => {
    let canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0);
    const imgd = context.getImageData(x, 0, 10, 10);
    return Array.from(imgd.data);
    // TODO: we capture window frame in FF headful on Windows.
  }, FFOX && WIN && !HEADLESS ? 10 : 0);
  const expectAlmostRed = (i) => {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const alpha = pixels[i + 3];
    expect(r).toBeGreaterThan(240);
    expect(g).toBeLessThan(50);
    expect(b).toBeLessThan(50);
    expect(alpha).toBe(255);
  }
  try {
    for (var i = 0, n = pixels.length; i < n; i += 4)
      expectAlmostRed(i);
  } catch(e) {
    // Log pixel values on failure.
    console.log(pixels);
    throw e;
  }
});

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

import { expect, browserTest as test } from '../config/browserTest';
import { rafraf } from '../config/utils';

test.skip(({ mode }) => mode !== 'default', 'screencast is not available in remote mode');
test.skip(({ video }) => video === 'on', 'conflicts with built-in video recording');

test('screencast.start emits screencastframe events', async ({ browser, server, trace }) => {
  test.skip(trace === 'on', 'trace=on has different screencast image configuration');
  const context = await browser.newContext({ viewport: { width: 1000, height: 400 } });
  const page = await context.newPage();

  const frames: { data: Buffer }[] = [];
  page.screencast.on('screencastframe', frame => frames.push(frame));

  const maxSize = { width: 500, height: 400 };
  await page.screencast.start({ maxSize });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await page.screencast.stop();

  expect(frames.length).toBeGreaterThan(0);
  for (const frame of frames) {
    // Each frame must be a valid JPEG (starts with FF D8)
    expect(frame.data[0]).toBe(0xff);
    expect(frame.data[1]).toBe(0xd8);
    const { width, height } = jpegDimensions(frame.data);
    // Frame should be scaled down to fit the maximum size.
    expect(width).toBe(500);
    expect(height).toBe(200);
  }

  await context.close();
});

test('start throws if already running', async ({ browser, trace }) => {
  test.skip(trace === 'on', 'trace=on enables screencast with different options');

  const size = { width: 500, height: 400 };
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();

  await page.screencast.start({ maxSize: size });
  await expect(page.screencast.start({ maxSize: { width: 320, height: 240 } })).rejects.toThrow('Screencast is already running');

  await page.screencast.stop();
  await context.close();
});

test('start allows restart with different options after stop', async ({ browser, trace }) => {
  test.skip(trace === 'on', 'trace=on enables screencast with different options');

  const context = await browser.newContext({ viewport: { width: 500, height: 400 } });
  const page = await context.newPage();

  await page.screencast.start({ maxSize: { width: 500, height: 400 } });
  await page.screencast.stop();
  // Different options should succeed once the previous screencast is stopped.
  await page.screencast.start({ maxSize: { width: 320, height: 240 } });
  await page.screencast.stop();
  await context.close();
});

test('start throws when video recording is running with different params', async ({ browser, trace }) => {
  test.skip(trace === 'on', 'trace=on enables screencast with different options');

  const videoSize = { width: 500, height: 400 };
  const context = await browser.newContext({ viewport: videoSize });
  const page = await context.newPage();

  await page.video().start({ size: videoSize });
  await expect(page.screencast.start({ maxSize: { width: 320, height: 240 } })).rejects.toThrow('Screencast is already running with different options');

  await page.video().stop();
  await context.close();
});

test('video.start does not emit screencastframe events', async ({ page, server, trace }) => {
  test.skip(trace === 'on', 'trace=on enables screencast frame events');

  const frames = [];
  page.screencast.on('screencastframe', frame => frames.push(frame));

  await page.video().start({ size: { width: 320, height: 240 } });
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => document.body.style.backgroundColor = 'red');
  await rafraf(page, 100);
  await page.video().stop();

  expect(frames).toHaveLength(0);
});

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

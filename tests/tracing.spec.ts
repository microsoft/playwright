/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'path';
import { expect, contextTest as test, browserTest } from './config/browserTest';
import yauzl from 'yauzl';
import removeFolder from 'rimraf';
import jpeg from 'jpeg-js';

const traceDir = path.join(__dirname, '..', 'test-results', 'trace-' + process.env.FOLIO_WORKER_INDEX);
test.useOptions({ traceDir });

test.beforeEach(async ({ browserName, headless }) => {
  test.fixme(browserName === 'chromium' && !headless, 'Chromium screencast on headed has a min width issue');
  await new Promise(f => removeFolder(traceDir, f));
});

test('should collect trace', async ({ context, page, server, browserName }, testInfo) => {
  await (context as any).tracing.start({ name: 'test', screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await page.close();
  await (context as any).tracing.stop();
  await (context as any).tracing.export(testInfo.outputPath('trace.zip'));

  const { events } = await parseTrace(testInfo.outputPath('trace.zip'));
  expect(events[0].type).toBe('context-metadata');
  expect(events[1].type).toBe('page-created');
  expect(events.find(e => e.metadata?.apiName === 'page.goto')).toBeTruthy();
  expect(events.find(e => e.metadata?.apiName === 'page.setContent')).toBeTruthy();
  expect(events.find(e => e.metadata?.apiName === 'page.click')).toBeTruthy();
  expect(events.find(e => e.metadata?.apiName === 'page.close')).toBeTruthy();

  expect(events.some(e => e.type === 'frame-snapshot')).toBeTruthy();
  expect(events.some(e => e.type === 'resource-snapshot')).toBeTruthy();
  expect(events.some(e => e.type === 'screencast-frame')).toBeTruthy();
});

test('should collect trace', async ({ context, page, server }, testInfo) => {
  await (context as any).tracing.start({ name: 'test' });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await page.close();
  await (context as any).tracing.stop();
  await (context as any).tracing.export(testInfo.outputPath('trace.zip'));

  const { events } = await parseTrace(testInfo.outputPath('trace.zip'));
  expect(events.some(e => e.type === 'frame-snapshot')).toBeFalsy();
  expect(events.some(e => e.type === 'resource-snapshot')).toBeFalsy();
});

test('should collect two traces', async ({ context, page, server }, testInfo) => {
  await (context as any).tracing.start({ name: 'test1', screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await (context as any).tracing.stop();
  await (context as any).tracing.export(testInfo.outputPath('trace1.zip'));

  await (context as any).tracing.start({ name: 'test2', screenshots: true, snapshots: true });
  await page.dblclick('"Click"');
  await page.close();
  await (context as any).tracing.stop();
  await (context as any).tracing.export(testInfo.outputPath('trace2.zip'));

  {
    const { events } = await parseTrace(testInfo.outputPath('trace1.zip'));
    expect(events[0].type).toBe('context-metadata');
    expect(events[1].type).toBe('page-created');
    expect(events.find(e => e.metadata?.apiName === 'page.goto')).toBeTruthy();
    expect(events.find(e => e.metadata?.apiName === 'page.setContent')).toBeTruthy();
    expect(events.find(e => e.metadata?.apiName === 'page.click')).toBeTruthy();
    expect(events.find(e => e.metadata?.apiName === 'page.dblclick')).toBeFalsy();
    expect(events.find(e => e.metadata?.apiName === 'page.close')).toBeFalsy();
  }

  {
    const { events } = await parseTrace(testInfo.outputPath('trace2.zip'));
    expect(events[0].type).toBe('context-metadata');
    expect(events[1].type).toBe('page-created');
    expect(events.find(e => e.metadata?.apiName === 'page.goto')).toBeFalsy();
    expect(events.find(e => e.metadata?.apiName === 'page.setContent')).toBeFalsy();
    expect(events.find(e => e.metadata?.apiName === 'page.click')).toBeFalsy();
    expect(events.find(e => e.metadata?.apiName === 'page.dblclick')).toBeTruthy();
    expect(events.find(e => e.metadata?.apiName === 'page.close')).toBeTruthy();
  }
});

for (const params of [
  {
    id: 'fit',
    width: 500,
    height: 500,
  },
  {
    id: 'crop',
    width: 400, // Less than 450 to test firefox
    height: 800,
  },
  {
    id: 'scale',
    width: 1024,
    height: 768,
  }
]) {
  browserTest(`should produce screencast frames ${params.id}`, async ({ video, contextFactory, browserName, platform }, testInfo) => {
    browserTest.fixme(browserName === 'chromium' && video, 'Same screencast resolution conflicts');
    browserTest.fixme(params.id === 'fit' && browserName === 'chromium' && platform === 'darwin', 'High DPI maxes image at 600x600');

    const scale = Math.min(800 / params.width, 600 / params.height, 1);
    const previewWidth = params.width * scale;
    const previewHeight = params.height * scale;

    const context = await contextFactory({ viewport: { width: params.width, height: params.height }});
    await (context as any).tracing.start({ name: 'test', screenshots: true, snapshots: true });
    const page = await context.newPage();
    // Make sure we have a chance to paint.
    for (let i = 0; i < 10; ++i) {
      await page.setContent('<body style="box-sizing: border-box; width: 100%; height: 100%; margin:0; background: red; border: 50px solid blue"></body>');
      await page.evaluate(() => new Promise(requestAnimationFrame));
    }
    await (context as any).tracing.stop();
    await (context as any).tracing.export(testInfo.outputPath('trace.zip'));

    const { events, resources } = await parseTrace(testInfo.outputPath('trace.zip'));
    const frames = events.filter(e => e.type === 'screencast-frame');

    // Check all frame sizes.
    for (const frame of frames) {
      expect(frame.width).toBe(params.width);
      expect(frame.height).toBe(params.height);
      const buffer = resources.get('resources/' + frame.sha1);
      const image = jpeg.decode(buffer);
      expect(image.width).toBe(previewWidth);
      expect(image.height).toBe(previewHeight);
    }

    const frame = frames[frames.length - 1]; // pick last frame.
    const buffer = resources.get('resources/' + frame.sha1);
    const image = jpeg.decode(buffer);
    expect(image.data.byteLength).toBe(previewWidth * previewHeight * 4);
    expectRed(image.data, previewWidth * previewHeight * 4 / 2 + previewWidth * 4 / 2); // center is red
    expectBlue(image.data, previewWidth * 5 * 4 + previewWidth * 4 / 2); // top
    expectBlue(image.data, previewWidth * (previewHeight - 5) * 4 + previewWidth * 4 / 2); // bottom
    expectBlue(image.data, previewWidth * previewHeight * 4 / 2 + 5 * 4); // left
    expectBlue(image.data, previewWidth * previewHeight * 4 / 2 + (previewWidth - 5) * 4); // right
  });
}

async function parseTrace(file: string): Promise<{ events: any[], resources: Map<string, Buffer> }> {
  const entries = await new Promise<any[]>(f => {
    const entries: Promise<any>[] = [];
    yauzl.open(file, (err, zipFile) => {
      zipFile.on('entry', entry => {
        const entryPromise = new Promise(ff => {
          zipFile.openReadStream(entry, (err, readStream) => {
            const buffers = [];
            if (readStream) {
              readStream.on('data', d => buffers.push(d));
              readStream.on('end', () => ff({ name: entry.fileName, buffer: Buffer.concat(buffers) }));
            } else {
              ff({ name: entry.fileName });
            }
          });
        });
        entries.push(entryPromise);
      });
      zipFile.on('end', () => f(entries));
    });
  });
  const resources = new Map<string, Buffer>();
  for (const { name, buffer } of await Promise.all(entries))
    resources.set(name, buffer);
  const events = resources.get('trace.trace').toString().split('\n').map(line => line ? JSON.parse(line) : false).filter(Boolean);
  return {
    events,
    resources,
  };
}

function expectRed(pixels: Buffer, offset: number) {
  const r = pixels.readUInt8(offset);
  const g = pixels.readUInt8(offset + 1);
  const b = pixels.readUInt8(offset + 2);
  const a = pixels.readUInt8(offset + 3);
  expect(r).toBeGreaterThan(200);
  expect(g).toBeLessThan(70);
  expect(b).toBeLessThan(70);
  expect(a).toBe(255);
}

function expectBlue(pixels: Buffer, offset: number) {
  const r = pixels.readUInt8(offset);
  const g = pixels.readUInt8(offset + 1);
  const b = pixels.readUInt8(offset + 2);
  const a = pixels.readUInt8(offset + 3);
  expect(r).toBeLessThan(70);
  expect(g).toBeLessThan(70);
  expect(b).toBeGreaterThan(200);
  expect(a).toBe(255);
}

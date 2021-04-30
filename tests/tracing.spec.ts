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
import { expect, tracingTest as test } from './config/browserTest';
import yauzl from 'yauzl';
import removeFolder from 'rimraf';

test.beforeEach(async ({}, testInfo) => {
  const folder = path.join(testInfo.config.outputDir, 'trace-' + process.env.FOLIO_WORKER_INDEX);
  await new Promise(f => removeFolder(folder, f));
});

test('should collect trace', async ({ context, page, server, browserName }, testInfo) => {
  await (context as any)._tracing.start({ name: 'test', screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await page.close();
  await (context as any)._tracing.stop();
  await (context as any)._tracing.export(testInfo.outputPath('trace.zip'));

  const { events } = await parseTrace(testInfo.outputPath('trace.zip'));
  expect(events[0].type).toBe('context-metadata');
  expect(events[1].type).toBe('page-created');
  expect(events.find(e => e.metadata?.apiName === 'page.goto')).toBeTruthy();
  expect(events.find(e => e.metadata?.apiName === 'page.setContent')).toBeTruthy();
  expect(events.find(e => e.metadata?.apiName === 'page.click')).toBeTruthy();
  expect(events.find(e => e.metadata?.apiName === 'page.close')).toBeTruthy();

  expect(events.some(e => e.type === 'frame-snapshot')).toBeTruthy();
  expect(events.some(e => e.type === 'resource-snapshot')).toBeTruthy();
  if (browserName === 'chromium')
    expect(events.some(e => e.type === 'screencast-frame')).toBeTruthy();
});

test('should collect trace', async ({ context, page, server }, testInfo) => {
  await (context as any)._tracing.start({ name: 'test' });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await page.close();
  await (context as any)._tracing.stop();
  await (context as any)._tracing.export(testInfo.outputPath('trace.zip'));

  const { events } = await parseTrace(testInfo.outputPath('trace.zip'));
  expect(events.some(e => e.type === 'frame-snapshot')).toBeFalsy();
  expect(events.some(e => e.type === 'resource-snapshot')).toBeFalsy();
});

test('should collect two traces', async ({ context, page, server }, testInfo) => {
  await (context as any)._tracing.start({ name: 'test1', screenshots: true, snapshots: true });
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<button>Click</button>');
  await page.click('"Click"');
  await (context as any)._tracing.stop();
  await (context as any)._tracing.export(testInfo.outputPath('trace1.zip'));

  await (context as any)._tracing.start({ name: 'test2', screenshots: true, snapshots: true });
  await page.dblclick('"Click"');
  await page.close();
  await (context as any)._tracing.stop();
  await (context as any)._tracing.export(testInfo.outputPath('trace2.zip'));

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
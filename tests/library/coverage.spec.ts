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

import { browserTest as it, expect } from '../config/browserTest';
import { parseTraceRaw } from '../config/utils';

const fileCoverage = (file: string, s0: number) => ({
  [file]: {
    path: file,
    statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } } },
    fnMap: {},
    branchMap: {},
    s: { '0': s0 },
    f: {},
    b: {},
  },
});

const coverageScript = (file: string, s0: number) => `<script>window.__coverage__ = ${JSON.stringify(fileCoverage(file, s0))}</script>`;

async function readCoverage(traceFile: string): Promise<any> {
  const { resources } = await parseTraceRaw(traceFile);
  const entry = resources.get('coverage.json');
  return entry ? JSON.parse(entry.toString()) : undefined;
}

it('should collect istanbul coverage into the trace', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });

  const page = await context.newPage();
  await page.setContent(coverageScript('a.js', 3));
  await context.tracing.flushCoverage();

  // Coverage of a closed page is collected automatically.
  const page2 = await context.newPage();
  await page2.setContent(coverageScript('b.js', 2));
  await page2.close();

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await readCoverage(traceFile);
  expect(data['a.js'].s['0']).toBe(3);
  expect(data['b.js'].s['0']).toBe(2);
});

it('should collect coverage per trace chunk', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();

  await page.setContent(coverageScript('a.js', 5));
  const traceFile1 = testInfo.outputPath('trace1.zip');
  await context.tracing.stopChunk({ path: traceFile1 });

  await context.tracing.startChunk();
  await page.setContent(coverageScript('b.js', 7));
  const traceFile2 = testInfo.outputPath('trace2.zip');
  await context.tracing.stopChunk({ path: traceFile2 });

  await context.tracing.stop();
  await context.close();

  const data1 = await readCoverage(traceFile1);
  expect(data1['a.js'].s['0']).toBe(5);
  expect(data1['b.js']).toBe(undefined);

  const data2 = await readCoverage(traceFile2);
  expect(data2['b.js'].s['0']).toBe(7);
  expect(data2['a.js']).toBe(undefined);
});

it('should report maps once and counters incrementally', async ({ browser }) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.setContent(coverageScript('a.js', 3));

  const collect = () => page.evaluate(() => (window as any).__pwCoverageCollect().map((json: string) => JSON.parse(json)));

  const first = await collect();
  expect(first[0].data['a.js'].statementMap).toBeTruthy();
  expect(first[0].data['a.js'].s).toEqual({ '0': 3 });

  // Nothing was hit since the last report.
  expect(await collect()).toEqual([]);

  await page.evaluate(() => (window as any).__coverage__['a.js'].s['0'] += 2);
  const third = await collect();
  expect(third[0].data['a.js'].statementMap).toBe(undefined);
  expect(third[0].data['a.js'].s).toEqual({ '0': 2 });

  await context.tracing.stop();
  await context.close();
});

it('should accumulate counters across flushes and keep never hit files', async ({ browser }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.setContent(coverageScript('a.js', 0));
  await context.tracing.flushCoverage();
  await page.evaluate(() => (window as any).__coverage__['a.js'].s['0'] += 4);
  await context.tracing.flushCoverage();
  await page.evaluate(() => (window as any).__coverage__['a.js'].s['0'] += 3);

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await readCoverage(traceFile);
  expect(data['a.js'].s['0']).toBe(7);
  expect(Object.keys(data['a.js'].statementMap)).toEqual(['0']);
});

it('should collect coverage of a page closed by in-page script', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.EMPTY_PAGE),
  ]);
  await popup.evaluate(coverage => (window as any).__coverage__ = JSON.parse(coverage), JSON.stringify(fileCoverage('popup.js', 5)));
  // The popup closes itself, so its counters are only preserved by the stash.
  await popup.evaluate(() => setTimeout(() => window.close(), 0));
  await popup.waitForEvent('close');

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await readCoverage(traceFile);
  expect(data['popup.js'].s['0']).toBe(5);
});

it('should not double count a stash picked up twice', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.EMPTY_PAGE),
  ]);
  await popup.evaluate(coverage => (window as any).__coverage__ = JSON.parse(coverage), JSON.stringify(fileCoverage('popup.js', 5)));
  await popup.evaluate(() => setTimeout(() => window.close(), 0));
  await popup.waitForEvent('close');

  // Emulate two documents picking up the same stash before either removes it.
  const copied = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('__pwCoverage.'))!;
    localStorage.setItem(key + '.copy', localStorage.getItem(key)!);
    return Object.keys(localStorage).filter(key => key.startsWith('__pwCoverage.')).length;
  });
  expect(copied).toBe(2);

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await readCoverage(traceFile);
  expect(data['popup.js'].s['0']).toBe(5);
});

it('should discard stashes of other sessions', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(coverage => {
    localStorage.setItem('__pwCoverage.other-session.1', JSON.stringify({ id: 'other', data: JSON.parse(coverage) }));
  }, JSON.stringify(fileCoverage('stale.js', 7)));

  await context.tracing.flushCoverage();
  const remaining = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('__pwCoverage.')));
  expect(remaining).toEqual([]);

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await readCoverage(traceFile);
  expect(data['stale.js']).toBe(undefined);
});

it('should collect coverage of an origin left without a page', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(coverage => (window as any).__coverage__ = JSON.parse(coverage), JSON.stringify(fileCoverage('opener.js', 2)));

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.EMPTY_PAGE),
  ]);
  await popup.evaluate(coverage => (window as any).__coverage__ = JSON.parse(coverage), JSON.stringify(fileCoverage('popup.js', 5)));
  await popup.evaluate(() => setTimeout(() => window.close(), 0));
  await popup.waitForEvent('close');

  // Leave the origin of the stashes without a page to relay them.
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await readCoverage(traceFile);
  expect(data['popup.js'].s['0']).toBe(5);
  expect(data['opener.js'].s['0']).toBe(2);
});

it('should throw when flushing without coverage', async ({ browser }) => {
  const context = await browser.newContext();
  await context.newPage();
  await expect(context.tracing.flushCoverage()).rejects.toThrow('Coverage collection has not been started');
  await context.close();
});

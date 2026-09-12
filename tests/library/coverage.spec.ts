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
import { parseTraceCoverage } from '../config/utils';

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

  const data = await parseTraceCoverage(traceFile);
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

  const data1 = await parseTraceCoverage(traceFile1);
  expect(data1['a.js'].s['0']).toBe(5);
  expect(data1['b.js']).toBe(undefined);

  const data2 = await parseTraceCoverage(traceFile2);
  expect(data2['b.js'].s['0']).toBe(7);
  expect(data2['a.js']).toBe(undefined);
});

it('should report maps once and counters incrementally', async ({ browser, server }) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  // Actions collect the counters on their own, so hit and collect in one evaluate.
  const first = await page.evaluate(coverage => {
    (window as any).__coverage__ = JSON.parse(coverage);
    return (window as any).__pwCoverageCollect().map((json: string) => JSON.parse(json));
  }, JSON.stringify(fileCoverage('a.js', 3)));
  expect(first[0].data['a.js'].statementMap).toBeTruthy();
  expect(first[0].data['a.js'].s).toEqual({ '0': 3 });

  const second = await page.evaluate(() => {
    (window as any).__coverage__['a.js'].s['0'] += 2;
    return (window as any).__pwCoverageCollect().map((json: string) => JSON.parse(json));
  });
  expect(second[0].data['a.js'].statementMap).toBe(undefined);
  expect(second[0].data['a.js'].s).toEqual({ '0': 2 });

  // Nothing was hit since the last report.
  expect(await page.evaluate(() => (window as any).__pwCoverageCollect())).toEqual([]);

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

  const data = await parseTraceCoverage(traceFile);
  expect(data['a.js'].s['0']).toBe(7);
  expect(Object.keys(data['a.js'].statementMap)).toEqual(['0']);
});

async function openPopup(page: any, server: any, file: string, s0: number) {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(url => window.open(url), server.EMPTY_PAGE),
  ]);
  await popup.evaluate(coverage => (window as any).__coverage__ = JSON.parse(coverage), JSON.stringify(fileCoverage(file, s0)));
  return popup;
}

it('should collect coverage of a page closed by in-page script', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const popup = await openPopup(page, server, 'popup.js', 5);
  // An in-page close never reaches Playwright as page.close(), the counters
  // are preserved because the actions collect them as they go.
  await Promise.all([
    popup.waitForEvent('close'),
    popup.evaluate(() => setTimeout(() => window.close(), 0)),
  ]);

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await parseTraceCoverage(traceFile);
  expect(data['popup.js'].s['0']).toBe(5);
});

it('should not double count a stash picked up twice', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  // Emulate two documents picking up the same stash before either removes it.
  const prefix = '__pwCoverage.' + (context as any)._guid + '.';
  await page.evaluate(({ prefix, coverage }) => {
    const chunk = JSON.stringify({ id: 'stash-id', data: JSON.parse(coverage) });
    localStorage.setItem(prefix + 'one', chunk);
    localStorage.setItem(prefix + 'two', chunk);
  }, { prefix, coverage: JSON.stringify(fileCoverage('stashed.js', 4)) });

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await parseTraceCoverage(traceFile);
  expect(data['stashed.js'].s['0']).toBe(4);
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

  // The stale stash was the only coverage, so nothing was collected at all.
  expect(await parseTraceCoverage(traceFile)).toBe(undefined);
});

it('should collect coverage of an origin left without a page', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);

  const popup = await openPopup(page, server, 'popup.js', 0);
  await context.tracing.flushCoverage();

  // The popup is hit and navigates away, leaving a stash behind.
  await popup.evaluate(url => {
    (window as any).__coverage__['popup.js'].s['0'] = 5;
    window.location.href = url;
  }, server.CROSS_PROCESS_PREFIX + '/empty.html');
  // Leave the origin of the stash without a page to relay it.
  await page.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await parseTraceCoverage(traceFile);
  expect(data['popup.js'].s['0']).toBe(5);
});

it('should pull counters as the actions go', async ({ browser, server }, testInfo) => {
  const context = await browser.newContext();
  await context.tracing.start({ coverage: true });
  const page = await context.newPage();
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(coverage => (window as any).__coverage__ = JSON.parse(coverage), JSON.stringify(fileCoverage('a.js', 3)));

  await page.click('body');
  // The counters are collected by the actions themselves, not only by the flush.
  expect(await page.evaluate(() => (window as any).__coverage__['a.js'].s['0'])).toBe(0);

  const traceFile = testInfo.outputPath('trace.zip');
  await context.tracing.stop({ path: traceFile });
  await context.close();

  const data = await parseTraceCoverage(traceFile);
  expect(data['a.js'].s['0']).toBe(3);
});

it('should throw when flushing without coverage', async ({ browser }) => {
  const context = await browser.newContext();
  await context.newPage();
  await expect(context.tracing.flushCoverage()).rejects.toThrow('Coverage collection has not been started');
  await context.close();
});

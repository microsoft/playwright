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

const coverageScript = (file: string, s0: number) => {
  const fileCov = {
    path: file,
    statementMap: { '0': { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } } },
    fnMap: {},
    branchMap: {},
    s: { '0': s0 },
    f: {},
    b: {},
  };
  return `<script>window.__coverage__ = ${JSON.stringify({ [file]: fileCov })}</script>`;
};

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

it('should throw when flushing without coverage', async ({ browser }) => {
  const context = await browser.newContext();
  await context.newPage();
  await expect(context.tracing.flushCoverage()).rejects.toThrow('Coverage collection has not been started');
  await context.close();
});

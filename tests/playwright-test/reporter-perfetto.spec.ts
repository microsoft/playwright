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

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { test, expect } from './playwright-test-fixtures';

type TraceEvent = {
  name: string;
  cat: string;
  ph: 'X' | 'M' | 'i';
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
  cname?: string;
  args?: any;
};

function readTrace(baseDir: string, fileName: string = 'test-results/perfetto.json') {
  const file = path.join(baseDir, fileName);
  const content = fileName.endsWith('.gz') ? zlib.gunzipSync(fs.readFileSync(file)).toString('utf8') : fs.readFileSync(file, 'utf8');
  return JSON.parse(content) as {
    traceEvents: TraceEvent[],
    displayTimeUnit: string,
    metadata: any,
  };
}

function slices(events: TraceEvent[]) {
  return events.filter(e => e.ph === 'X');
}

function threadNames(events: TraceEvent[]) {
  return events.filter(e => e.ph === 'M' && e.name === 'thread_name').map(e => e.args.name);
}

function findSlice(events: TraceEvent[], name: string) {
  return slices(events).find(e => e.name === name);
}

const testFiles = {
  'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test.beforeAll(async () => {});
    test.beforeEach(async () => {});
    test.describe('suite', () => {
      test('passing @smoke', { annotation: { type: 'issue', description: 'flaky' } }, async ({}) => {
        console.log('hello from the test');
        await test.step('outer', async () => {
          await test.step('inner', async () => {
            expect(1).toBe(1);
          });
        });
      });
    });
    test('failing', async ({}) => {
      expect(1).toBe(2);
    });
  `,
};

test('should write a perfetto report', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest(testFiles, { reporter: 'perfetto' });
  expect(result.exitCode).toBe(1);

  const report = readTrace(testInfo.outputPath());
  expect(report.displayTimeUnit).toBe('ms');
  expect(report.metadata.status).toBe('failed');

  const events = report.traceEvents;
  expect(events.filter(e => e.ph === 'M' && e.name === 'process_name')[0].args.name).toBe('Playwright Test');
  expect(threadNames(events)).toEqual(['Worker 0']);

  const passing = findSlice(events, 'passing @smoke')!;
  expect(passing.cat).toBe('test');
  expect(passing.cname).toBe('good');
  expect(passing.dur).toBeGreaterThan(0);
  expect(passing.args).toEqual(expect.objectContaining({
    status: 'passed',
    expectedStatus: 'passed',
    title: 'suite › passing @smoke',
    workerIndex: 0,
    parallelIndex: 0,
    timeout: 30000,
    tags: '@smoke',
    annotations: ['issue: flaky'],
    stdout: 'hello from the test\n',
  }));
  expect(passing.args.location).toContain('a.test.ts:');

  const failing = findSlice(events, 'failing')!;
  expect(failing.cname).toBe('bad');
  expect(failing.args.status).toBe('failed');
  expect(failing.args.errors[0]).toContain('expect(received).toBe(expected)');

  // Hooks, fixtures and steps are all rendered as slices.
  expect(findSlice(events, 'Before Hooks')!.cat).toBe('hook');
  expect(findSlice(events, 'beforeAll hook')!.cat).toBe('hook');
  expect(findSlice(events, 'beforeEach hook')!.cat).toBe('hook');
  expect(findSlice(events, 'After Hooks')!.cat).toBe('hook');
  expect(findSlice(events, 'Expect "toBe"')!.cat).toBe('expect');

  const outer = findSlice(events, 'outer')!;
  expect(outer.cat).toBe('test.step');
  expect(outer.args.location).toContain('a.test.ts:');
});

test('should nest steps within the test slice', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest(testFiles, { reporter: 'perfetto' });
  expect(result.exitCode).toBe(1);

  const events = slices(readTrace(testInfo.outputPath()).traceEvents);
  // Complete events on the same thread must form a proper stack.
  const byThread = new Map<number, TraceEvent[]>();
  for (const event of events) {
    let list = byThread.get(event.tid);
    if (!list) {
      list = [];
      byThread.set(event.tid, list);
    }
    list.push(event);
  }
  for (const list of byThread.values()) {
    list.sort((a, b) => a.ts - b.ts || b.dur! - a.dur!);
    const stack: TraceEvent[] = [];
    for (const event of list) {
      while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur! <= event.ts)
        stack.pop();
      if (stack.length) {
        const parent = stack[stack.length - 1];
        expect(event.ts + event.dur!, `${event.name} inside ${parent.name}`).toBeLessThanOrEqual(parent.ts + parent.dur!);
      }
      stack.push(event);
    }
  }

  const outer = findSlice(events, 'outer')!;
  const inner = findSlice(events, 'inner')!;
  expect(inner.ts).toBeGreaterThanOrEqual(outer.ts);
  expect(inner.ts + inner.dur!).toBeLessThanOrEqual(outer.ts + outer.dur!);
});

test('should use a lane per worker', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => { await new Promise(f => setTimeout(f, 500)); });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('two', async ({}) => { await new Promise(f => setTimeout(f, 500)); });
    `,
  }, { reporter: 'perfetto', workers: 2 });
  expect(result.exitCode).toBe(0);

  const events = readTrace(testInfo.outputPath()).traceEvents;
  expect(threadNames(events)).toEqual(['Worker 0', 'Worker 1']);
  expect(findSlice(events, 'one')!.tid).not.toBe(findSlice(events, 'two')!.tid);
});

test('should report attachment files', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import fs from 'fs';
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => {
        const file = test.info().outputPath('note.txt');
        fs.writeFileSync(file, 'hello');
        await test.info().attach('inline', { body: 'body' });
        await test.info().attach('file', { path: file });
      });
    `,
  }, { reporter: 'perfetto' });
  expect(result.exitCode).toBe(0);

  const one = findSlice(readTrace(testInfo.outputPath()).traceEvents, 'one')!;
  expect(one.args.attachments).toEqual(['inline', expect.stringMatching(/^test-results\/a-one\/attachments\/file-.*\.txt$/)]);
});

test('should report step params', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({ page }) => {
        await page.goto('about:blank');
        await page.setContent('<button>Click me</button>');
        await page.getByRole('button').click();
        await expect(page.getByRole('button')).toBeVisible();
        await test.step('my step', async () => {}, { params: { foo: 'bar', count: 7 } });
      });
    `,
  }, { reporter: 'perfetto' });
  expect(result.exitCode).toBe(0);

  const events = slices(readTrace(testInfo.outputPath()).traceEvents);
  expect(findSlice(events, 'Navigate about:blank')!.args.params).toEqual({ url: 'about:blank' });
  expect(findSlice(events, 'Set content')!.args.params).toBe(undefined);
  expect(findSlice(events, `Click getByRole('button')`)!.args.params).toEqual({ locator: `getByRole('button')` });
  expect(findSlice(events, `Expect "toBeVisible" getByRole('button')`)!.args.params).toEqual({ locator: `getByRole('button')` });
  expect(findSlice(events, 'my step')!.args.params).toEqual({ foo: 'bar', count: 7 });
});

test('should respect outputFile option', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { reporter: [['perfetto', { outputFile: 'reports/my-trace.json' }]] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(findSlice(readTrace(testInfo.outputPath(), 'reports/my-trace.json').traceEvents, 'one')).toBeTruthy();
});

test('should gzip the report when output file ends with .gz', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { reporter: [['perfetto', { outputFile: 'perfetto.json.gz' }]] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);

  const gzipped = fs.readFileSync(testInfo.outputPath('perfetto.json.gz'));
  expect(gzipped.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
  expect(findSlice(readTrace(testInfo.outputPath(), 'perfetto.json.gz').traceEvents, 'one')).toBeTruthy();
});

test('should respect PLAYWRIGHT_PERFETTO_OUTPUT_FILE', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => {});
    `,
  }, { reporter: 'perfetto' }, { PLAYWRIGHT_PERFETTO_OUTPUT_FILE: testInfo.outputPath('env-trace.json') });
  expect(result.exitCode).toBe(0);
  expect(findSlice(readTrace(testInfo.outputPath(), 'env-trace.json').traceEvents, 'one')).toBeTruthy();
});

test('should report retries as separate slices', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('flaky', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { reporter: 'perfetto', retries: 1 });
  expect(result.exitCode).toBe(0);

  const flaky = slices(readTrace(testInfo.outputPath()).traceEvents).filter(e => e.name === 'flaky');
  expect(flaky).toHaveLength(2);
  expect(flaky.map(e => e.args.status)).toEqual(['failed', 'passed']);
  expect(flaky[1].args.retry).toBe(1);
});

test('should report global errors as instant events', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => {});
    `,
    'b.test.ts': `
      throw new Error('Oh my!');
    `,
  }, { reporter: 'perfetto' });
  expect(result.exitCode).toBe(1);

  const errors = readTrace(testInfo.outputPath()).traceEvents.filter(e => e.ph === 'i');
  expect(errors).toHaveLength(1);
  expect(errors[0].args.error).toContain('Oh my!');
});

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
import { test, expect } from './playwright-test-fixtures';
import { Reporter, FullConfig, Suite, TestCase, TestResult } from 'packages/playwright-test/reporter';

test('plan runs between project setup and onBegin, sees the .only-narrowed corpus, and can skip tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          console.log('%% plan: ' + suite.allTests().map(t => t.title).join(','));
          for (const t of suite.allTests())
            if (t.title.includes('skip-me')) t.skip('planned skip');
        }
        onBegin(config, suite) {
          console.log('%% onBegin: ' + suite.allTests().map(t => t.title).join(','));
        }
        onTestEnd(test, result) {
          console.log('%% end ' + test.title + ' status=' + result.status + ' expected=' + test.expectedStatus + ' ann=' + test.annotations.map(a => a.type + ':' + (a.description || '')).join(','));
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('ignored-by-only', async () => {});
      test.only('run-me', async () => {});
      test.only('skip-me', async () => { throw new Error('should not run'); });
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'plan: run-me,skip-me',
    'onBegin: run-me,skip-me',
    'end run-me status=passed expected=passed ann=',
    'end skip-me status=skipped expected=skipped ann=skip:planned skip',
  ]);
});

test('TestCase.exclude removes test from run and report', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          for (const t of suite.allTests())
            if (t.title === 'excluded') t.exclude();
        }
        onBegin(config, suite) {
          console.log('%% begin: ' + suite.allTests().map(t => t.title).join(','));
        }
        onTestEnd(test, result) {
          console.log('%% ran ' + test.title);
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('kept', async () => {});
      test('excluded', async () => { throw new Error('should not run'); });
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'begin: kept',
    'ran kept',
  ]);
});

test('Suite.skip cascades to all descendants', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          const visit = (s) => {
            if (s.title === 'doomed') s.skip('whole group');
            for (const child of s.suites || []) visit(child);
          };
          visit(suite);
        }
        onTestEnd(test, result) {
          console.log('%% ' + test.title + ':' + result.status + ':' + test.expectedStatus);
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('doomed', () => {
        test('one', async () => { throw new Error('nope'); });
        test('two', async () => { throw new Error('nope'); });
      });
      test('keep', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines.sort()).toEqual([
    'keep:passed:passed',
    'one:skipped:skipped',
    'two:skipped:skipped',
  ]);
});

test('disposition methods throw when called outside preprocessSuite', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        onBegin(config, suite) {
          try {
            suite.allTests()[0].exclude();
            console.log('%% no-throw');
          } catch (e) {
            console.log('%% threw: ' + e.message);
          }
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('t', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toContain('threw: TestCase.exclude() can only be called from Reporter.preprocessSuite().');
});

test('plan throwing aborts the run before onBegin', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          throw new Error('plan-aborted');
        }
        onBegin(config, suite) {
          console.log('%% onBegin: ' + suite.allTests().length);
        }
        onError(err) {
          console.log('%% error: ' + err.message);
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).not.toBe(0);
  expect(result.outputLines).toContain('error: Error: plan-aborted');
  // Synthetic empty-suite onBegin is OK; the real onBegin (size 1) must NOT happen.
  expect(result.outputLines).not.toContain('onBegin: 1');
});

test('multiple reporters: plan called in order, annotations accumulate, exclude prunes for next reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'first.ts': `
      class R {
        async preprocessSuite(config, suite) {
          console.log('%% first plan sees: ' + suite.allTests().map(t => t.title).join(','));
          for (const t of suite.allTests()) {
            if (t.title === 'gone') t.exclude();
            else t.fail('first reason');
          }
        }
        onTestEnd(test, result) {
          console.log('%% first onTestEnd: ' + test.expectedStatus + ' ann=' + test.annotations.map(a => a.type).join(','));
        }
      }
      module.exports = R;
    `,
    'second.ts': `
      class R {
        async preprocessSuite(config, suite) {
          console.log('%% second plan sees: ' + suite.allTests().map(t => t.title).join(','));
          suite.allTests()[0].skip('second reason');
        }
      }
      module.exports = R;
    `,
    'playwright.config.ts': `module.exports = { reporter: [['./first.ts'], ['./second.ts']] };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('kept', async () => {});
      test('gone', async () => { throw new Error('should not run'); });
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  // skip beats fail in expectedStatus, both annotations accumulate.
  expect(result.outputLines).toEqual([
    'first plan sees: kept,gone',
    'second plan sees: kept',
    'first onTestEnd: skipped ann=fail,skip',
  ]);
});

test('implementsSharding disables built-in shard filter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class R {
        async preprocessSuite(config, suite) {
          let i = 0;
          for (const t of suite.allTests()) {
            if (i++ % 2 === 1) t.exclude();
          }
          return { implementsSharding: true };
        }
        onBegin(config, suite) {
          console.log('%% begin: ' + suite.allTests().map(t => t.title).join(','));
        }
      }
      module.exports = R;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts', shard: { current: 1, total: 2 } };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      for (let i = 0; i < 4; i++)
        test('t' + i, async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  // Reporter sees all 4 tests and excludes every other → t0, t2 kept.
  // Built-in shard would have produced a different split (e.g. t0, t1) and
  // would further reduce the corpus; the assertion proves it did not run.
  expect(result.outputLines).toEqual(['begin: t0,t2']);
});

test('multiple reporters declaring implementsSharding throws', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter-a.ts': `
      class A {
        preprocessSuite() { return { implementsSharding: true }; }
        onError(err) { console.log('%% error: ' + err.message); }
      }
      module.exports = A;
    `,
    'reporter-b.ts': `
      class B { preprocessSuite() { return { implementsSharding: true }; } }
      module.exports = B;
    `,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter-a.ts'], ['./reporter-b.ts']] };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('t', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).not.toBe(0);
  expect(result.outputLines.join('\n')).toContain(`Multiple reporters declare 'implementsSharding'`);
});

test('plan.suite contains only top-level projects, not dependency/setup projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          // The suite only exposes top-level projects, so a reporter has no handle on
          // setup/dependency project tests and therefore cannot exclude them.
          console.log('%% plan projects: ' + suite.suites.map(s => s.title).join(','));
          console.log('%% plan tests: ' + suite.allTests().map(t => t.title).join(','));
        }
        onTestEnd(test, result) {
          console.log('%% ran ' + test.parent.project().name + '/' + test.title);
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter.ts',
        projects: [
          { name: 'setup', testMatch: /a\\.setup\\.ts/ },
          { name: 'main', testMatch: /a\\.test\\.ts/, dependencies: ['setup'] },
        ],
      };
    `,
    'a.setup.ts': `
      import { test } from '@playwright/test';
      test('setup-test', async () => {});
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('main-test', async () => {});
    `,
  }, { reporter: '', workers: 1 }, undefined, { additionalArgs: ['--project=main'] });

  expect(result.exitCode).toBe(0);
  // plan only sees the top-level 'main' project; the 'setup' dependency is prepended afterwards.
  expect(result.outputLines).toContain('plan projects: main');
  // 'setup-test' is absent from the plan suite, proving setup/dependency tests are not exposed.
  expect(result.outputLines).toContain('plan tests: main-test');
  // Both the dependency and the main project still run.
  expect(result.outputLines).toContain('ran setup/setup-test');
  expect(result.outputLines).toContain('ran main/main-test');
});

test('plan.suite respects --grep filtering', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          console.log('%% plan: ' + suite.allTests().map(t => t.title).join(','));
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('foo-one', async () => {});
      test('bar-two', async () => {});
    `,
  }, { reporter: '', workers: 1, grep: 'foo' });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['plan: foo-one']);
});

test('plan.suite respects --project filtering', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          console.log('%% plan projects: ' + suite.suites.map(s => s.title).join(','));
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter.ts',
        projects: [{ name: 'one' }, { name: 'two' }],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('t', async () => {});
    `,
  }, { reporter: '', workers: 1, project: 'one' });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['plan projects: one']);
});

test('plan.suite ignores --shard; built-in sharding applies after plan', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          // plan sees the full, un-sharded corpus.
          console.log('%% plan: ' + suite.allTests().map(t => t.title).join(','));
        }
        onBegin(config, suite) {
          // built-in sharding has narrowed the run after plan.
          console.log('%% begin: ' + suite.allTests().map(t => t.title).join(','));
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts', fullyParallel: true };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      for (let i = 0; i < 4; i++)
        test('t' + i, async () => {});
    `,
  }, { reporter: '', workers: 1, shard: '1/2' });

  expect(result.exitCode).toBe(0);
  // plan observes all four tests regardless of --shard.
  expect(result.outputLines).toContain('plan: t0,t1,t2,t3');
  // The built-in shard filter runs after plan and reduces the corpus.
  const beginLine = result.outputLines.find(l => l.startsWith('begin: '));
  expect(beginLine).toBeTruthy();
  expect(beginLine!.slice('begin: '.length).split(',').length).toBe(2);
});

test('plan annotations capture caller location pointing at reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          for (const t of suite.allTests())
            t.skip('planned');
        }
        onTestEnd(test, result) {
          const a = test.annotations.find(a => a.type === 'skip');
          console.log('%% loc=' + (a?.location ? require('path').basename(a.location.file) + ':' + a.location.line : 'NONE'));
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('t', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['loc=reporter.ts:5']);
});

test('greedy time-based scheduling can be built on preprocessSuite', async ({ runInlineTest, mergeReports }) => {
  test.slow();

  const timingsFile = test.info().outputPath('timings.json');

  const files = {
    'scheduler.ts': `
      const fs = require('fs');
      ${class Scheduler implements Reporter {
        _durations = new Map<string, number>();
        _config!: FullConfig;
        preprocessSuite(config: FullConfig, suite: Suite) {
          if (!config.shard)
            throw new Error('Should not be called during merge step.');
          const file = process.env.TIMINGS_FILE;
          const timings = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
          if (!timings)
            return { implementsSharding: false };
          const total = config.shard.total;
          const tests = suite.allTests();
          const known = Object.values(timings) as number[];
          const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;
          const sorted = [...tests].sort((a, b) => (timings[b.id] || avg) - (timings[a.id] || avg));
          const loads = new Array(total).fill(0);
          const assignment = new Map<TestCase, number>();
          for (const t of sorted) {
            let min = 0;
            for (let i = 1; i < total; i++) {
              if (loads[i] < loads[min])
                min = i;
            }
            loads[min] += (timings[t.id] || avg);
            assignment.set(t, min);
          }
          for (const t of tests) {
            if (assignment.get(t) !== config.shard.current - 1)
              t.exclude();
          }
          return { implementsSharding: true };
        }
        onBegin(config: FullConfig, suite: Suite) {
          this._config = config;
          const shard = config.shard ? config.shard.current + '/' + config.shard.total : 'none';
          console.log('%% shard ' + shard + ': ' + suite.allTests().map(t => t.title).join(','));
        }
        onTestEnd(test: TestCase, result: TestResult) {
          this._durations.set(test.id, result.duration);
        }
        onEnd() {
          if (this._config.shard)
            return;
          fs.writeFileSync(process.env.TIMINGS_FILE, JSON.stringify(Object.fromEntries(this._durations)));
        }
      }.toString()}
      module.exports = Scheduler;
    `,
    'playwright.config.ts': `
      module.exports = {
        fullyParallel: true,
        reporter: [['blob'], ['./scheduler.ts']],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('a', async () => { await new Promise(r => setTimeout(r, 3000)); });
      test('b', async () => { await new Promise(r => setTimeout(r, 1500)); });
      test('c', async () => { await new Promise(r => setTimeout(r, 100)); });
    `,
  };

  // Round 1: no timing file, falls back to built-in contiguous sharding.
  const r1s1 = await runInlineTest(files, { shard: '1/2' }, { TIMINGS_FILE: timingsFile });
  const r1s2 = await runInlineTest(files, { shard: '2/2' }, { TIMINGS_FILE: timingsFile, PWTEST_BLOB_DO_NOT_REMOVE: '1' });
  expect(r1s1.exitCode).toBe(0);
  expect(r1s2.exitCode).toBe(0);
  expect(r1s1.outputLines).toEqual(['shard 1/2: a,b']);
  expect(r1s2.outputLines).toEqual(['shard 2/2: c']);

  // Merge: the reporter sees every test's duration and writes the timing file.
  const merge = await mergeReports('blob-report', { TIMINGS_FILE: timingsFile }, { additionalArgs: ['--reporter', 'scheduler.ts'] });
  expect(merge.exitCode).toBe(0);
  expect(Object.keys(JSON.parse(fs.readFileSync(timingsFile, 'utf8')))).toHaveLength(3);

  // Round 2: with the timing file, LPT scheduling balances the shards.
  const r2s1 = await runInlineTest(files, { shard: '1/2' }, { TIMINGS_FILE: timingsFile });
  const r2s2 = await runInlineTest(files, { shard: '2/2' }, { TIMINGS_FILE: timingsFile });
  expect(r2s1.exitCode).toBe(0);
  expect(r2s2.exitCode).toBe(0);
  expect(r2s1.outputLines).toEqual(['shard 1/2: a']);
  expect(r2s2.outputLines).toEqual(['shard 2/2: b,c']);
});

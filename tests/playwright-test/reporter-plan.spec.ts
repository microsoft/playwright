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

import { test, expect } from './playwright-test-fixtures';

test('plan is called between project setup and onBegin and can skip tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async plan(config, suite) {
          console.log('plan: ' + suite.allTests().length + ' tests');
          for (const t of suite.allTests()) {
            if (t.title.includes('skip-me'))
              t.skip('planned skip');
          }
        }
        onBegin(config, suite) {
          console.log('onBegin: ' + suite.allTests().length + ' tests');
        }
        onTestEnd(test, result) {
          console.log('end ' + test.title + ' status=' + result.status + ' expected=' + test.expectedStatus + ' ann=' + test.annotations.map(a => a.type + ':' + (a.description || '')).join(','));
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('run-me', async () => {});
      test('skip-me', async () => { throw new Error('should not run'); });
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('plan: 2 tests');
  expect(result.output).toContain('onBegin: 2 tests');
  expect(result.output).toMatch(/end skip-me status=skipped expected=skipped ann=.*skip:planned skip/);
  expect(result.output).toMatch(/end run-me status=passed expected=passed/);
  // Ordering: plan < onBegin
  const idxPlan = result.output.indexOf('plan:');
  const idxBegin = result.output.indexOf('onBegin:');
  expect(idxPlan).toBeLessThan(idxBegin);
});

test('disposition methods are intended for plan() but not enforced at runtime', async ({ runInlineTest }) => {
  // We document plan() as the intended call-site for skip/fixme/fail/exclude
  // but do not enforce it at runtime. Calling them from e.g. onBegin will
  // mutate the in-process suite (visible to reporters) but won't affect the
  // workers, since the run payload is built earlier.
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        onBegin(config, suite) {
          // Should not throw.
          suite.allTests()[0].skip('late');
          console.log('late skip ok: ' + suite.allTests()[0].expectedStatus);
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

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('late skip ok: skipped');
});

test('TestCase.exclude removes test from run and report', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async plan(config, suite) {
          for (const t of suite.allTests())
            if (t.title === 'excluded') t.exclude();
        }
        onBegin(config, suite) {
          console.log('begin tests: ' + suite.allTests().map(t => t.title).join(','));
        }
        onTestEnd(test, result) {
          console.log('ran ' + test.title);
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
  expect(result.output).toContain('begin tests: kept');
  expect(result.output).toContain('ran kept');
  expect(result.output).not.toContain('ran excluded');
});

test('Suite.skip cascades to all descendants', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async plan(config, suite) {
          // Skip every test under the 'doomed' describe.
          const visit = (s) => {
            if (s.title === 'doomed') s.skip('whole group');
            for (const child of s.suites || []) visit(child);
          };
          visit(suite);
        }
        onTestEnd(test, result) {
          console.log(test.title + ':' + result.status + ':' + test.expectedStatus);
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
  expect(result.output).toContain('one:skipped:skipped');
  expect(result.output).toContain('two:skipped:skipped');
  expect(result.output).toContain('keep:passed:passed');
});

test('plan throwing aborts the run before onBegin', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async plan(config, suite) {
          throw new Error('plan-aborted');
        }
        onBegin(config, suite) {
          // InternalReporter synthesizes an empty-suite onBegin when the run
          // aborted before normal onBegin — that's expected. The point is that
          // we never see the real corpus.
          console.log('onBegin suite size: ' + suite.allTests().length);
        }
        onError(err) {
          console.log('error: ' + err.message);
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
  expect(result.output).toContain('plan-aborted');
  // Synthetic empty-suite onBegin OK, real onBegin (size 1) must NOT happen.
  expect(result.output).not.toContain('onBegin suite size: 1');
});

test('multiple reporters: plan called in order, annotations accumulate', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'first.ts': `
      class R {
        async plan(config, suite) {
          console.log('first plan');
          suite.allTests()[0].fail('first reason');
        }
        onTestEnd(test, result) {
          console.log('first onTestEnd: ' + test.expectedStatus + ' ann=' + test.annotations.map(a => a.type).join(','));
        }
      }
      module.exports = R;
    `,
    'second.ts': `
      class R {
        async plan(config, suite) {
          console.log('second plan');
          suite.allTests()[0].skip('second reason');
        }
      }
      module.exports = R;
    `,
    'playwright.config.ts': `module.exports = { reporter: [['./first.ts'], ['./second.ts']] };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  const idxFirst = result.output.indexOf('first plan');
  const idxSecond = result.output.indexOf('second plan');
  expect(idxFirst).toBeGreaterThan(-1);
  expect(idxSecond).toBeGreaterThan(idxFirst);
  // Annotations accumulate from both reporters. skip beats fail in
  // worker-side expectedStatus derivation (mirroring testInfo semantics).
  expect(result.output).toContain('first onTestEnd: skipped');
  expect(result.output).toContain('fail,skip');
});

test('exclude prunes the tree eagerly: later reporter does not see excluded test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'first.ts': `
      class R {
        async plan(config, suite) {
          for (const t of suite.allTests())
            if (t.title === 'gone') t.exclude();
          console.log('first sees: ' + suite.allTests().map(t => t.title).join(','));
        }
      }
      module.exports = R;
    `,
    'second.ts': `
      class R {
        async plan(config, suite) {
          console.log('second sees: ' + suite.allTests().map(t => t.title).join(','));
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
  expect(result.output).toContain('first sees: kept');
  expect(result.output).toContain('second sees: kept');
  expect(result.output).not.toMatch(/second sees:[^\n]*gone/);
});

test('implementsSharding disables built-in shard filter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class R {
        implementsSharding() { return true; }
        async plan(config, suite) {
          // Custom "shard": keep only every other test.
          let i = 0;
          for (const t of suite.allTests()) {
            if (i++ % 2 === 1) t.exclude();
          }
        }
        onBegin(config, suite) {
          console.log('begin count: ' + suite.allTests().length);
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
  // Reporter sees all 4 tests, excludes every other → 2 kept (would have been ~2 from built-in shard).
  // The point: built-in shard didn't run on top of reporter's exclusions.
  expect(result.output).toContain('begin count: 2');
});

test('multiple reporters declaring implementsSharding throws', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter-a.ts': `
      class A {
        implementsSharding() { return true; }
      }
      module.exports = A;
    `,
    'reporter-b.ts': `
      class B {
        implementsSharding() { return true; }
      }
      module.exports = B;
    `,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter-a.ts'], ['./reporter-b.ts']] };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('t', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).not.toBe(0);
  expect(result.rawOutput).toMatch(/Multiple reporters declare 'implementsSharding'/);
});

test('built-in shard runs when no reporter implements sharding', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class R {
        async plan(config, suite) {
          console.log('plan: ' + suite.allTests().length);
        }
        onBegin(config, suite) {
          console.log('begin: ' + suite.allTests().length);
        }
      }
      module.exports = R;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts', shard: { current: 1, total: 2 } };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      for (let i = 0; i < 4; i++)
        test('t' + i, async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  // plan sees full corpus (pre-shard), onBegin sees sharded subset.
  expect(result.output).toContain('plan: 4');
  expect(result.output).toContain('begin: 2');
});

test('plan sees the .only-narrowed corpus', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class R {
        async plan(config, suite) {
          console.log('plan tests: ' + suite.allTests().map(t => t.title).join(','));
        }
      }
      module.exports = R;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('one', async () => {});
      test.only('two', async () => {});
      test('three', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('plan tests: two');
});

test('plan annotations capture caller location pointing at reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async plan(config, suite) {
          for (const t of suite.allTests())
            t.skip('planned');
        }
        onTestEnd(test, result) {
          const a = test.annotations.find(a => a.type === 'skip');
          console.log('loc=' + (a?.location ? require('path').basename(a.location.file) + ':' + a.location.line : 'NONE'));
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
  expect(result.output).toMatch(/loc=reporter\.ts:\d+/);
});

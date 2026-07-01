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

test('preprocessSuite sees the filtered corpus, can skip tests, and records the caller location', async ({ runInlineTest }) => {
  // preprocessSuite runs between project setup and onBegin and sees the .only-narrowed corpus.
  const only = await runInlineTest({
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
          const a = test.annotations.find(a => a.type === 'skip');
          const loc = a && a.location ? require('path').basename(a.location.file) + ':' + a.location.line : 'none';
          console.log('%% end ' + test.title + ' status=' + result.status + ' expected=' + test.expectedStatus + ' ann=' + test.annotations.map(a => a.type + ':' + (a.description || '')).join(',') + ' loc=' + loc);
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

  expect(only.exitCode).toBe(0);
  expect(only.outputLines).toEqual([
    'plan: run-me,skip-me',
    'onBegin: run-me,skip-me',
    'end run-me status=passed expected=passed ann= loc=none',
    // The skip annotation location points at the reporter's `t.skip(...)` call (line 6 of reporter.ts).
    'end skip-me status=skipped expected=skipped ann=skip:planned skip loc=reporter.ts:6',
  ]);

  // preprocessSuite respects --grep.
  const grep = await runInlineTest({
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
  expect(grep.exitCode).toBe(0);
  expect(grep.outputLines).toEqual(['plan: foo-one']);

  // preprocessSuite respects --project.
  const project = await runInlineTest({
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
  expect(project.exitCode).toBe(0);
  expect(project.outputLines).toEqual(['plan projects: one']);
});

test('TestCase.exclude and Suite.exclude remove entries from the run and report', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          for (const t of suite.allTests())
            if (t.title === 'excluded-test') t.exclude();
          const visit = (s) => {
            if (s.title === 'excluded-suite') s.exclude();
            else for (const child of s.suites || []) visit(child);
          };
          visit(suite);
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
      test('excluded-test', async () => { throw new Error('should not run'); });
      test.describe('excluded-suite', () => {
        test('doomed', async () => { throw new Error('should not run'); });
      });
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

test('disposition methods throw when called outside preprocessSuite, and the root suite cannot be excluded', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocessSuite(config, suite) {
          // Excluding the root suite is banned even during preprocessSuite.
          try {
            suite.exclude();
            console.log('%% root-exclude: no-throw');
          } catch (e) {
            console.log('%% root-exclude: ' + e.message);
          }
        }
        onBegin(config, suite) {
          const testCase = suite.allTests()[0];
          const fileSuite = testCase.parent;
          for (const [label, obj] of [['TestCase', testCase], ['Suite', fileSuite]]) {
            for (const method of ['skip', 'fixme', 'fail', 'exclude']) {
              try {
                obj[method]();
                console.log('%% ' + label + '.' + method + ': no-throw');
              } catch (e) {
                console.log('%% ' + label + '.' + method + ': ' + e.message);
              }
            }
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
  expect(result.outputLines).toEqual([
    'root-exclude: Suite.exclude() cannot be called on the root suite.',
    'TestCase.skip: TestCase.skip() can only be called from Reporter.preprocessSuite().',
    'TestCase.fixme: TestCase.fixme() can only be called from Reporter.preprocessSuite().',
    'TestCase.fail: TestCase.fail() can only be called from Reporter.preprocessSuite().',
    'TestCase.exclude: TestCase.exclude() can only be called from Reporter.preprocessSuite().',
    'Suite.skip: Suite.skip() can only be called from Reporter.preprocessSuite().',
    'Suite.fixme: Suite.fixme() can only be called from Reporter.preprocessSuite().',
    'Suite.fail: Suite.fail() can only be called from Reporter.preprocessSuite().',
    'Suite.exclude: Suite.exclude() can only be called from Reporter.preprocessSuite().',
  ]);
});

test('preprocessSuite throwing aborts the run before onBegin', async ({ runInlineTest }) => {
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

test('multiple reporters: preprocessSuite called in order, annotations accumulate, exclude prunes for next reporter', async ({ runInlineTest }) => {
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

test('multiple reporters: a later reporter observes an earlier reporter Suite.skip on the tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'first.ts': `
      class R {
        async preprocessSuite(config, suite) {
          suite.allTests()[0].parent.skip('first reason');
        }
      }
      module.exports = R;
    `,
    'second.ts': `
      class R {
        async preprocessSuite(config, suite) {
          const skipped = suite.allTests().filter(t => t.expectedStatus === 'skipped').map(t => t.title);
          console.log('%% second sees skipped: ' + skipped.join(','));
        }
      }
      module.exports = R;
    `,
    'playwright.config.ts': `module.exports = { reporter: [['./first.ts'], ['./second.ts']] };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('group', () => {
        test('one', async () => {});
        test('two', async () => {});
      });
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  // Suite.skip from the first reporter is applied before the second reporter runs.
  expect(result.outputLines).toContain('second sees skipped: one,two');
});

test('implementsSharding disables the built-in shard filter; preprocessSuite sees the full corpus', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class R {
        async preprocessSuite(config, suite) {
          // preprocessSuite observes the full, un-sharded corpus regardless of --shard.
          console.log('%% plan: ' + suite.allTests().map(t => t.title).join(','));
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
  // preprocessSuite sees all four tests even though --shard=1/2 was configured.
  expect(result.outputLines).toContain('plan: t0,t1,t2,t3');
  // The reporter's own exclusions define the shard; the built-in shard filter did NOT run
  // (it would have produced a different split), so t0,t2 remain.
  expect(result.outputLines).toContain('begin: t0,t2');
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

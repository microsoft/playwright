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

test('preprocess sees the filtered corpus, can skip tests, and records the caller location', async ({ runInlineTest }) => {
  // preprocess runs between project setup and onBegin and sees the .only-narrowed corpus.
  const only = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite, testRun }) {
          console.log('%% plan: ' + suite.allTests().map(t => t.title).join(','));
          for (const t of suite.allTests())
            if (t.title.includes('skip-me')) testRun.skip(t, 'planned skip');
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
    // The skip annotation location points at the reporter's `testRun.skip(...)` call (line 6 of reporter.ts).
    'end skip-me status=skipped expected=skipped ann=skip:planned skip loc=reporter.ts:6',
  ]);

  // preprocess respects --grep.
  const grep = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite }) {
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

  // preprocess respects --project.
  const project = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite }) {
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
        async preprocess({ config, suite, testRun }) {
          for (const t of suite.allTests())
            if (t.title === 'excluded-test') testRun.exclude(t);
          const visit = (s) => {
            if (s.title === 'excluded-suite') testRun.exclude(s);
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
        async preprocess({ config, suite, testRun }) {
          const visit = (s) => {
            if (s.title === 'doomed') testRun.skip(s, 'whole group');
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

test('TestRun methods throw outside preprocess, and the root suite cannot be excluded', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite, testRun }) {
          this.testRun = testRun;
          // Excluding the root suite is banned even during preprocess.
          try {
            testRun.exclude(suite);
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
                this.testRun[method](obj);
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
    'root-exclude: TestRun.exclude() cannot be called on the root suite.',
    'TestCase.skip: TestRun.skip() can only be called from Reporter.preprocess().',
    'TestCase.fixme: TestRun.fixme() can only be called from Reporter.preprocess().',
    'TestCase.fail: TestRun.fail() can only be called from Reporter.preprocess().',
    'TestCase.exclude: TestRun.exclude() can only be called from Reporter.preprocess().',
    'Suite.skip: TestRun.skip() can only be called from Reporter.preprocess().',
    'Suite.fixme: TestRun.fixme() can only be called from Reporter.preprocess().',
    'Suite.fail: TestRun.fail() can only be called from Reporter.preprocess().',
    'Suite.exclude: TestRun.exclude() can only be called from Reporter.preprocess().',
  ]);
});

test('preprocess throwing aborts the run before onBegin', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite }) {
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

test('multiple reporters: preprocess called in order, annotations accumulate, exclude prunes for next reporter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'first.ts': `
      class R {
        async preprocess({ config, suite, testRun }) {
          console.log('%% first plan sees: ' + suite.allTests().map(t => t.title).join(','));
          for (const t of suite.allTests()) {
            if (t.title === 'gone') testRun.exclude(t);
            else testRun.fail(t, 'first reason');
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
        async preprocess({ config, suite, testRun }) {
          console.log('%% second plan sees: ' + suite.allTests().map(t => t.title).join(','));
          testRun.skip(suite.allTests()[0], 'second reason');
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
        async preprocess({ config, suite, testRun }) {
          testRun.skip(suite.allTests()[0].parent, 'first reason');
        }
      }
      module.exports = R;
    `,
    'second.ts': `
      class R {
        async preprocess({ config, suite }) {
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

test('skipSharding disables the built-in shard filter; preprocess sees the full corpus', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class R {
        async preprocess({ config, suite, testRun }) {
          // preprocess observes the full, un-sharded corpus regardless of --shard.
          console.log('%% plan: ' + suite.allTests().map(t => t.title).join(','));
          testRun.skipSharding();
          let i = 0;
          for (const t of suite.allTests()) {
            if (i++ % 2 === 1) testRun.exclude(t);
          }
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
  // preprocess sees all four tests even though --shard=1/2 was configured.
  expect(result.outputLines).toContain('plan: t0,t1,t2,t3');
  // The reporter's own exclusions define the shard; the built-in shard filter did NOT run
  // (it would have produced a different split), so t0,t2 remain.
  expect(result.outputLines).toContain('begin: t0,t2');
});

test('multiple reporters declaring custom sharding throws', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter-a.ts': `
      class A {
        preprocess({ testRun }) { testRun.skipSharding(); }
        onError(err) { console.log('%% error: ' + err.message); }
      }
      module.exports = A;
    `,
    'reporter-b.ts': `
      class B { preprocess({ testRun }) { testRun.skipSharding(); } }
      module.exports = B;
    `,
    'playwright.config.ts': `module.exports = { reporter: [['./reporter-a.ts'], ['./reporter-b.ts']] };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('t', async () => {});
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).not.toBe(0);
  expect(result.outputLines.join('\n')).toContain(`Multiple reporters called 'skipSharding'`);
});

test('plan.suite exposes setup/teardown dependency projects but they are read-only', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite, testRun }) {
          this.testRun = testRun;
          console.log('%% plan projects: ' + suite.suites.map(s => s.title).join(','));
          console.log('%% plan tests: ' + suite.allTests().map(t => t.title).join(','));
          this.preprocessedTests = new Set(suite.allTests());
          const setupTest = suite.allTests().find(t => t.title === 'setup-test');
          for (const method of ['skip', 'fixme', 'fail', 'exclude']) {
            try {
              testRun[method](setupTest);
              console.log('%% dep-' + method + ': no-throw');
            } catch (e) {
              console.log('%% dep-' + method + ': ' + e.message);
            }
          }
          const setupProject = suite.suites.find(s => s.title === 'setup');
          try {
            testRun.exclude(setupProject);
            console.log('%% dep-suite-exclude: no-throw');
          } catch (e) {
            console.log('%% dep-suite-exclude: ' + e.message);
          }
        }
        onBegin(config, suite) {
          console.log('%% same test objects: ' + suite.allTests().every(test => this.preprocessedTests.has(test)));
          const setupTest = suite.allTests().find(t => t.title === 'setup-test');
          try {
            this.testRun.skip(setupTest);
            console.log('%% dep-after-preprocess: no-throw');
          } catch (e) {
            console.log('%% dep-after-preprocess: ' + e.message);
          }
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
          { name: 'setup', testMatch: /a\\.setup\\.ts/, teardown: 'teardown' },
          { name: 'teardown', testMatch: /a\\.teardown\\.ts/ },
          { name: 'main', testMatch: /a\\.test\\.ts/, dependencies: ['setup'] },
        ],
      };
    `,
    'a.setup.ts': `
      import { test } from '@playwright/test';
      test('setup-test', async () => {});
    `,
    'a.teardown.ts': `
      import { test } from '@playwright/test';
      test('teardown-test', async () => {});
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('main-test', async () => {});
    `,
  }, { reporter: '', workers: 1 }, undefined, { additionalArgs: ['--project=main'] });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'plan projects: teardown,setup,main',
    'plan tests: teardown-test,setup-test,main-test',
    'dep-skip: TestRun.skip() cannot be called on a setup or teardown project test; these always run in full.',
    'dep-fixme: TestRun.fixme() cannot be called on a setup or teardown project test; these always run in full.',
    'dep-fail: TestRun.fail() cannot be called on a setup or teardown project test; these always run in full.',
    'dep-exclude: TestRun.exclude() cannot be called on a setup or teardown project test; these always run in full.',
    'dep-suite-exclude: TestRun.exclude() cannot be called on a setup or teardown project; these always run in full.',
    'same test objects: true',
    'dep-after-preprocess: TestRun.skip() can only be called from Reporter.preprocess().',
    'ran setup/setup-test',
    'ran main/main-test',
    'ran teardown/teardown-test',
  ]);
});

test('plan.suite temporarily exposes dependencies without changing final project selection', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ config, suite, testRun }) {
          console.log('%% plan projects: ' + suite.suites.map(suite => suite.title).join(','));
          testRun.exclude(suite.suites.find(suite => suite.title === 'main'));
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
          { name: 'setup', testMatch: /setup\\.spec\\.ts/ },
          { name: 'main', testMatch: /main\\.spec\\.ts/, dependencies: ['setup'] },
          { name: 'keep', testMatch: /keep\\.spec\\.ts/ },
        ],
      };
    `,
    'setup.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('setup-test', async () => {
        expect(1).toBe(2);
      });
    `,
    'main.spec.ts': `
      import { test } from '@playwright/test';
      test('main-test', async () => {});
    `,
    'keep.spec.ts': `
      import { test } from '@playwright/test';
      test('keep-test', async () => {});
    `,
  }, { reporter: '', workers: 1 }, undefined, { additionalArgs: ['setup.spec.ts', 'main.spec.ts', 'keep.spec.ts'] });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'plan projects: setup,main,keep',
    'ran keep/keep-test',
  ]);
});

test('serial suites expose a serial annotation for custom sharding', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        async preprocess({ suite }) {
          for (const t of suite.allTests())
            console.log('%% ' + t.title + ':' + t.annotations.filter(a => a.type === 'serial').length);
        }
      }
      module.exports = Reporter;
    `,
    'playwright.config.ts': `module.exports = { reporter: './reporter.ts' };`,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('plain', async () => {});
      test.describe.serial('s', () => {
        test('serial', async () => {});
      });
      test.describe('c', () => {
        test.describe.configure({ mode: 'serial' });
        test('configure', async () => {});
      });
      test.describe.serial('outer', () => {
        test.describe.serial('inner', () => {
          test('nested', async () => {});
        });
      });
    `,
  }, { reporter: '', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'plain:0',
    'serial:1',
    'configure:1',
    'nested:2',
  ]);
});

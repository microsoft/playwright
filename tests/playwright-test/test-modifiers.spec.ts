/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect, expectTestHelper } from './playwright-test-fixtures';

test('test modifiers should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        foo: true,
      });
    `,
    'a.test.ts': `
      import { test } from './helper';

      test('passed1', async ({foo}) => {
      });
      test('passed2', async ({foo}) => {
        test.skip(false);
      });
      test('passed3', async () => {
        test.fixme(undefined);
      });
      test('passed4', async () => {
        test.fixme(undefined, 'reason')
      });
      test('passed5', async ({foo}) => {
        test.skip(false);
      });

      test('skipped1', async ({foo}) => {
        test.skip();
      });
      test('skipped2', async ({foo}) => {
        test.skip('reason');
      });
      test('skipped3', async ({foo}) => {
        test.skip(foo);
      });
      test('skipped4', async ({foo}) => {
        test.skip(foo, 'reason');
      });
      test('skipped5', async () => {
        test.fixme();
      });
      test('skipped6', async () => {
        test.fixme(true, 'reason');
      });

      test('failed1', async ({foo}) => {
        test.fail();
        expect(true).toBe(false);
      });
      test('failed2', async ({foo}) => {
        test.fail('reason');
        expect(true).toBe(false);
      });
      test('failed3', async ({foo}) => {
        test.fail(foo);
        expect(true).toBe(false);
      });
      test('failed4', async ({foo}) => {
        test.fail(foo, 'reason');
        expect(true).toBe(false);
      });

      test.describe('suite1', () => {
        test.skip();
        test('suite1', () => {});
      });

      test.describe('suite2', () => {
        test.skip(true);
        test('suite2', () => {});
      });

      test.describe('suite3', () => {
        test.skip(({ foo }) => foo, 'reason');
        test('suite3', () => {});
      });

      test.describe('suite3', () => {
        test.skip(({ foo }) => !foo, 'reason');
        test('suite4', () => {});
      });
    `,
  });

  const expectTest = (title: string, expectedStatus: string, status: string, annotations: any) => {
    const spec = result.report.suites[0].specs.find(s => s.title === title) ||
        result.report.suites[0].suites!.find(s => s.specs[0].title === title)!.specs[0];
    const test = spec.tests[0];
    expect(test.expectedStatus).toBe(expectedStatus);
    expect(test.results[0].status).toBe(status);
    expect(test.annotations).toEqual(annotations);
  };
  expectTest('passed1', 'passed', 'passed', []);
  expectTest('passed2', 'passed', 'passed', []);
  expectTest('passed3', 'passed', 'passed', []);
  expectTest('passed4', 'passed', 'passed', []);
  expectTest('passed5', 'passed', 'passed', []);
  expectTest('skipped1', 'skipped', 'skipped', [{ type: 'skip', location: { file: expect.any(String), line: 20, column: 14 } }]);
  expectTest('skipped2', 'skipped', 'skipped', [{ type: 'skip', location: { file: expect.any(String), line: 23, column: 14 } }]);
  expectTest('skipped3', 'skipped', 'skipped', [{ type: 'skip', location: { file: expect.any(String), line: 26, column: 14 } }]);
  expectTest('skipped4', 'skipped', 'skipped', [{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 29, column: 14 } }]);
  expectTest('skipped5', 'skipped', 'skipped', [{ type: 'fixme', location: { file: expect.any(String), line: 32, column: 14 } }]);
  expectTest('skipped6', 'skipped', 'skipped', [{ type: 'fixme', description: 'reason', location: { file: expect.any(String), line: 35, column: 14 } }]);
  expectTest('failed1', 'failed', 'failed', [{ type: 'fail', location: { file: expect.any(String), line: 39, column: 14 } }]);
  expectTest('failed2', 'failed', 'failed', [{ type: 'fail', location: { file: expect.any(String), line: 43, column: 14 } }]);
  expectTest('failed3', 'failed', 'failed', [{ type: 'fail', location: { file: expect.any(String), line: 47, column: 14 } }]);
  expectTest('failed4', 'failed', 'failed', [{ type: 'fail', description: 'reason', location: { file: expect.any(String), line: 51, column: 14 } }]);
  expectTest('suite1', 'skipped', 'skipped', [{ type: 'skip', location: { file: expect.any(String), line: 56, column: 14 } }]);
  expectTest('suite2', 'skipped', 'skipped', [{ type: 'skip', location: { file: expect.any(String), line: 61, column: 14 } }]);
  expectTest('suite3', 'skipped', 'skipped', [{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 66, column: 14 } }]);
  expectTest('suite4', 'passed', 'passed', []);
  expect(result.passed).toBe(10);
  expect(result.skipped).toBe(9);
});

test.describe('test modifier annotations', () => {
  test('should work', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.describe('suite1', () => {
          test('no marker', () => {});
          test.skip('skip wrap', () => {});
          test('skip inner', () => { test.skip(); });
          test.fixme('fixme wrap', () => {});
          test('fixme inner', () => { test.fixme(); });
          test.fail('fail wrap', () => { expect(1).toBe(2); });
          test('fail inner', () => { test.fail(); expect(1).toBe(2); });
        });

        test('example', () => {});
      `,
    });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(4);
    expect(result.skipped).toBe(4);
    expectTest('no marker', 'passed', 'expected', []);
    expectTest('skip wrap', 'skipped', 'skipped', ['skip']);
    expectTest('skip inner', 'skipped', 'skipped', ['skip']);
    expectTest('fixme wrap', 'skipped', 'skipped', ['fixme']);
    expectTest('fixme inner', 'skipped', 'skipped', ['fixme']);
    expectTest('fail wrap', 'failed', 'expected', ['fail']);
    expectTest('fail inner', 'failed', 'expected', ['fail']);
    expectTest('example', 'passed', 'expected', []);
  });

  test('should work alongside top-level modifier', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.fixme();

        test.describe('suite1', () => {
          test('no marker', () => {});
          test.skip('skip wrap', () => {});
          test('skip inner', () => { test.skip(); });
          test.fixme('fixme wrap', () => {});
          test('fixme inner', () => { test.fixme(); });
        });

        test('example', () => {});
      `,
    });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.skipped).toBe(6);
    expectTest('no marker', 'skipped', 'skipped', ['fixme']);
    expectTest('skip wrap', 'skipped', 'skipped', ['fixme', 'skip']);
    expectTest('skip inner', 'skipped', 'skipped', ['fixme']);
    expectTest('fixme wrap', 'skipped', 'skipped', ['fixme', 'fixme']);
    expectTest('fixme inner', 'skipped', 'skipped', ['fixme']);
    expectTest('example', 'skipped', 'skipped', ['fixme']);
  });

  test('should work alongside top-level modifier wrapper-style', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.describe.skip('suite1', () => {
          test('no marker', () => {});
          test.skip('skip wrap', () => {});
          test('skip inner', () => { test.skip(); });
          test.fixme('fixme wrap', () => {});
          test('fixme inner', () => { test.fixme(); });
        });

        test('example', () => {});
      `,
    });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.skipped).toBe(5);
    expectTest('no marker', 'skipped', 'skipped', ['skip']);
    expectTest('skip wrap', 'skipped', 'skipped', ['skip', 'skip']);
    expectTest('skip inner', 'skipped', 'skipped', ['skip']);
    expectTest('fixme wrap', 'skipped', 'skipped', ['skip', 'fixme']);
    expectTest('fixme inner', 'skipped', 'skipped', ['skip']);
    expectTest('example', 'passed', 'expected', []);
  });

  test('should work with nesting', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.fixme();

        test.describe.skip('suite1', () => {
          test.describe.skip('sub', () => {
            test.describe('a', () => {
              test.describe('b', () => {
                test.fixme();

                test.fixme('fixme wrap', () => {});
                test('fixme inner', () => { test.fixme(); });
              })
            })
          })
        });
      `,
    });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.skipped).toBe(2);
    expectTest('fixme wrap', 'skipped', 'skipped', ['fixme', 'skip', 'skip', 'fixme', 'fixme']);
    expectTest('fixme inner', 'skipped', 'skipped', ['fixme', 'skip', 'skip', 'fixme']);
  });

  test('should work with only', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.describe.only("suite", () => {
          test.skip('focused skip by suite', () => {});
          test.fixme('focused fixme by suite', () => {});
        });

        test.describe.skip('not focused', () => {
          test('no marker', () => {});
        });
      `,
    });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(0);
    expect(result.skipped).toBe(2);
    expectTest('focused skip by suite', 'skipped', 'skipped', ['skip']);
    expectTest('focused fixme by suite', 'skipped', 'skipped', ['fixme']);
  });

  test('should work with fail.only inside describe.only', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
  
        test.describe.only("suite", () => {
          test.skip('focused skip by suite', () => {});
          test.fixme('focused fixme by suite', () => {});
          test.fail.only('focused fail by suite', () => { expect(1).toBe(2); });
        });
  
        test.describe.skip('not focused', () => {
          test('no marker', () => {});
        });
      `,
    });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expectTest('focused skip by suite', 'skipped', 'skipped', ['skip']);
    expectTest('focused fixme by suite', 'skipped', 'skipped', ['fixme']);
    expectTest('focused fail by suite', 'failed', 'expected', ['fail']);
  });

  test('should not multiply on repeat-each', async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('retry', () => {
          test.info().annotations.push({ type: 'example' });
        });
      `,
    }, { 'repeat-each': 3 });
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(3);
    expectTest('retry', 'passed', 'expected', ['example']);
  });
});

test('test modifiers should check types', async ({ runTSC }) => {
  const result = await runTSC({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend<{ foo: boolean }>({
        foo: async ({}, use, testInfo) => {
          testInfo.skip();
          testInfo.fixme(false);
          testInfo.slow(true, 'reason');
          testInfo.fail(false, 'reason');
          // @ts-expect-error
          testInfo.skip('reason');
          // @ts-expect-error
          testInfo.fixme('foo', 'reason');
          // @ts-expect-error
          testInfo.slow(() => true);
          use(true);
        },
      });
    `,
    'a.test.ts': `
      import { test } from './helper';

      test('passed1', async ({foo}) => {
        test.skip();
      });
      test('passed2', async ({foo}) => {
        test.skip(foo);
      });
      test('passed2', async ({foo}) => {
        test.skip(foo, 'reason');
      });
      test('passed3', async ({foo}) => {
        test.skip(({foo}) => foo);
      });
      test('passed3', async ({foo}) => {
        test.skip(({foo}) => foo, 'reason');
      });
      test('passed3', async ({foo}) => {
        // @ts-expect-error
        test.skip('foo', 'bar');
      });
      test('passed3', async ({foo}) => {
        // @ts-expect-error
        test.skip(({ bar }) => bar, 'reason');
      });
      test('passed3', async ({foo}) => {
        // @ts-expect-error
        test.skip(42);
      });
      test.skip('skipped', async ({}) => {
      });
      test.fixme('fixme', async ({}) => {
      });
      // @ts-expect-error
      test.skip('skipped', 'skipped');
      // @ts-expect-error
      test.fixme('fixme', 'fixme');
      // @ts-expect-error
      test.skip(true, async () => {});
      // @ts-expect-error
      test.fixme(true, async () => {});
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should skip inside fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({}, run, testInfo) => {
          testInfo.skip(true, 'reason');
          await run();
        },
      });

      test('skipped', async ({ foo }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 5, column: 20 } }]);
});

test('modifier with a function should throw in the test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('skipped', async ({}) => {
        test.skip(() => true);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('test.skip() with a function can only be called inside describe block');
});

test('test.skip with worker fixtures only should skip before hooks and tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [ 'foo', { scope: 'worker' }],
      });
      const logs = [];
      test.beforeEach(() => {
        console.log('\\n%%beforeEach');
      });
      test('passed', () => {
        console.log('\\n%%passed');
      });
      test.describe('suite1', () => {
        test.skip(({ foo }) => {
          console.log('\\n%%skip');
          return foo === 'foo';
        }, 'reason');
        test.beforeAll(() => {
          console.log('\\n%%beforeAll');
        });
        test('skipped1', () => {
          console.log('\\n%%skipped1');
        });
        test.describe('suite2', () => {
          test('skipped2', () => {
            console.log('\\n%%skipped2');
          });
        });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(2);
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([]);
  expect(result.report.suites[0].suites![0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 14, column: 14 } }]);
  expect(result.report.suites[0].suites![0].suites![0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 14, column: 14 } }]);
  expect(result.outputLines).toEqual([
    'beforeEach',
    'passed',
    'skip',
  ]);
});

test('test.skip without a callback in describe block should skip hooks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      const logs = [];
      test.beforeAll(() => {
        console.log('%%beforeAll');
      });
      test.beforeEach(() => {
        console.log('%%beforeEach');
      });
      test.skip(true, 'reason');
      test('skipped1', () => {
        console.log('%%skipped1');
      });
      test.describe('suite1', () => {
        test('skipped2', () => {
          console.log('%%skipped2');
        });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.skipped).toBe(2);
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 10, column: 12 } }]);
  expect(result.report.suites[0].suites![0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 10, column: 12 } }]);
  expect(result.output).not.toContain('%%');
});

test('test.skip should not define a skipped test inside another test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      const logs = [];
      test('passes', () => {
        test.skip('foo', () => {
          console.log('%%dontseethis');
          throw new Error('foo');
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('It looks like you are calling test.skip() inside the test and pass a callback');
});

test('modifier timeout should be reported', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.skip(async () => new Promise(() => {}));
      test('fails', () => {
      });
    `,
  }, { timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('"skip" modifier timeout of 2000ms exceeded.');
  expect(result.output).toContain('3 |       test.skip(async () => new Promise(() => {}));');
});

test('should run beforeAll/afterAll hooks if modifier throws', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.skip(() => {
        console.log('%%modifier');
        throw new Error('Oh my');
      });
      test.beforeAll(() => {
        console.log('%%beforeAll');
      });
      test.beforeEach(() => {
        console.log('%%beforeEach');
      });
      test.afterEach(() => {
        console.log('%%afterEach');
      });
      test.afterAll(() => {
        console.log('%%afterAll');
      });
      test('skipped1', () => {
        console.log('%%skipped1');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual([
    'modifier',
    'beforeAll',
    'afterAll',
  ]);
});

test('should skip all tests from beforeAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(() => {
        console.log('%%beforeAll');
        test.skip(true, 'reason');
      });
      test.beforeAll(() => {
        console.log('%%beforeAll2');
      });
      test.beforeEach(() => {
        console.log('%%beforeEach');
      });
      test.afterEach(() => {
        console.log('%%afterEach');
      });
      test.afterAll(() => {
        console.log('%%afterAll');
      });
      test('skipped1', () => {
        console.log('%%skipped1');
      });
      test('skipped2', () => {
        console.log('%%skipped2');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'beforeAll',
    'afterAll',
  ]);
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 5, column: 14 } }]);
  expect(result.report.suites[0].specs[1].tests[0].annotations).toEqual([{ type: 'skip', description: 'reason', location: { file: expect.any(String), line: 5, column: 14 } }]);
});

test('should report skipped tests in-order with correct properties', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      class Reporter {
        onTestBegin(test) {
          console.log('\\n%%begin-' + test.title);
        }
        onTestEnd(test, result) {
          console.log('\\n%%end-' + test.title);
          console.log('\\n%%expectedStatus-' + test.expectedStatus);
          console.log('\\n%%timeout-' + test.timeout);
          console.log('\\n%%retries-' + test.retries);
        }
      }
      export default Reporter;
    `,
    'playwright.config.ts': `
      module.exports = { reporter: [['./reporter.ts']] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ timeout: 1234, retries: 3 });
      test('test1', async ({}) => {
      });
      test.skip('test2', async ({}) => {
      });
      test('test3', async ({}) => {
      });
    `,
  }, { reporter: '', workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    'begin-test1',
    'end-test1',
    'expectedStatus-passed',
    'timeout-1234',
    'retries-3',
    'begin-test2',
    'end-test2',
    'expectedStatus-skipped',
    'timeout-1234',
    'retries-3',
    'begin-test3',
    'end-test3',
    'expectedStatus-passed',
    'timeout-1234',
    'retries-3',
  ]);
});

test('should skip tests if beforeEach has skip', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(() => {
        test.skip();
      });
      test('no marker', () => {
        console.log('skip-me');
      });
    `,
  });
  const expectTest = expectTestHelper(result);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.skipped).toBe(1);
  expectTest('no marker', 'skipped', 'skipped', ['skip']);
  expect(result.output).not.toContain('skip-me');
});

test('static modifiers should be added in serial mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';

      test.describe.configure({ mode: 'serial' });
      test('failed', async ({}) => {
        test.slow();
        throw new Error('blocking error');
      });
      test.fixme('fixmed', async ({}) => {
      });
      test.skip('skipped', async ({}) => {
      });
      test('does not run', async ({}) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.skipped).toBe(2);
  expect(result.didNotRun).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([{ type: 'slow', location: { file: expect.any(String), line: 6, column: 14 } }]);
  expect(result.report.suites[0].specs[1].tests[0].annotations).toEqual([{ type: 'fixme', location: { file: expect.any(String), line: 9, column: 12 } }]);
  expect(result.report.suites[0].specs[2].tests[0].annotations).toEqual([{ type: 'skip', location: { file: expect.any(String), line: 11, column: 12 } }]);
  expect(result.report.suites[0].specs[3].tests[0].annotations).toEqual([]);
});

test('should contain only one slow modifier', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'slow.test.ts': `
      import { test } from '@playwright/test';
      test.slow();
      test('pass', { annotation: { type: 'issue', description: 'my-value' } }, () => {});
    `,
    'skip.test.ts': `
      import { test } from '@playwright/test';
      test.skip();
      test('pass', { annotation: { type: 'issue', description: 'my-value' } }, () => {});
  `,
    'fixme.test.ts': `
      import { test } from '@playwright/test';
      test.fixme();
      test('pass', { annotation: { type: 'issue', description: 'my-value' } }, () => {});
`,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([
    { type: 'fixme', location: { file: expect.any(String), line: 3, column: 12 } },
    { type: 'issue', description: 'my-value', location: { file: expect.any(String), line: 4, column: 11 } }
  ]);
  expect(result.report.suites[1].specs[0].tests[0].annotations).toEqual([
    { type: 'skip', location: { file: expect.any(String), line: 3, column: 12 } },
    { type: 'issue', description: 'my-value', location: { file: expect.any(String), line: 4, column: 11 } }
  ]);
  expect(result.report.suites[2].specs[0].tests[0].annotations).toEqual([
    { type: 'slow', location: { file: expect.any(String), line: 3, column: 12 } },
    { type: 'issue', description: 'my-value', location: { file: expect.any(String), line: 4, column: 11 } }
  ]);
});

test('should skip beforeEach hooks upon modifiers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('top', () => {});

      test.describe(() => {
        test.skip(({ viewport }) => true);
        test.beforeEach(() => { throw new Error(); });

        test.describe(() => {
          test.beforeEach(() => { throw new Error(); });
          test('test', () => {});
        });
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(1);
});

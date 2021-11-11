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

import { test, expect, stripAscii } from './playwright-test-fixtures';

test('hooks should work with fixtures', async ({ runInlineTest }) => {
  const { results } = await runInlineTest({
    'helper.ts': `
      global.logs = [];
      let counter = 0;
      export const test = pwt.test.extend({
        w: [ async ({}, run) => {
          global.logs.push('+w');
          await run(17);
          global.logs.push('-w');
        }, { scope: 'worker' }],

        t: async ({}, run) => {
          global.logs.push('+t');
          await run(42 + counter);
          ++counter;
          global.logs.push('-t');
        },
      });
    `,
    'a.test.js': `
      const { test } = require('./helper');
      test.describe('suite', () => {
        test.beforeAll(async ({ w, t }) => {
          global.logs.push('beforeAll-' + w + '-' + t);
        });
        test.afterAll(async ({ w, t }) => {
          global.logs.push('afterAll-' + w + '-' + t);
        });

        test.beforeEach(async ({ w, t }) => {
          global.logs.push('beforeEach-' + w + '-' + t);
        });
        test.afterEach(async ({ w, t }) => {
          global.logs.push('afterEach-' + w + '-' + t);
        });

        test('one', async ({ w, t }) => {
          global.logs.push('test-' + w + '-' + t);
        });
      });

      test('two', async ({ t }) => {
        expect(global.logs).toEqual([
          '+w',
          '+t',
          'beforeAll-17-42',
          '-t',
          '+t',
          'beforeEach-17-43',
          'test-17-43',
          'afterEach-17-43',
          '-t',
          '+t',
          'afterAll-17-44',
          '-t',
          '+t',
        ]);
      });
    `,
  });
  expect(results[0].status).toBe('passed');
});

test('afterEach failure should not prevent other hooks and fixtures teardown', async ({ runInlineTest }) => {
  const report = await runInlineTest({
    'helper.ts': `
      global.logs = [];
      export const test = pwt.test.extend({
        foo: async ({}, run) => {
          console.log('+t');
          await run();
          console.log('-t');
        }
      });
    `,
    'a.test.js': `
      const { test } = require('./helper');
      test.describe('suite', () => {
        test.afterEach(async () => {
          console.log('afterEach1');
        });
        test.afterEach(async () => {
          console.log('afterEach2');
          throw new Error('afterEach2');
        });
        test('one', async ({foo}) => {
          console.log('test');
          expect(true).toBe(true);
        });
      });
    `,
  });
  expect(report.output).toContain('+t\ntest\nafterEach2\nafterEach1\n-t');
  expect(report.results[0].error.message).toContain('afterEach2');
});

test('beforeEach failure should prevent the test, but not other hooks', async ({ runInlineTest }) => {
  const report = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.describe('suite', () => {
        test.beforeEach(async ({}) => {
          console.log('beforeEach1');
        });
        test.beforeEach(async ({}) => {
          console.log('beforeEach2');
          throw new Error('beforeEach2');
        });
        test.afterEach(async ({}) => {
          console.log('afterEach');
        });
        test('one', async ({}) => {
          console.log('test');
        });
      });
    `,
  });
  expect(report.output).toContain('beforeEach1\nbeforeEach2\nafterEach');
  expect(report.results[0].error.message).toContain('beforeEach2');
});

test('beforeAll should be run once', async ({ runInlineTest }) => {
  const report = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.describe('suite1', () => {
        let counter = 0;
        test.beforeAll(async () => {
          console.log('beforeAll1-' + (++counter));
        });
        test.describe('suite2', () => {
          test.beforeAll(async () => {
            console.log('beforeAll2');
          });
          test('one', async ({}) => {
            console.log('test');
          });
        });
      });
    `,
  });
  expect(report.output).toContain('beforeAll1-1\nbeforeAll2\ntest');
});

test('beforeEach should be able to skip a test', async ({ runInlineTest }) => {
  const { passed, skipped, exitCode } = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.beforeEach(async ({}, testInfo) => {
        testInfo.skip(testInfo.title === 'test2');
      });
      test('test1', async () => {});
      test('test2', async () => {});
    `,
  });
  expect(exitCode).toBe(0);
  expect(passed).toBe(1);
  expect(skipped).toBe(1);
});

test('beforeAll from a helper file should throw', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'my-test.ts': `
      export const test = pwt.test;
      test.beforeAll(() => {});
    `,
    'playwright.config.ts': `
      import { test } from './my-test';
    `,
    'a.test.ts': `
      import { test } from './my-test';
      test('should work', async () => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('beforeAll hook can only be called in a test file');
});

test('beforeAll hooks are skipped when no tests in the suite are run', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.describe('suite1', () => {
        test.beforeAll(() => {
          console.log('\\n%%beforeAll1');
        });
        test('skipped', () => {});
      });
      test.describe('suite2', () => {
        test.beforeAll(() => {
          console.log('\\n%%beforeAll2');
        });
        test.only('passed', () => {});
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('%%beforeAll2');
  expect(result.output).not.toContain('%%beforeAll1');
});

test('should run hooks after failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.describe('suite', () => {
        test('faled', ({}) => {
          console.log('\\n%%test');
          expect(1).toBe(2);
        });
        test.afterEach(() => {
          console.log('\\n%%afterEach-1');
        });
        test.afterAll(() => {
          console.log('\\n%%afterAll-1');
        });
      });
      test.afterEach(async () => {
        await new Promise(f => setTimeout(f, 1000));
        console.log('\\n%%afterEach-2');
      });
      test.afterAll(async () => {
        await new Promise(f => setTimeout(f, 1000));
        console.log('\\n%%afterAll-2');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test',
    '%%afterEach-1',
    '%%afterEach-2',
    '%%afterAll-1',
    '%%afterAll-2',
  ]);
});

test('beforeAll hook should get retry index of the first test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.beforeAll(({}, testInfo) => {
        console.log('\\n%%beforeall-retry-' + testInfo.retry);
      });
      test('passed', ({}, testInfo) => {
        console.log('\\n%%test-retry-' + testInfo.retry);
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%beforeall-retry-0',
    '%%test-retry-0',
    '%%beforeall-retry-1',
    '%%test-retry-1',
  ]);
});

test('afterAll exception should fail the run', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.afterAll(() => {
        throw new Error('From the afterAll');
      });
      test('passed', () => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('From the afterAll');
});

test('max-failures should still run afterEach/afterAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
      test.afterEach(() => {
        console.log('\\n%%afterEach');
      });
      test('failed', async () => {
        console.log('\\n%%test');
        test.expect(1).toBe(2);
      });
      test('skipped', async () => {
        console.log('\\n%%skipped');
      });
    `,
  }, { 'max-failures': 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test',
    '%%afterEach',
    '%%afterAll',
  ]);
});

test('beforeAll failure should prevent the test, but not afterAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.beforeAll(() => {
        console.log('\\n%%beforeAll');
        throw new Error('From a beforeAll');
      });
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
      test('skipped', () => {
        console.log('\\n%%test');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%beforeAll',
    '%%afterAll',
  ]);
});

test('fixture error should not prevent afterAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        foo: async ({}, use) => {
          await use('foo');
          throw new Error('bad fixture');
        },
      });
      test('good test', ({ foo }) => {
        console.log('\\n%%test');
      });
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('bad fixture');
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test',
    '%%afterAll',
  ]);
});

test('afterEach failure should not prevent afterAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('good test', ({ }) => {
        console.log('\\n%%test');
      });
      test.afterEach(() => {
        console.log('\\n%%afterEach');
        throw new Error('bad afterEach');
      })
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('bad afterEach');
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test',
    '%%afterEach',
    '%%afterAll',
  ]);
});

test('afterAll error should not mask beforeAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.beforeAll(() => {
        throw new Error('from beforeAll');
      });
      test.afterAll(() => {
        throw new Error('from afterAll');
      })
      test('test', () => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('from beforeAll');
});

test('beforeAll timeout should be reported', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.beforeAll(async () => {
        console.log('\\n%%beforeAll');
        await new Promise(f => setTimeout(f, 5000));
      });
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
      test('skipped', () => {
        console.log('\\n%%test');
      });
    `,
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%beforeAll',
    '%%afterAll',
  ]);
  expect(result.output).toContain('Timeout of 1000ms exceeded in beforeAll hook.');
});

test('afterAll timeout should be reported', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.afterAll(async () => {
        console.log('\\n%%afterAll');
        await new Promise(f => setTimeout(f, 5000));
      });
      test('runs', () => {
        console.log('\\n%%test');
      });
    `,
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test',
    '%%afterAll',
  ]);
  expect(result.output).toContain('Timeout of 1000ms exceeded in afterAll hook.');
});

test('beforeAll and afterAll timeouts at the same time should be reported', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.beforeAll(async () => {
        console.log('\\n%%beforeAll');
        await new Promise(f => setTimeout(f, 5000));
      });
      test.afterAll(async () => {
        console.log('\\n%%afterAll');
        await new Promise(f => setTimeout(f, 5000));
      });
      test('skipped', () => {
        console.log('\\n%%test');
      });
    `,
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%beforeAll',
    '%%afterAll',
  ]);
  expect(result.output).toContain('Timeout of 1000ms exceeded in beforeAll hook.');
});

test('afterEach should get the test status and duration right away', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.afterEach(({}, testInfo) => {
        const duration = testInfo.duration ? 'XXms' : 'none';
        console.log('\\n%%' + testInfo.title + ': ' + testInfo.status + '; ' + duration);
      });
      test('failing', () => {
        throw new Error('Oh my!');
      });
      test('timing out', async () => {
        test.setTimeout(100);
        await new Promise(() => {});
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%failing: failed; XXms',
    '%%timing out: timedOut; XXms',
  ]);
});

test('uncaught error in beforeEach should not be masked by another error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        foo: async ({}, use) => {
          let cb;
          await use(new Promise((f, r) => cb = r));
          cb(new Error('Oh my!'));
        },
      });
      test.beforeEach(async ({ foo }, testInfo) => {
        setTimeout(() => {
          expect(1).toBe(2);
        }, 0);
        await foo;
      });
      test('passing', () => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(stripAscii(result.output)).toContain('Expected: 2');
  expect(stripAscii(result.output)).toContain('Received: 1');
});

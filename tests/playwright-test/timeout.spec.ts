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

test('should run fixture teardown on timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        foo: async ({}, run, testInfo) => {
          await run();
          console.log('STATUS:' + testInfo.status);
        }
      });
    `,
    'c.spec.ts': `
      import { test } from './helper';
      test('works', async ({ foo }) => {
        await new Promise(f => setTimeout(f, 100000));
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('STATUS:timedOut');
});

test('should respect test.setTimeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 1500));
      });
      test('passes', async ({}) => {
        await new Promise(f => setTimeout(f, 500));
        test.setTimeout(2000);
        await new Promise(f => setTimeout(f, 1000));
      });

      test.describe('suite', () => {
        test.beforeEach(() => {
          test.setTimeout(2000);
        });
        test('passes2', async ({}, testInfo) => {
          expect(testInfo.timeout).toBe(2000);
          await new Promise(f => setTimeout(f, 1500));
        });
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
});

test('should respect test.setTimeout outside of the test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test.setTimeout(1000);
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 1100));
      });
      test('passes', async ({}) => {
        await new Promise(f => setTimeout(f, 100));
      });

      test.describe('suite', () => {
        test.setTimeout(500);
        test('fails', async ({}) => {
          await new Promise(f => setTimeout(f, 600));
        });
        test('passes', async ({}) => {
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
  expect(result.output).toContain('Test timeout of 500ms exceeded.');
});

test('should timeout when calling test.setTimeout too late', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 500));
        test.setTimeout(100);
        await new Promise(f => setTimeout(f, 1));
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Test timeout of 100ms exceeded.');
});

test('should respect test.slow', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 1500));
      });
      test('passes', async ({}) => {
        test.slow();
        await new Promise(f => setTimeout(f, 1500));
      });

      test.describe('suite', () => {
        test.slow();
        test('passes2', async ({}, testInfo) => {
          expect(testInfo.timeout).toBe(3000);
          await new Promise(f => setTimeout(f, 1500));
        });
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
});

test('should ignore test.setTimeout when debugging', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use) => {
          test.setTimeout(100);
          await new Promise(f => setTimeout(f, 200));
          await use('hey');
        },
      });
      test('my test', async ({ fixture }) => {
        test.setTimeout(1000);
        await new Promise(f => setTimeout(f, 2000));
      });
    `
  }, { debug: true });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect fixture timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 300));
          await use('hey');
          await new Promise(f => setTimeout(f, 300));
        }, { timeout: 1000 }],
        noTimeout: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 300));
          await use('hey');
          await new Promise(f => setTimeout(f, 300));
        }, { timeout: 0 }],
        slowSetup: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 2000));
          await use('hey');
        }, { timeout: 500, title: 'custom title' }],
        slowTeardown: [async ({}, use) => {
          await use('hey');
          await new Promise(f => setTimeout(f, 2000));
        }, { timeout: 400 }],
      });
      test('test ok', async ({ fixture, noTimeout }) => {
        await new Promise(f => setTimeout(f, 1000));
      });
      test('test setup', async ({ slowSetup }) => {
      });
      test('test teardown', async ({ slowTeardown }) => {
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.output).toContain('Fixture "custom title" timeout of 500ms exceeded during setup.');
  expect(result.output).toContain('Fixture "slowTeardown" timeout of 400ms exceeded during teardown.');
  expect(result.output).toContain('> 3 |       const test = base.extend({');
});

test('should respect test.setTimeout in the worker fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 300));
          await use('hey');
          await new Promise(f => setTimeout(f, 300));
        }, { scope: 'worker', timeout: 1000 }],
        noTimeout: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 300));
          await use('hey');
          await new Promise(f => setTimeout(f, 300));
        }, { scope: 'worker', timeout: 0 }],
        slowSetup: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 2000));
          await use('hey');
        }, { scope: 'worker', timeout: 500 }],
        slowTeardown: [async ({}, use) => {
          await use('hey');
          await new Promise(f => setTimeout(f, 2000));
        }, { scope: 'worker', timeout: 400, title: 'custom title' }],
      });
      test('test ok', async ({ fixture, noTimeout }) => {
        await new Promise(f => setTimeout(f, 1000));
      });
      test('test setup', async ({ slowSetup }) => {
      });
      test('test teardown', async ({ slowTeardown }) => {
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Fixture "slowSetup" timeout of 500ms exceeded during setup.');
  expect(result.output).toContain('Fixture "custom title" timeout of 400ms exceeded during teardown.');
});

test('fixture time in beforeAll hook should not affect test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use) => {
          await new Promise(f => setTimeout(f, 2000));
          await use('hey');
        },
      });
      test.beforeAll(async ({ fixture }) => {
        // Nothing to see here.
      });
      test('test ok', async ({}) => {
        test.setTimeout(1000);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('fixture timeout in beforeAll hook should not affect test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 1000));
          await use('hey');
        }, { timeout: 1600 }],
      });
      test.beforeAll(async ({ fixture }) => {
        // Nothing to see here.
      });
      test('test ok', async ({}) => {
        test.setTimeout(2000);
        await new Promise(f => setTimeout(f, 1600));
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('fixture time in beforeEach hook should affect test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use) => {
          await new Promise(f => setTimeout(f, 500));
          await use('hey');
        },
      });
      test.beforeEach(async ({ fixture }) => {
        // Nothing to see here.
      });
      test('test ok', async ({}) => {
        test.setTimeout(1000);
        await new Promise(f => setTimeout(f, 800));
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
});

test('test timeout should still run hooks before fixtures teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        auto: [async ({}, use) => {
          console.log('\\n%%before-auto');
          await use('hey');
          console.log('\\n%%after-auto');
        }, { auto: true }]
      });
      test.afterAll(async () => {
        console.log('\\n%%afterAll-1');
        await new Promise(f => setTimeout(f, 500));
        console.log('\\n%%afterAll-2');
      });
      test.afterEach(async () => {
        console.log('\\n%%afterEach');
      });
      test('test fail', async ({}) => {
        test.setTimeout(100);
        console.log('\\n%%test');
        await new Promise(f => setTimeout(f, 800));
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 100ms exceeded.');
  expect(result.outputLines).toEqual([
    'before-auto',
    'test',
    'afterEach',
    'after-auto',
    'afterAll-1',
    'afterAll-2',
  ]);
});

test('should not include fixtures with own timeout and beforeAll in test duration', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'c.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({}, use) => {
          await new Promise(f => setTimeout(f, 1000));
          await use('foo');
        }, { timeout: 0 }],

        bar: async ({}, use) => {
          await new Promise(f => setTimeout(f, 300));
          await use('bar');
        },
      });

      test.beforeAll(async () => {
        await new Promise(f => setTimeout(f, 1000));
      });

      test.beforeEach(async () => {
        await new Promise(f => setTimeout(f, 300));
      });

      test.afterEach(async () => {
        await new Promise(f => setTimeout(f, 300));
      });

      test('works', async ({ foo, bar }) => {
        await new Promise(f => setTimeout(f, 300));
      });
    `
  }, { timeout: 5000 });
  expect(result.exitCode).toBe(0);
  const duration = result.results[0].duration;
  expect(duration).toBeGreaterThanOrEqual(300 * 4);  // Includes test, beforeEach, afterEach and bar.
  expect(duration).toBeLessThan(300 * 4 + 1000);  // Does not include beforeAll and foo.
});

test('should run fixture teardowns after timeout with soft expect error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        foo: async ({}, run, testInfo) => {
          await run();
          await new Promise(f => setTimeout(f, 500));
          testInfo.attachments.push({ name: 'foo', contentType: 'text/plain', body: Buffer.from('foo') });
        },
        bar: async ({ foo }, run, testInfo) => {
          await run(foo);
          await new Promise(f => setTimeout(f, 500));
          testInfo.attachments.push({ name: 'bar', contentType: 'text/plain', body: Buffer.from('bar') });
        },
      });
    `,
    'c.spec.ts': `
      import { test } from './helper';
      test('works', async ({ bar }) => {
        expect.soft(1).toBe(2);
        await new Promise(f => setTimeout(f, 5000));
      });
    `
  }, { timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  const test = result.report.suites[0].specs[0].tests[0];
  expect(test.results[0].attachments[0]).toEqual({
    name: 'bar',
    body: 'YmFy',
    contentType: 'text/plain',
  });
  expect(test.results[0].attachments[1]).toEqual({
    name: 'foo',
    body: 'Zm9v',
    contentType: 'text/plain',
  });
});

test('should respect test.describe.configure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ timeout: 1000 });
      test('test1', async ({}) => {
        console.log('test1-' + test.info().timeout);
      });
      test.describe(() => {
        test.describe.configure({ timeout: 2000 });
        test.describe(() => {
          test('test2', async ({}) => {
            console.log('test2-' + test.info().timeout);
          });
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('test1-1000');
  expect(result.output).toContain('test2-2000');
});

test('beforeEach timeout should prevent others from running', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async () => {
        console.log('\\n%%beforeEach1');
        await new Promise(f => setTimeout(f, 2500));
      });
      test.beforeEach(async () => {
        console.log('\\n%%beforeEach2');
      });
      test('test', async ({}) => {
      });
      test.afterEach(async () => {
        console.log('\\n%%afterEach');
        await new Promise(f => setTimeout(f, 1500));
      });
    `
  }, { timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual(['beforeEach1', 'afterEach']);
});

test('should report up to 3 timeout errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base } from '@playwright/test';

      const test = base.extend<{}, { autoWorker: void }>({
        autoWorker: [
          async ({}, use) => {
            await use();
            await new Promise(() => {});
          },
          { scope: 'worker', auto: true },
        ],
      })

      test('test1', async () => {
        await new Promise(() => {});
      });

      test.afterEach(async () => {
        await new Promise(() => {});
      });

      test.afterAll(async () => {
        await new Promise(() => {});
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
  expect(result.output).toContain('Test timeout of 1000ms exceeded while running "afterEach" hook.');
  expect(result.output).toContain('Worker teardown timeout of 1000ms exceeded while tearing down "autoWorker".');
});

test('should complain when worker fixture times out during worker cleanup', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        slowTeardown: [async ({}, use) => {
          await use('hey');
          await new Promise(f => setTimeout(f, 2000));
        }, { scope: 'worker', auto: true, timeout: 400 }],
      });
      test('test ok', async ({ slowTeardown }) => {
        expect(slowTeardown).toBe('hey');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain(`Fixture "slowTeardown" timeout of 400ms exceeded during teardown.`);
});

test('should allow custom worker fixture timeout longer than force exit cap', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        slowTeardown: [async ({}, use) => {
          await use('hey');
          await new Promise(f => setTimeout(f, 1500));
          console.log('output from teardown');
          throw new Error('Oh my!');
        }, { scope: 'worker', auto: true, timeout: 2000 }],
      });
      test('test ok', async ({ slowTeardown }) => {
        expect(slowTeardown).toBe('hey');
      });
    `
  }, {}, { PWTEST_FORCE_EXIT_TIMEOUT: '400' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain(`output from teardown`);
  expect(result.output).toContain(`Error: Oh my!`);
  expect(result.output).toContain(`1 error was not a part of any test, see above for details`);
});

test('should run fixture teardown with custom timeout after test timeout', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31537' },
}, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({}, use) => {
          console.log('\\n%%foo setup');
          await use('foo');
          console.log('\\n%%foo teardown');
        }, { timeout: 2000 }],
      });
      test('times out', async ({ foo }) => {
        console.log('\\n%%test start');
        await new Promise(() => {});
        console.log('\\n%%test end');
      });
    `
  }, { timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual([
    'foo setup',
    'test start',
    'foo teardown',
  ]);
});

test('should run fixture teardown with custom timeout after afterEach timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      let counter = 0;
      const test = base.extend({
        foo: [async ({}, use) => {
          console.log('\\n%%foo setup');
          await use('foo' + (++counter));
          console.log('\\n%%foo teardown');
        }, { timeout: 2000 }],
      });
      test.afterEach(async () => {
        console.log('\\n%%afterEach start');
        await new Promise(() => {});
        console.log('\\n%%afterEach end');
      });
      test.afterAll(async ({ foo }) => {
        // Note: afterAll should receive a new instance of the "foo" fixture.
        console.log('\\n%%afterAll - ' + foo);
      });
      test('times out', async ({ foo }) => {
        console.log('\\n%%test - ' + foo);
      });
    `
  }, { timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual([
    'foo setup',
    'test - foo1',
    'afterEach start',
    'foo teardown',
    'foo setup',
    'afterAll - foo2',
    'foo teardown',
  ]);
});

test('test.setTimeout should be able to change custom fixture timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({}, use) => {
          console.log('\\n%%foo setup');
          test.setTimeout(100);
          await new Promise(f => setTimeout(f, 3000));
          await use('foo');
          console.log('\\n%%foo teardown');
        }, { timeout: 0 }],
      });
      test('times out', async ({ foo }) => {
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain(`Fixture "foo" timeout of 100ms exceeded during setup`);
});

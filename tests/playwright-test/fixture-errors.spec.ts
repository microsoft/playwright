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

test('should handle fixture timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        timeout: async ({}, runTest) => {
          await runTest();
          await new Promise(f => setTimeout(f, 100000));
        }
      });

      test('fixture timeout', async ({timeout}) => {
        expect(1).toBe(1);
      });

      test('failing fixture timeout', async ({timeout}) => {
        expect(1).toBe(2);
      });
    `
  }, { timeout: 500 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Timeout of 500ms');
  expect(result.failed).toBe(2);
});

test('should handle worker fixture timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        timeout: [async ({}, runTest) => {
          await runTest();
          await new Promise(f => setTimeout(f, 100000));
        }, { scope: 'worker' }]
      });

      test('fails', async ({timeout}) => {
      });
    `
  }, { timeout: 500 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Timeout of 500ms');
});

test('should handle worker fixture error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        failure: [async ({}, runTest) => {
          throw new Error('Worker failed');
        }, { scope: 'worker' }]
      });

      test('fails', async ({failure}) => {
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Worker failed');
});

test('should handle worker tear down fixture error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        failure: [async ({}, runTest) => {
          await runTest();
          throw new Error('Worker failed');
        }, { scope: 'worker' }]
      });

      test('pass', async ({failure}) => {
        expect(true).toBe(true);
      });
    `
  });
  expect(result.report.errors[0].message).toContain('Worker failed');
  expect(result.exitCode).toBe(1);
});

test('should throw when using non-defined super worker fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        foo: [async ({ foo }, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });

      test('works', async ({foo}) => {});
    `
  });
  expect(result.output).toContain(`Fixture "foo" references itself, but does not have a base implementation.`);
  expect(result.output).toContain('a.spec.ts:5:29');
  expect(result.exitCode).toBe(1);
});

test('should throw when defining test fixture with the same name as a worker fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'e.spec.ts': `
      const test1 = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });
      const test2 = test1.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'test' }]
      });

      test2('works', async ({foo}) => {});
    `,
  });
  expect(result.output).toContain(`Fixture "foo" has already been registered as a { scope: 'worker' } fixture.`);
  expect(result.output).toContain(`e.spec.ts:10`);
  expect(result.output).toContain(`e.spec.ts:5`);
  expect(result.exitCode).toBe(1);
});

test('should throw when defining worker fixture with the same name as a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'e.spec.ts': `
      const test1 = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'test' }]
      });
      const test2 = test1.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });

      test2('works', async ({foo}) => {});
    `,
  });
  expect(result.output).toContain(`Fixture "foo" has already been registered as a { scope: 'test' } fixture.`);
  expect(result.output).toContain(`e.spec.ts:10`);
  expect(result.output).toContain(`e.spec.ts:5`);
  expect(result.exitCode).toBe(1);
});

test('should throw when worker fixture depends on a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      const test = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'test' }],

        bar: [async ({ foo }, runTest) => {
          await runTest();
        }, { scope: 'worker' }],
      });

      test('works', async ({bar}) => {});
    `,
  });
  expect(result.output).toContain('Worker fixture "bar" cannot depend on a test fixture "foo".');
  expect(result.output).toContain(`f.spec.ts:5`);
  expect(result.exitCode).toBe(1);
});

test('should throw when beforeAll hook depends on a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      const test = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'test' }],
      });

      test.beforeAll(async ({ foo }) => {});
      test('works', async ({ foo }) => {});
    `,
  });
  expect(result.output).toContain('beforeAll hook cannot depend on a test fixture "foo".');
  expect(result.output).toContain(`f.spec.ts:11:12`);
  expect(result.output).toContain(`f.spec.ts:5:29`);
  expect(result.exitCode).toBe(1);
});

test('should throw when afterAll hook depends on a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      const test = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'test' }],
      });

      test.afterAll(async ({ foo }) => {});
      test('works', async ({ foo }) => {});
    `,
  });
  expect(result.output).toContain('afterAll hook cannot depend on a test fixture "foo".');
  expect(result.output).toContain(`f.spec.ts:11:12`);
  expect(result.output).toContain(`f.spec.ts:5:29`);
  expect(result.exitCode).toBe(1);
});

test('should define the same fixture in two files', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test1 = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });

      test1('works', async ({foo}) => {});
    `,
    'b.spec.ts': `
      const test2 = pwt.test.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });

      test2('works', async ({foo}) => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should detect fixture dependency cycle', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'x.spec.ts': `
      const test = pwt.test.extend({
        good1: async ({}, run) => run(),
        foo: async ({bar}, run) => run(),
        bar: async ({baz}, run) => run(),
        good2: async ({good1}, run) => run(),
        baz: async ({qux}, run) => run(),
        qux: async ({foo}, run) => run(),
      });

      test('works', async ({foo}) => {});
    `,
  });
  expect(result.output).toContain('Fixtures "bar" -> "baz" -> "qux" -> "foo" -> "bar" form a dependency cycle.');
  expect(result.output).toContain('"foo" defined at');
  expect(result.output).toContain('"bar" defined at');
  expect(result.output).toContain('"baz" defined at');
  expect(result.output).toContain('"qux" defined at');
  expect(result.output).toContain('x.spec.ts:5:29');
  expect(result.exitCode).toBe(1);
});

test('should not reuse fixtures from one file in another one', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({ foo: ({}, run) => run() });
      test('test1', async ({}) => {});
    `,
    'b.spec.ts': `
      const test = pwt.test;
      test('test1', async ({}) => {});
      test('test2', async ({foo}) => {});
    `,
  });
  expect(result.output).toContain('Test has unknown parameter "foo".');
  expect(result.output).toContain('b.spec.ts:7:7');
});

test('should throw for cycle in two overrides', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test1 = pwt.test.extend({
        foo: async ({}, run) => await run('foo'),
        bar: async ({}, run) => await run('bar'),
      });
      const test2 = test1.extend({
        foo: async ({ foo, bar }, run) => await run(foo + '-' + bar),
      });
      const test3 = test2.extend({
        bar: async ({ bar, foo }, run) => await run(bar + '-' + foo),
      });

      test3('test', async ({foo, bar}) => {
        expect(1).toBe(1);
      });
    `,
  });
  expect(result.output).toContain('Fixtures "bar" -> "foo" -> "bar" form a dependency cycle.');
  expect(result.output).toContain('a.test.js:9');
  expect(result.output).toContain('a.test.js:12');
});

test('should throw when overridden worker fixture depends on a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      const test1 = pwt.test.extend({
        foo: async ({}, run) => await run('foo'),
        bar: [ async ({}, run) => await run('bar'), { scope: 'worker' } ],
      });
      const test2 = test1.extend({
        bar: async ({ foo }, run) => await run(),
      });

      test2('works', async ({bar}) => {});
    `,
  });
  expect(result.output).toContain('Worker fixture "bar" cannot depend on a test fixture "foo".');
  expect(result.exitCode).toBe(1);
});

test('should throw for unknown fixture parameter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      const test = pwt.test.extend({
        foo: async ({ bar }, run) => await run('foo'),
      });

      test('works', async ({ foo }) => {});
    `,
  });
  expect(result.output).toContain('Fixture "foo" has unknown parameter "bar".');
  expect(result.output).toContain('f.spec.ts:5:29');
  expect(result.exitCode).toBe(1);
});

test('should throw when calling runTest twice', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      const test = pwt.test.extend({
        foo: async ({}, run) => {
          await run();
          await run();
        }
      });

      test('works', async ({foo}) => {});
    `,
  });
  expect(result.results[0].error.message).toBe('Cannot provide fixture value for the second time');
  expect(result.exitCode).toBe(1);
});

test('should print nice error message for problematic fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'x.spec.ts': `
      const test = pwt.test.extend({
        bad: [ undefined, { get scope() { throw new Error('oh my!') } } ],
      });
      test('works', async ({foo}) => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('oh my!');
  expect(result.output).toContain('x.spec.ts:6:49');
});

test('should exit with timeout when fixture causes an exception in the test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const test = pwt.test.extend({
        throwAfterTimeout: async ({}, use) => {
          let callback;
          const promise = new Promise((f, r) => callback = r);
          await use(promise);
          callback(new Error('BAD'));
        },
      });
      test('times out and throws', async ({ throwAfterTimeout }) => {
        await throwAfterTimeout;
      });
    `,
  }, { timeout: 500 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Timeout of 500ms exceeded');
});

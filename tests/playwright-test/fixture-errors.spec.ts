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

import { test, expect, countTimes } from './playwright-test-fixtures';

test('should handle fixture timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
  expect(result.output).toContain('Tearing down "timeout" exceeded the test timeout of 500ms.');
  expect(result.failed).toBe(2);
});

test('should handle worker fixture timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
  expect(result.output).toContain('Worker teardown timeout of 500ms exceeded while tearing down "timeout".');
});

test('should handle worker fixture error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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

test('should handle worker tear down fixture error after failed test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        failure: [async ({}, runTest) => {
          await runTest();
          throw new Error('Worker failed');
        }, { scope: 'worker' }]
      });

      test('timeout', async ({failure}) => {
        await new Promise(f => setTimeout(f, 2000));
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
  expect(result.output).toContain('Worker failed');
});

test('should throw when using non-defined super worker fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({ foo }, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });

      test('works', async ({foo}) => {});
    `
  });
  expect(result.output).toContain(`Fixture "foo" references itself, but does not have a base implementation.`);
  expect(result.output).toContain('a.spec.ts:3');
  expect(result.output).toContain('const test = base.extend');
  expect(result.exitCode).toBe(1);
});

test('should throw when defining test fixture with the same name as a worker fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'e.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({
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
  expect(result.output).toContain(`Fixture "foo" has already been registered as a { scope: 'worker' } fixture defined in e.spec.ts:3:26.`);
  expect(result.output).toContain(`e.spec.ts:8`);
  expect(result.output).toContain('const test2 = test1.extend');
  expect(result.exitCode).toBe(1);
});

test('should throw when defining worker fixture with the same name as a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'e.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({
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
  expect(result.output).toContain(`Fixture "foo" has already been registered as a { scope: 'test' } fixture defined in e.spec.ts:3:26.`);
  expect(result.output).toContain(`e.spec.ts:8`);
  expect(result.output).toContain('const test2 = test1.extend');
  expect(result.exitCode).toBe(1);
});

test('should throw when worker fixture depends on a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
  expect(result.output).toContain('worker fixture "bar" cannot depend on a test fixture "foo" defined in f.spec.ts:3:25.');
  expect(result.exitCode).toBe(1);
});

test('should define the same fixture in two files', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({
        foo: [async ({}, runTest) => {
          await runTest();
        }, { scope: 'worker' }]
      });

      test1('works', async ({foo}) => {});
    `,
    'b.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test2 = base.extend({
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
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
  expect(result.output).toContain('Fixtures "bar" -> "baz" -> "qux" -> "foo" -> "bar" form a dependency cycle:');
  expect(result.output).toContain('x.spec.ts:3:25 -> x.spec.ts:3:25 -> x.spec.ts:3:25 -> x.spec.ts:3:25');
  expect(result.exitCode).toBe(1);
});

test('should hide boxed fixtures in dependency cycle', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'x.spec.ts': `
      import { test as base } from '@playwright/test';
      const test = base.extend({
        storageState: async ({ context, storageState }, use) => {
          await use(storageState);
        }
      });
      test('failed', async ({ page }) => {});
    `,
  });
  expect(result.output).toContain('Fixtures "context" -> "storageState" -> "context" form a dependency cycle: <builtin> -> x.spec.ts:3:25 -> <builtin>');
  expect(result.exitCode).toBe(1);
});

test('should show boxed fixtures in dependency cycle if there are no public fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'x.spec.ts': `
      import { test as base } from '@playwright/test';
      const test = base.extend({
        f1: [async ({ f2 }, use) => {
          await use(f2);
        }, { box: true }],
        f2: [async ({ f1 }, use) => {
          await use(f1);
        }, { box: true }],
      });
      test('failed', async ({ f1, f2 }) => {});
    `,
  });
  expect(result.output).toContain('Fixtures "f1" -> "f2" -> "f1" form a dependency cycle: x.spec.ts:3:25 -> x.spec.ts:3:25 -> x.spec.ts:3:25');
  expect(result.exitCode).toBe(1);
});

test('should not reuse fixtures from one file in another one', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({ foo: ({}, run) => run() });
      test('test1', async ({}) => {});
    `,
    'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async ({}) => {});
      test('test2', async ({foo}) => {});
    `,
  });
  expect(result.output).toContain('Test has unknown parameter "foo".');
  expect(result.output).toContain('b.spec.ts:4');
  expect(result.output).toContain(`test('test2', async ({foo}) => {})`);
});

test('should throw for cycle in two overrides', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({
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
  expect(result.output).toContain('Fixtures "bar" -> "foo" -> "bar" form a dependency cycle:');
  expect(result.output).toContain('a.test.js:10:27 -> a.test.js:7:27');
});

test('should throw when overridden worker fixture depends on a test fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({
        foo: async ({}, run) => await run('foo'),
        bar: [ async ({}, run) => await run('bar'), { scope: 'worker' } ],
      });
      const test2 = test1.extend({
        bar: async ({ foo }, run) => await run(),
      });

      test2('works', async ({bar}) => {});
    `,
  });
  expect(result.output).toContain('worker fixture "bar" cannot depend on a test fixture "foo" defined in f.spec.ts:3:26.');
  expect(result.output).toContain('f.spec.ts:7');
  expect(result.exitCode).toBe(1);
});

test('should throw for unknown fixture parameter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({ bar }, run) => await run('foo'),
      });

      test('works', async ({ foo }) => {});
    `,
  });
  expect(result.output).toContain('Fixture "foo" has unknown parameter "bar".');
  expect(result.output).toContain('f.spec.ts:3');
  expect(result.output).toContain('const test = base.extend');
  expect(result.exitCode).toBe(1);
});

test('should throw when calling runTest twice', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'f.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({}, run) => {
          await run();
          await run();
        }
      });

      test('works', async ({foo}) => {});
    `,
  });
  expect(result.results[0].error.message).toBe('Error: Cannot provide fixture value for the second time');
  expect(result.exitCode).toBe(1);
});

test('should print nice error message for problematic fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'x.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        bad: [ undefined, { get scope() { throw new Error('oh my!') } } ],
      });
      test('works', async ({foo}) => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('oh my!');
  expect(result.output).toContain('x.spec.ts:4:49');
});

test('should exit with timeout when fixture causes an exception in the test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
  expect(result.output).toContain('Test timeout of 500ms exceeded.');
});

test('should error for unsupported scope', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        failure: [async ({}, use) => {
          await use();
        }, { scope: 'foo' }]
      });
      test('skipped', async ({failure}) => {
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Fixture "failure" has unknown { scope: 'foo' }`);
});

test('should give enough time for fixture teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({ }, use) => {
          await use();
          console.log('\\n%%teardown start');
          await new Promise(f => setTimeout(f, 2000));
          console.log('\\n%%teardown finished');
        },
      });
      test('fast enough but close', async ({ fixture }) => {
        test.setTimeout(3000);
        await new Promise(f => setTimeout(f, 2000));
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual([
    'teardown start',
    'teardown finished',
  ]);
});

test('should not give enough time for second fixture teardown after timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture2: async ({ }, use) => {
          await use();
          console.log('\\n%%teardown2 start');
          await new Promise(f => setTimeout(f, 3000));
          console.log('\\n%%teardown2 finished');
        },
        fixture: async ({ fixture2 }, use) => {
          await use();
          console.log('\\n%%teardown start');
          await new Promise(f => setTimeout(f, 3000));
          console.log('\\n%%teardown finished');
        },
      });
      test('fast enough but close', async ({ fixture }) => {
        test.setTimeout(3000);
        await new Promise(f => setTimeout(f, 2000));
      });
    `,
  }, { timeout: 2000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Tearing down "fixture" exceeded the test timeout of 3000ms.');
  expect(result.outputLines).toEqual([
    'teardown start',
    'teardown finished',
  ]);
});

test('should not teardown when setup times out', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({ }, use) => {
          await new Promise(f => setTimeout(f, 1500));
          await use();
          console.log('\\n%%teardown');
        },
      });
      test('fast enough but close', async ({ fixture }) => {
      });
    `,
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 1000ms exceeded while setting up "fixture".');
  expect(result.outputLines).toEqual([
  ]);
});

test('should not report fixture teardown error twice', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({ }, use) => {
          await use();
          throw new Error('Oh my error');
        },
      });
      test('good', async ({ fixture }) => {
      });
    `,
  }, { reporter: 'list' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Error: Oh my error');
  expect(result.output).toContain(`throw new Error('Oh my error')`);
  expect(countTimes(result.output, 'Oh my error')).toBe(2);
});

test('should not report fixture teardown timeout twice', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({ }, use) => {
          await use();
          await new Promise(() => {});
        },
      });
      test('good', async ({ fixture }) => {
      });
    `,
  }, { reporter: 'list', timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Tearing down "fixture" exceeded the test timeout of 1000ms.');
  expect(result.output).not.toContain('base.extend'); // Should not point to the location.
  expect(result.output).not.toContain('Worker teardown timeout');
});

test('should handle fixture teardown error after test timeout and continue', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({ }, use) => {
          await use();
          throw new Error('Oh my error');
        },
      });
      test('bad', async ({ fixture }) => {
        test.setTimeout(100);
        await new Promise(f => setTimeout(f, 500));
      });
      test('good', async ({}) => {
      });
    `,
  }, { reporter: 'list', workers: '1' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('Test timeout of 100ms exceeded.');
  expect(result.output).toContain('Error: Oh my error');
});

test('should report worker fixture teardown with debug info', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: [ async ({ }, use) => {
          await use();
          await new Promise(() => {});
        }, { scope: 'worker' } ],
      });
      for (let i = 0; i < 20; i++)
        test('good' + i, async ({ fixture }) => {});
    `,
  }, { reporter: 'list', timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(20);
  expect(result.output).toContain([
    'Worker teardown timeout of 1000ms exceeded while tearing down "fixture".',
    '',
    'Failed worker ran 20 tests, last 10 tests were:',
    'a.spec.ts:10:9 › good10',
    'a.spec.ts:10:9 › good11',
    'a.spec.ts:10:9 › good12',
    'a.spec.ts:10:9 › good13',
    'a.spec.ts:10:9 › good14',
    'a.spec.ts:10:9 › good15',
    'a.spec.ts:10:9 › good16',
    'a.spec.ts:10:9 › good17',
    'a.spec.ts:10:9 › good18',
    'a.spec.ts:10:9 › good19',
  ].join('\n'));
});

test('should not run user fn when require fixture has failed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [ async ({ }, use) => {
          console.log('\\n%%foo');
          throw new Error('A test error!');
          await use();
        }, { scope: 'test' } ],
        bar: [ async ({ foo }, use) => {
          console.log('\\n%%bar-' + foo);
          await use();
        }, { scope: 'test' } ],
      });

      test.skip(({ foo }) => {
        console.log('\\n%%skip-' + foo);
        return true;
      });

      test.beforeEach(({ foo }) => {
        console.log('\\n%%beforeEach1-' + foo);
      });

      test.beforeEach(({ foo }) => {
        console.log('\\n%%beforeEach2-' + foo);
      });

      test.beforeEach(({ bar }) => {
        console.log('\\n%%beforeEach3-' + bar);
      });

      test.afterEach(({ foo }) => {
        console.log('\\n%%afterEach1-' + foo);
      });

      test.afterEach(({ bar }) => {
        console.log('\\n%%afterEach2-' + bar);
      });

      test('should not run', async ({ bar }) => {
        console.log('\\n%%test-' + bar);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual([
    'foo',
  ]);
});

test('should provide helpful error message when digests do not match', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        foo: [ async ({}, use) => use(), { scope: 'worker' } ],
      });

      test.use({ foo: 'foo' });
    `,
    'a.spec.ts': `
      import { test, expect } from './helper';

      test('test-a', ({ foo }) => {
        expect(foo).toBe('foo');
      });
    `,
    'b.spec.ts': `
      import { test, expect } from './helper';

      test('test-b', ({ foo }) => {
        expect(foo).toBe('foo');
      });
    `,
    'c.spec.ts': `
      import { test, expect } from './helper';

      test('test-c', ({ foo }) => {
        expect(foo).toBe('foo');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Playwright detected inconsistent test.use() options.');
});

test('tear down base fixture after error in derived', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        context: async ({}, use, testInfo) => {
          console.log('\\n%%context setup ' + testInfo.status);
          await use();
          console.log('\\n%%context teardown ' + testInfo.status);
        },
        page: async ({ context }, use, testInfo) => {
          console.log('\\n%%page setup ' + testInfo.status);
          await use();
          console.log('\\n%%page teardown ' + testInfo.status);
          throw new Error('Error in page teardown');
        },
      });
      test('test', async ({ page }) => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual([
    'context setup passed',
    'page setup passed',
    'page teardown passed',
    'context teardown failed',
  ]);
});

test('should not continue with scope teardown after fixture teardown timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({ }, use) => {
          await use();
          console.log('in fixture teardown');
        },
        fixture2: async ({ fixture }, use) => {
          await use();
          console.log('in fixture2 teardown');
          await new Promise(() => {});
        },
      });
      test.use({ trace: 'on' });
      test('good', async ({ fixture2 }) => {
      });
    `,
  }, { reporter: 'list', timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Tearing down "fixture2" exceeded the test timeout of 1000ms.');
  expect(result.output).not.toContain('in fixture teardown');
});

test('should report fixture teardown error after test error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({ }, use) => {
          await use();
          throw new Error('Error from the fixture foo');
        },
      });
      test('fails', async ({ foo }) => {
        throw new Error('Error from the test');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Error from the fixture foo');
  expect(result.output).toContain('Error from the test');
});

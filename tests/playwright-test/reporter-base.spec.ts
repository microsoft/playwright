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
import * as path from 'path';

for (const useIntermediateMergeReport of [false, true] as const) {
  test.describe(`${useIntermediateMergeReport ? 'merged' : 'created'}`, () => {
    test.use({ useIntermediateMergeReport });

    test('handle long test names', async ({ runInlineTest }) => {
      const title = 'title'.repeat(30);
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('${title}', async ({}) => {
            expect(1).toBe(0);
          });
        `,
      });
      expect(result.output).toContain('expect(1).toBe');
      expect(result.exitCode).toBe(1);
    });

    test('print the error name', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('foobar', async ({}) => {
          const error = new Error('my-message');
          error.name = 'FooBarError';
          throw error;
        });
        `
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('FooBarError: my-message');
    });

    test('print should print the error name without a message', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
        import { test, expect } from '@playwright/test';
        test('foobar', async ({}) => {
          const error = new Error();
          error.name = 'FooBarError';
          throw error;
        });
        `
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('FooBarError');
    });

    test('should print an error in a codeframe', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}) => {
            const error = new Error('my-message');
            error.name = 'FooBarError';
            throw error;
          });
        `
      }, {}, {
        FORCE_COLOR: '0',
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('FooBarError: my-message');
      expect(result.output).not.toContain('at a.spec.ts:5');
      expect(result.output).toContain(`  2 |           import { test, expect } from '@playwright/test';`);
      expect(result.output).toContain(`  3 |           test('foobar', async ({}) => {`);
      expect(result.output).toContain(`> 4 |             const error = new Error('my-message');`);
    });

    test('should filter out node_modules error in a codeframe', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'node_modules/utils/utils.js': `
          function assert(value) {
            if (!value)
              throw new Error('Assertion error');
          }
          module.exports = { assert };
        `,
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          const { assert } = require('utils/utils.js');
          test('fail', async ({}) => {
            assert(false);
          });
        `
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      const output = result.output;
      expect(output).toContain('Error: Assertion error');
      expect(output).toContain('a.spec.ts:4:15 › fail');
      expect(output).toContain(`  4 |           test('fail', async ({}) => {`);
      expect(output).toContain(`> 5 |             assert(false);`);
      expect(output).toContain(`    |             ^`);
      expect(output).toContain(`utils.js:4`);
      expect(output).toContain(`a.spec.ts:5:13`);
    });

    test('should print codeframe from a helper', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'helper.ts': `
          export function ohMy() {
            throw new Error('oh my');
          }
        `,
        'a.spec.ts': `
          import { ohMy } from './helper';
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}) => {
            ohMy();
          });
        `
      }, {}, {
        FORCE_COLOR: '0',
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('Error: oh my');
      expect(result.output).toContain(`   2 |           export function ohMy() {`);
      expect(result.output).toContain(` > 3 |             throw new Error('oh my');`);
      expect(result.output).toContain(`     |                   ^`);
    });

    test('should print slow tests', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            projects: [
              { name: 'foo' },
              { name: 'bar' },
              { name: 'baz' },
              { name: 'qux' },
            ],
            reportSlowTests: { max: 0, threshold: 2400 },
          };
        `,
        'dir/a.test.js': `
          import { test, expect } from '@playwright/test';
          test('slow test', async ({}) => {
            await new Promise(f => setTimeout(f, 2500));
          });
        `,
        'dir/b.test.js': `
          import { test, expect } from '@playwright/test';
          test('fast test', async ({}) => {
            await new Promise(f => setTimeout(f, 1));
          });
        `,
      });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(8);
      expect(result.output).toContain(`Slow test file: [foo] › dir${path.sep}a.test.js (`);
      expect(result.output).toContain(`Slow test file: [bar] › dir${path.sep}a.test.js (`);
      expect(result.output).toContain(`Slow test file: [baz] › dir${path.sep}a.test.js (`);
      expect(result.output).toContain(`Slow test file: [qux] › dir${path.sep}a.test.js (`);
      expect(result.output).toContain(`Consider splitting slow test files to speed up parallel execution`);
      expect(result.output).not.toContain(`Slow test file: [foo] › dir${path.sep}b.test.js (`);
      expect(result.output).not.toContain(`Slow test file: [bar] › dir${path.sep}b.test.js (`);
      expect(result.output).not.toContain(`Slow test file: [baz] › dir${path.sep}b.test.js (`);
      expect(result.output).not.toContain(`Slow test file: [qux] › dir${path.sep}b.test.js (`);
    });

    test('should print if maxFailures is reached', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            maxFailures: 1,
          };
        `,
        'dir/a.test.js': `
          import { test, expect } from '@playwright/test';
          test('failing1', async ({}) => {
            expect(1).toBe(2);
          });
          test('failing2', async ({}) => {
            expect(1).toBe(2);
          });
          test('failing3', async ({}) => {
            expect(1).toBe(2);
          });
        `,
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.passed).toBe(0);
      expect(result.didNotRun).toBe(2);
      expect(result.output).toContain('Testing stopped early after 1 maximum allowed failures.');
    });

    test('should print if globalTimeout is reached', async ({ runInlineTest }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29768' });
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            globalTimeout: 3000,
          };
        `,
        'dir/a.test.js': `
          import { test, expect } from '@playwright/test';
          test('first', async ({}) => {
          });
          test('second (hanging)', async ({}) => {
            await new Promise(() => {});
          });
          test('third', async ({}) => {
          });
        `,
      });
      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(1);
      // TODO: uncomment once https://github.com/microsoft/playwright/issues/30550 is fixed.
      // expect(result.interrupted).toBe(1);
      // expect(result.didNotRun).toBe(1);
      expect(result.output).toContain('Timed out waiting 3s for the test suite to run');
    });

    test('should not print slow parallel tests', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reportSlowTests: { max: 0, threshold: 500 },
          };
        `,
        'dir/a.test.js': `
          import { test, expect } from '@playwright/test';
          test.describe.parallel('suite', () => {
            test('inner slow test', async ({}) => {
              await new Promise(f => setTimeout(f, 1000));
            });
            test('inner fast test', async ({}) => {
              await new Promise(f => setTimeout(f, 100));
            });
          });
        `,
      });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(2);
      expect(result.output).not.toContain('Slow test file');
    });

    test('should not print slow tests', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            projects: [
              { name: 'baz' },
              { name: 'qux' },
            ],
            reportSlowTests: null,
          };
        `,
        'dir/a.test.js': `
          import { test, expect } from '@playwright/test';
          test('slow test', async ({}) => {
            await new Promise(f => setTimeout(f, 1000));
          });
          test('fast test', async ({}) => {
            await new Promise(f => setTimeout(f, 100));
          });
        `,
      });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(4);
      expect(result.output).not.toContain('Slow test');
    });

    test('should print flaky failures', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(1);
          });
        `
      }, { retries: '1', reporter: 'list' });
      expect(result.exitCode).toBe(0);
      expect(result.flaky).toBe(1);
      expect(result.output).toContain('expect(testInfo.retry).toBe(1)');
    });

    test('should print flaky timeouts', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}, testInfo) => {
            if (!testInfo.retry)
              await new Promise(f => setTimeout(f, 2000));
          });
        `
      }, { retries: '1', reporter: 'list', timeout: '1000' });
      expect(result.exitCode).toBe(0);
      expect(result.flaky).toBe(1);
      expect(result.output).toContain('Test timeout of 1000ms exceeded.');
    });

    test('should print stack-less errors', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}) => {
            const e = new Error('Hello');
            delete e.stack;
            throw e;
          });
        `
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.output).toContain('Hello');
    });

    test('should print errors with inconsistent message/stack', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async function myTest({}) {
            const e = new Error('Hello');
            // Force stack to contain "Hello".
            // Otherwise it is computed lazy and will get 'foo bar' instead.
            e.stack;
            e.message = 'foo bar';
            throw e;
          });
        `
      });
      expect(result.exitCode).toBe(1);
      expect(result.failed).toBe(1);
      const output = result.output;
      expect(output).toContain('foo bar');
      expect(output).toContain('function myTest');
    });

    test('should print "no tests found" error', async ({ runInlineTest }) => {
      const result = await runInlineTest({ });
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('No tests found');
    });

    test('should not crash on undefined body with manual attachments', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            testInfo.attachments.push({
              name: 'foo.txt',
              body: undefined,
              contentType: 'text/plain'
            });
            expect(1).toBe(2);
          });
        `,
      });
      expect(result.output).not.toContain('Error in reporter');
      expect(result.failed).toBe(1);
      expect(result.exitCode).toBe(1);
    });

    test('should report fatal errors at the end', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test as base, expect } from '@playwright/test';
          const test = base.extend({
            fixture: [async ({ }, use) => {
              await use();
              throw new Error('oh my!');
            }, { scope: 'worker' }],
          });
          test('good', async ({ fixture }) => {
          });
        `,
        'b.spec.ts': `
          import { test as base, expect } from '@playwright/test';
          const test = base.extend({
            fixture: [async ({ }, use) => {
              await use();
              throw new Error('oh my!');
            }, { scope: 'worker' }],
          });
          test('good', async ({ fixture }) => {
          });
        `,
      }, { reporter: 'list' });
      expect(result.exitCode).toBe(1);
      expect(result.passed).toBe(2);
      expect(result.output).toContain('2 errors were not a part of any test, see above for details');
    });

    test('should contain at most 1 decimal for humanized timing', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('should work', () => {});
        `
      });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);
      expect(result.output).toMatch(/\d+ passed \(\d+(\.\d)?(ms|s)\)/);
    });
  });
}
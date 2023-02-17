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
import path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('it should not allow multiple tests with the same name per suite', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/example.spec.js': `
      import { test, expect } from '@playwright/test';
      test.describe('suite', () => {
        test('i-am-a-duplicate', async () => {});
      });
      test.describe('suite', () => {
        test('i-am-a-duplicate', async () => {});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Error: duplicate test title`);
  expect(result.output).toContain(`i-am-a-duplicate`);
  expect(result.output).toContain(`tests${path.sep}example.spec.js:4`);
  expect(result.output).toContain(`tests${path.sep}example.spec.js:7`);
});

test('it should not allow multiple tests with the same name in multiple files', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/example1.spec.js': `
      import { test, expect } from '@playwright/test';
      test('i-am-a-duplicate', async () => {});
      test('i-am-a-duplicate', async () => {});
    `,
    'tests/example2.spec.js': `
      import { test, expect } from '@playwright/test';
      test('i-am-a-duplicate', async () => {});
      test('i-am-a-duplicate', async () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: duplicate test title');
  expect(result.output).toContain(`test('i-am-a-duplicate'`);
  expect(result.output).toContain(`tests${path.sep}example1.spec.js:3`);
  expect(result.output).toContain(`tests${path.sep}example1.spec.js:4`);
  expect(result.output).toContain(`tests${path.sep}example2.spec.js:3`);
  expect(result.output).toContain(`tests${path.sep}example2.spec.js:4`);
});

test('it should not allow a focused test when forbid-only is used', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/focused-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test.only('i-am-focused', async () => {});
    `
  }, { 'forbid-only': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: focused item found in the --forbid-only mode');
  expect(result.output).toContain(`test.only('i-am-focused'`);
  expect(result.output).toContain(`tests${path.sep}focused-test.spec.js:3`);
});

test('should continue with other tests after worker process suddenly exits', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('passed1', () => {});
      test('passed2', () => {});
      test('failed1', () => { process.exit(0); });
      test('passed3', () => {});
      test('passed4', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(1);
  expect(result.skipped).toBe(0);
  expect(result.output).toContain('Internal error: worker process exited unexpectedly');
});

test('sigint should stop workers', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('interrupted1', async () => {
        console.log('\\n%%SEND-SIGINT%%1');
        await new Promise(f => setTimeout(f, 3000));
      });
      test('skipped1', async () => {
        console.log('\\n%%skipped1');
      });
    `,
    'b.spec.js': `
      import { test, expect } from '@playwright/test';
      test('interrupted2', async () => {
        console.log('\\n%%SEND-SIGINT%%2');
        await new Promise(f => setTimeout(f, 3000));
      });
      test('skipped2', async () => {
        console.log('\\n%%skipped2');
      });
    `,
  }, { 'workers': 2, 'reporter': 'line,json' }, {}, { sendSIGINTAfter: 2 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(2);
  expect(result.interrupted).toBe(2);
  expect(result.output).toContain('%%SEND-SIGINT%%1');
  expect(result.output).toContain('%%SEND-SIGINT%%2');
  expect(result.output).not.toContain('%%skipped1');
  expect(result.output).not.toContain('%%skipped2');
  expect(result.output).toContain('Test was interrupted.');
  expect(result.output).not.toContain('Test timeout of');

  const interrupted2 = result.report.suites[1].specs[0];
  expect(interrupted2.title).toBe('interrupted2');
  expect(interrupted2.tests[0].results[0].workerIndex === 0 || interrupted2.tests[0].results[0].workerIndex === 1).toBe(true);

  const skipped2 = result.report.suites[1].specs[1];
  expect(skipped2.title).toBe('skipped2');
  expect(skipped2.tests[0].results[0].workerIndex).toBe(-1);
});

test('should use the first occurring error when an unhandled exception was thrown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'unhandled-exception.spec.js': `
      const { test: base, expect } = require('@playwright/test');
      const test = base.extend({
        context: async ({}, test) => {
          await test(123)
          let errorWasThrownPromiseResolve = () => {}
          const errorWasThrownPromise = new Promise(resolve => errorWasThrownPromiseResolve = resolve);
          setTimeout(() => {
            errorWasThrownPromiseResolve();
            throw new Error('second error');
          }, 0)
          await errorWasThrownPromise;
        },
        page: async ({ context}, test) => {
          throw new Error('first error');
          await test(123)
        },
      });

      test('my-test', async ({ page }) => { });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].error!.message).toBe('first error');
});

test('worker interrupt should report errors', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        throwOnTeardown: async ({}, use) => {
          let reject;
          await use(new Promise((f, r) => reject = r));
          reject(new Error('INTERRUPT'));
        },
      });
      test('interrupted', async ({ throwOnTeardown }) => {
        console.log('\\n%%SEND-SIGINT%%');
        await throwOnTeardown;
      });
    `,
  }, {}, {}, { sendSIGINTAfter: 1 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.interrupted).toBe(1);
  expect(result.output).toContain('%%SEND-SIGINT%%');
  expect(result.output).toContain('Error: INTERRUPT');
});

test('should not stall when workers are available', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      const { writeFile, waitForFile } = require('./utils.js');
      test('fails-1', async ({}, testInfo) => {
        await waitForFile(testInfo, 'lockA');
        console.log('\\n%%fails-1-started');
        writeFile(testInfo, 'lockB');
        console.log('\\n%%fails-1-done');
        expect(1).toBe(2);
      });
      test('passes-1', async ({}, testInfo) => {
        console.log('\\n%%passes-1');
        writeFile(testInfo, 'lockC');
      });
    `,
    'b.spec.js': `
      import { test, expect } from '@playwright/test';
      const { writeFile, waitForFile } = require('./utils.js');
      test('passes-2', async ({}, testInfo) => {
        console.log('\\n%%passes-2-started');
        writeFile(testInfo, 'lockA');
        await waitForFile(testInfo, 'lockB');
        await waitForFile(testInfo, 'lockC');
        console.log('\\n%%passes-2-done');
      });
    `,
    'utils.js': `
      const fs = require('fs');
      const path = require('path');

      function fullName(testInfo, file) {
        return path.join(testInfo.config.projects[0].outputDir, file);
      }

      async function waitForFile(testInfo, file) {
        const fn = fullName(testInfo, file);
        while (true) {
          if (fs.existsSync(fn))
            return;
          await new Promise(f => setTimeout(f, 100));
        }
      }

      function writeFile(testInfo, file) {
        const fn = fullName(testInfo, file);
        fs.mkdirSync(path.dirname(fn), { recursive: true });
        fs.writeFileSync(fn, '0');
      }

      module.exports = { writeFile, waitForFile };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual([
    'passes-2-started',
    'fails-1-started',
    'fails-1-done',
    'passes-1',
    'passes-2-done',
  ]);
});

test('should teardown workers that are redundant', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.js': `
      const { test: base, expect } = require('@playwright/test');
      module.exports = base.extend({
        w: [async ({}, use) => {
          console.log('\\n%%worker setup');
          await use('worker');
          console.log('\\n%%worker teardown');
        }, { scope: 'worker' }],
      });
    `,
    'a.spec.js': `
      const test = require('./helper');
      test('test1', async ({ w }) => {
        await new Promise(f => setTimeout(f, 1500));
        console.log('\\n%%test-done');
      });
    `,
    'b.spec.js': `
      const test = require('./helper');
      test('test2', async ({ w }) => {
        await new Promise(f => setTimeout(f, 3000));
        console.log('\\n%%test-done');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toEqual([
    'worker setup',
    'worker setup',
    'test-done',
    'worker teardown',
    'test-done',
    'worker teardown',
  ]);
});

test('should not hang if test suites in worker are inconsistent with runner', async ({ runInlineTest }) => {
  const oldValue = process.env.TEST_WORKER_INDEX;
  delete process.env.TEST_WORKER_INDEX;
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { name: 'project-name' };
    `,
    'names.js': `
    exports.getNames = () => {
      const inWorker = process.env.TEST_WORKER_INDEX !== undefined;
      if (inWorker)
        return ['foo'];
      return ['foo', 'bar', 'baz'];
    };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      const { getNames } = require('./names');
      const names = getNames();
      for (const index in names) {
        test('Test ' + index + ' - ' + names[index], async () => {
        });
      }
    `,
  }, { 'workers': 1 });
  process.env.TEST_WORKER_INDEX = oldValue;
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.report.suites[0].specs[1].tests[0].results[0].error!.message).toBe('Internal error: unknown test(s) in worker:\nproject-name > a.spec.js > Test 1 - bar\nproject-name > a.spec.js > Test 2 - baz');
});

test('sigint should stop global setup', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = () => {
        console.log('Global setup');
        console.log('%%SEND-SIGINT%%');
        return new Promise(f => setTimeout(f, 30000));
      };
    `,
    'globalTeardown.ts': `
      module.exports = () => {
        console.log('Global teardown');
      };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', async () => { });
    `,
  }, { 'workers': 1 }, {}, { sendSIGINTAfter: 1 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  const output = result.output;
  expect(output).toContain('Global setup');
  expect(output).not.toContain('Global teardown');
});

test('sigint should stop plugins', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'playwright.config.ts': `
      const _plugins = [];
      _plugins.push(() => ({
        setup: async () => {
          console.log('Plugin1 setup');
          console.log('%%SEND-SIGINT%%');
          return new Promise(f => setTimeout(f, 30000));
        },
        teardown: async () => {
          console.log('Plugin1 teardown');
        }
      }));

      _plugins.push(() => ({
        setup: async () => {
          console.log('Plugin2 setup');
        },
        teardown: async () => {
          console.log('Plugin2 teardown');
        }
      }));
      module.exports = {
        _plugins
      };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', async () => { });
    `,
  }, { 'workers': 1 }, {}, { sendSIGINTAfter: 1 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  const output = result.output;
  expect(output).toContain('Plugin1 setup');
  expect(output).not.toContain('Plugin1 teardown');
  expect(output).not.toContain('Plugin2 setup');
  expect(output).not.toContain('Plugin2 teardown');
});

test('sigint should stop plugins 2', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'playwright.config.ts': `
      const _plugins = [];
      _plugins.push(() => ({
        setup: async () => {
          console.log('Plugin1 setup');
        },
        teardown: async () => {
          console.log('Plugin1 teardown');
        }
      }));

      _plugins.push(() => ({
        setup: async () => {
          console.log('Plugin2 setup');
          console.log('%%SEND-SIGINT%%');
          return new Promise(f => setTimeout(f, 30000));
        },
        teardown: async () => {
          console.log('Plugin2 teardown');
        }
      }));
      module.exports = { _plugins };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', async () => { });
    `,
  }, { 'workers': 1 }, {}, { sendSIGINTAfter: 1 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  const output = result.output;
  expect(output).toContain('Plugin1 setup');
  expect(output).toContain('Plugin2 setup');
  expect(output).toContain('Plugin1 teardown');
  expect(output).not.toContain('Plugin2 teardown');
});

test('should not crash with duplicate titles and .only', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('non unique title', () => { console.log('do not run me'); });
      test.skip('non unique title', () => { console.log('do not run me'); });
      test.only('non unique title', () => { console.log('do run me'); });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Error: duplicate test title`);
  expect(result.output).toContain(`test('non unique title'`);
  expect(result.output).toContain(`test.skip('non unique title'`);
  expect(result.output).toContain(`test.only('non unique title'`);
  expect(result.output).toContain(`example.spec.ts:3`);
  expect(result.output).toContain(`example.spec.ts:4`);
  expect(result.output).toContain(`example.spec.ts:5`);
});

test('should not crash with duplicate titles and line filter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('non unique title', () => { console.log('do not run me'); });
      test.skip('non unique title', () => { console.log('do not run me'); });
      test('non unique title', () => { console.log('do run me'); });
    `
  }, {}, {}, { additionalArgs: ['example.spec.ts:6'] });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Error: duplicate test title`);
  expect(result.output).toContain(`test('non unique title'`);
  expect(result.output).toContain(`example.spec.ts:3`);
  expect(result.output).toContain(`example.spec.ts:4`);
  expect(result.output).toContain(`example.spec.ts:5`);
});

test('should not load tests not matching filter', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      console.log('in a.spec.ts');
      test('test1', () => {});
    `,
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';
      console.log('in example.spec.ts');
      test('test2', () => {});
  `

  }, {}, {}, { additionalArgs: ['a.spec.ts'] });
  expect(result.exitCode).toBe(0);
  expect(result.output).not.toContain('in example.spec.ts');
  expect(result.output).toContain('in a.spec.ts');
});

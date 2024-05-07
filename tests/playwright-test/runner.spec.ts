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

import fs from 'fs';
import path from 'path';
import { test, expect, parseTestRunnerOutput, countTimes } from './playwright-test-fixtures';

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
    'playwright.config.ts': `
      module.exports = {
        forbidOnly: true,
      };
    `,
    'tests/focused-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test.only('i-am-focused', async () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Error: item focused with '.only' is not allowed due to the 'forbidOnly' option in 'playwright.config.ts': \"tests${path.sep}focused-test.spec.js i-am-focused\"`);
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
  expect(result.output).toContain('Error: worker process exited unexpectedly');
});

test('should report subprocess creation error', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'preload.js': `
      process.exit(42);
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('fails', () => {});
      test('does not run', () => {});
      // Infect subprocesses to immediately exit when spawning a worker.
      process.env.NODE_OPTIONS = '--require ${JSON.stringify(testInfo.outputPath('preload.js').replace(/\\/g, '\\\\'))}';
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(1);
  expect(result.output).toContain('Error: worker process exited unexpectedly (code=42, signal=null)');
});

test('should ignore subprocess creation error because of SIGINT', async ({ interactWithTestRunner }, testInfo) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const readyFile = testInfo.outputPath('ready.txt');
  const testProcess = await interactWithTestRunner({
    'hang.js': `
      require('fs').writeFileSync(${JSON.stringify(readyFile)}, 'ready');
      setInterval(() => {}, 1000);
    `,
    'preload.js': `
      require('child_process').spawnSync(
        process.argv[0],
        [require('path').resolve('./hang.js')],
        { env: { ...process.env, NODE_OPTIONS: '' } },
      );
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('fails', () => {});
      test('skipped', () => {});
      // Infect subprocesses to immediately hang when spawning a worker.
      process.env.NODE_OPTIONS = '--require ${JSON.stringify(testInfo.outputPath('preload.js'))}';
    `
  });

  while (!fs.existsSync(readyFile))
    await new Promise(f => setTimeout(f, 100));
  process.kill(-testProcess.process.pid!, 'SIGINT');

  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.didNotRun).toBe(2);
  expect(result.output).not.toContain('worker process exited unexpectedly');
});

test('sigint should stop workers', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
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
  }, { 'workers': 2, 'reporter': 'line,json' }, {
    PW_TEST_REPORTER: path.join(__dirname, '../../packages/playwright/lib/reporters/json.js'),
    PLAYWRIGHT_JSON_OUTPUT_NAME: 'report.json',
  });
  await testProcess.waitForOutput('%%SEND-SIGINT%%', 2);
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.didNotRun).toBe(2);
  expect(result.interrupted).toBe(2);
  expect(result.output).toContain('%%SEND-SIGINT%%1');
  expect(result.output).toContain('%%SEND-SIGINT%%2');
  expect(result.output).not.toContain('%%skipped1');
  expect(result.output).not.toContain('%%skipped2');
  expect(result.output).toContain('Test was interrupted.');
  expect(result.output).not.toContain('Test timeout of');

  const report = JSON.parse(fs.readFileSync(test.info().outputPath('report.json'), 'utf8'));
  const interrupted2 = report.suites[1].specs[0];
  expect(interrupted2.title).toBe('interrupted2');
  expect(interrupted2.tests[0].results[0].workerIndex === 0 || interrupted2.tests[0].results[0].workerIndex === 1).toBe(true);

  const skipped2 = report.suites[1].specs[1];
  expect(skipped2.title).toBe('skipped2');
  expect(skipped2.tests[0].results).toHaveLength(0);
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
  expect(result.report.suites[0].specs[0].tests[0].results[0].error!.message).toBe('Error: first error');
});

test('worker interrupt should report errors', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
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
  });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
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
  }, { 'workers': 1 }, { TEST_WORKER_INDEX: undefined });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.skipped).toBe(0);
  const expectedError = 'Test not found in the worker process. Make sure test title does not change.';
  expect(countTimes(result.output, expectedError)).toBe(2);  // Once per each test that was missing.
});

test('sigint should stop global setup', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
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
  }, { 'workers': 1 });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Global setup');
  expect(result.output).not.toContain('Global teardown');
});

test('sigint should stop plugins', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'playwright.config.ts': `
      const plugins = [];
      plugins.push(() => ({
        setup: async () => {
          console.log('Plugin1 setup');
          console.log('%%SEND-SIGINT%%');
          return new Promise(f => setTimeout(f, 30000));
        },
        teardown: async () => {
          console.log('Plugin1 teardown');
        }
      }));

      plugins.push(() => ({
        setup: async () => {
          console.log('Plugin2 setup');
        },
        teardown: async () => {
          console.log('Plugin2 teardown');
        }
      }));
      module.exports = {
        '@playwright/test': { plugins }
      };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', async () => {
        console.log('testing!');
      });
    `,
  }, { 'workers': 1 });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Plugin1 setup');
  expect(result.output).toContain('Plugin1 teardown');
  expect(result.output).not.toContain('Plugin2 setup');
  expect(result.output).not.toContain('Plugin2 teardown');
  expect(result.output).not.toContain('testing!');
});

test('sigint should stop plugins 2', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'playwright.config.ts': `
      const plugins = [];
      plugins.push(() => ({
        setup: async () => {
          console.log('Plugin1 setup');
        },
        teardown: async () => {
          console.log('Plugin1 teardown');
        }
      }));

      plugins.push(() => ({
        setup: async () => {
          console.log('Plugin2 setup');
          console.log('%%SEND-SIGINT%%');
          return new Promise(f => setTimeout(f, 30000));
        },
        teardown: async () => {
          console.log('Plugin2 teardown');
        }
      }));
      module.exports = { '@playwright/test': { plugins } };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', async () => {
        console.log('testing!');
      });
    `,
  }, { 'workers': 1 });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Plugin1 setup');
  expect(result.output).toContain('Plugin2 setup');
  expect(result.output).toContain('Plugin1 teardown');
  expect(result.output).toContain('Plugin2 teardown');
  expect(result.output).not.toContain('testing!');
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

test('should filter by sourcemapped file names', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'gherkin.spec.js': `

import { test } from '@playwright/test';
test('should run', () => {});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImdoZXJraW4uZmVhdHVyZSJdLCJuYW1lcyI6WyJOb25lIl0sIm1hcHBpbmdzIjoiQUFBQUE7QUFBQUE7QUFBQUE7QUFBQUE7QUFBQUE7QUFBQUEiLCJmaWxlIjoiZ2hlcmtpbi5mZWF0dXJlIiwic291cmNlc0NvbnRlbnQiOlsiVGVzdCJdfQ==`,

    'another.spec.js': `

throw new Error('should not load another.spec.js');
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFub3RoZXIuZmVhdHVyZSJdLCJuYW1lcyI6WyJOb25lIl0sIm1hcHBpbmdzIjoiQUFBQUE7QUFBQUE7QUFBQUE7QUFBQUE7QUFBQUE7QUFBQUEiLCJmaWxlIjoiZ2hlcmtpbi5mZWF0dXJlIiwic291cmNlc0NvbnRlbnQiOlsiVGVzdCJdfQ==`,

    'nomap.spec.js': `

throw new Error('should not load nomap.spec.js');`,
  }, {}, {}, { additionalArgs: ['gherkin.feature'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain('spec.js');
  expect(result.output).not.toContain('another.feature.js');
  expect(result.output).not.toContain('should not load');
  expect(result.output).toContain('gherkin.feature:1');
});

test('should not hang on worker error in test file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'example.spec.js': `
      import { test, expect } from '@playwright/test';
      if (process.env.TEST_WORKER_INDEX)
        process.exit(1);
      test('test 1', async () => {});
      test('test 2', async () => {});
    `,
  }, { 'timeout': 3000 });
  expect(result.exitCode).toBe(1);
  expect(result.results[0].status).toBe('failed');
  expect(result.results[0].error.message).toContain('Error: worker process exited unexpectedly');
  expect(result.results[1].status).toBe('skipped');
});

test('fast double SIGINT should be ignored', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'playwright.config.ts': `
      export default { globalTeardown: './globalTeardown.ts' };
    `,
    'globalTeardown.ts': `
      export default async function() {
        console.log('teardown1');
        await new Promise(f => setTimeout(f, 2000));
        console.log('teardown2');
      }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('interrupted', async ({ }) => {
        console.log('\\n%%SEND-SIGINT%%');
        await new Promise(() => {});
      });
    `,
  });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  // Send SIGINT twice in quick succession.
  process.kill(-testProcess.process.pid!, 'SIGINT');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.interrupted).toBe(1);
  expect(result.output).toContain('teardown1');
  expect(result.output).toContain('teardown2');
});

test('slow double SIGINT should be respected', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'playwright.config.ts': `
      export default { globalTeardown: './globalTeardown.ts' };
    `,
    'globalTeardown.ts': `
      export default async function() {
        console.log('teardown1');
        await new Promise(f => setTimeout(f, 1000000));
      }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('interrupted', async ({ }) => {
        console.log('\\n%%SEND-SIGINT%%');
        await new Promise(() => {});
      });
    `,
  });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  await new Promise(f => setTimeout(f, 2000));
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode } = await testProcess.exited;
  expect(exitCode).toBe(130);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.interrupted).toBe(1);
  expect(result.output).toContain('teardown1');
});

test('slow double SIGINT should be respected in reporter.onExit', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const testProcess = await interactWithTestRunner({
    'playwright.config.ts': `
      export default { reporter: './reporter' }
    `,
    'reporter.ts': `
      export default class MyReporter {
        onStdOut(chunk) {
          process.stdout.write(chunk);
        }

        async onExit() {
          // This emulates html reporter, without opening a tab in the default browser.
          console.log('MyReporter.onExit started');
          await new Promise(f => setTimeout(f, 100000));
          console.log('MyReporter.onExit finished');
        }
      }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('interrupted', async ({ }) => {
        console.log('\\n%%SEND-SIGINT%%');
        await new Promise(() => {});
      });
    `,
  }, { reporter: '' });
  await testProcess.waitForOutput('%%SEND-SIGINT%%');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  await new Promise(f => setTimeout(f, 2000));
  await testProcess.waitForOutput('MyReporter.onExit started');
  process.kill(-testProcess.process.pid!, 'SIGINT');
  const { exitCode, signal } = await testProcess.exited;
  expect(exitCode).toBe(null);
  expect(signal).toBe('SIGINT');  // Default handler should report the signal.

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.output).toContain('MyReporter.onExit started');
  expect(result.output).not.toContain('MyReporter.onExit finished');
});

test('unhandled exception in test.fail should restart worker and continue', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('bad', async () => {
        test.fail();
        console.log('\\n%%bad running worker=' + test.info().workerIndex);
        setTimeout(() => {
          throw new Error('oh my!');
        }, 0);
        await new Promise(f => setTimeout(f, 1000));
      });

      test('good', () => {
        console.log('\\n%%good running worker=' + test.info().workerIndex);
      });
    `
  }, { retries: 1, reporter: 'list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.outputLines).toEqual(['bad running worker=0', 'good running worker=1']);
});

test('wait for workers to finish before reporter.onEnd', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30550' });
  test.fixme();
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        globalTimeout: 2000,
        fullyParallel: true,
        reporter: './reporter'
      }
    `,
    'reporter.ts': `
      export default class MyReporter {
        onTestEnd(test) {
          console.log('MyReporter.onTestEnd', test.title);
        }
        onEnd(status) {
          console.log('MyReporter.onEnd');
        }
        async onExit() {
          console.log('MyReporter.onExit');
        }
      }
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('first', async ({ }) => {
        await new Promise(() => {});
      });
      test('second', async ({ }) => {
        expect(1).toBe(2);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  const endIndex = result.output.indexOf('MyReporter.onEnd');
  expect(endIndex).not.toBe(-1);
  const firstIndex = result.output.indexOf('MyReporter.onTestEnd first');
  expect(firstIndex).not.toBe(-1);
  expect(firstIndex).toBeLessThan(endIndex);
  const secondIndex = result.output.indexOf('MyReporter.onTestEnd second');
  expect(secondIndex).not.toBe(-1);
  expect(secondIndex).toBeLessThan(endIndex);
});

test('should run last failed tests', async ({ runInlineTest }) => {
  const workspace = {
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('pass', async () => {});
      test('fail', async () => {
        expect(1).toBe(2);
      });
    `
  };
  const result1 = await runInlineTest(workspace);
  expect(result1.exitCode).toBe(1);
  expect(result1.passed).toBe(1);
  expect(result1.failed).toBe(1);

  const result2 = await runInlineTest(workspace, {}, {}, { additionalArgs: ['--last-failed'] });
  expect(result2.exitCode).toBe(1);
  expect(result2.passed).toBe(0);
  expect(result2.failed).toBe(1);
});

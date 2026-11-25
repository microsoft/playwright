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

import { test, expect } from './playwright-test-fixtures';

function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000000 | 0);
}

test('should collect stdio', async ({ runInlineTest }) => {
  const { exitCode, report } = await runInlineTest({
    'stdio.spec.js': `
      import { test, expect } from '@playwright/test';
      test('stdio', () => {
        process.stdout.write('stdout text');
        process.stdout.write(Buffer.from('\\x1b[31mstdout buffer 😀\\x1b[0m'));
        process.stderr.write('stderr text');
        process.stderr.write(Buffer.from('stderr café', 'latin1'));
      });
    `
  });
  expect(exitCode).toBe(0);
  const testResult = report.suites[0].specs[0].tests[0].results[0];
  const { stdout, stderr } = testResult;
  expect(stdout).toEqual([{ text: 'stdout text' }, { text: '\x1b[31mstdout buffer 😀\x1b[0m' }]);
  expect(stderr).toEqual([{ text: 'stderr text' }, { buffer: Buffer.from('stderr café', 'latin1').toString('base64') }]);
});

test('should collect stdio from forked process', async ({ runInlineTest }) => {
  const { exitCode, report } = await runInlineTest({
    'stdio.spec.js': `
      import { test } from '@playwright/test';
      import { fork } from 'child_process';
      test('stdio', async () => {
        const child = fork('fork.js');
        await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
      });
    `,
    'fork.js': `
      process.stdout.write('stdout text');
      process.stdout.write(Buffer.from('stdout buffer'));
      process.stderr.write('stderr text');
      process.stderr.write(Buffer.from('stderr buffer'));
    `
  });
  expect(exitCode).toBe(0);
  const testResult = report.suites[0].specs[0].tests[0].results[0];
  const { stdout, stderr } = testResult;
  expect(stdout.map(e => (e as any).text).join('')).toEqual('stdout textstdout buffer');
  expect(stderr.map(e => (e as any).text).join('')).toEqual('stderr textstderr buffer');
});

test('should work with not defined errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'is-not-defined-error.spec.ts': `
      foo();
    `
  });
  expect(result.output).toContain('foo is not defined');
  expect(result.exitCode).toBe(1);
});

test('should work with typescript', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'global-foo.js': `
      global.foo = true;
      module.exports = {
        abc: 123
      };
    `,
    'typescript.spec.ts': `
      import './global-foo';

      import { test, expect } from '@playwright/test';
      test('should find global foo', () => {
        expect(global['foo']).toBe(true);
      });

      test('should work with type annotations', () => {
        const x: number = 5;
        expect(x).toBe(5);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should repeat each', async ({ runInlineTest }) => {
  const { exitCode, report, passed } = await runInlineTest({
    'one-success.spec.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { 'repeat-each': 3 });
  expect(exitCode).toBe(0);
  expect(passed).toBe(3);
  expect(report.suites.length).toBe(1);
  expect(report.suites[0].specs.length).toBe(1);
  expect(report.suites[0].specs[0].tests.length).toBe(3);
});

test('should allow flaky', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('flake', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.flaky).toBe(1);
});

test('failOnFlakyTests flag disallows flaky', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('flake', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { 'retries': 1, 'fail-on-flaky-tests': true });
  expect(result.exitCode).not.toBe(0);
  expect(result.flaky).toBe(1);
});

test('should fail on unexpected pass', async ({ runInlineTest }) => {
  const { exitCode, failed, output } = await runInlineTest({
    'unexpected-pass.spec.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {
        test.fail();
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(exitCode).toBe(1);
  expect(failed).toBe(1);
  expect(output).toContain('Expected to fail, but passed');
});

test('should respect global timeout', async ({ runInlineTest }) => {
  const now = monotonicTime();
  const { exitCode, output } = await runInlineTest({
    'one-timeout.spec.js': `
      import { test, expect } from '@playwright/test';
      test('timeout', async () => {
        await new Promise(f => setTimeout(f, 10000));
      });
    `
  }, { 'timeout': 100000, 'global-timeout': 3000 });
  expect(exitCode).toBe(1);
  expect(output).toContain('Timed out waiting 3s for the test suite to run');
  expect(monotonicTime() - now).toBeGreaterThan(2900);
});

test('should exit with code 1 if the specified folder does not exist', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { testDir: '111111111111.js' };
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`No tests found`);
});

test('should exit with code 1 if passed a file name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { testDir: 'test.spec.js' };
    `,
    'test.spec.js': `
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`No tests found`);
});

test('should exit with code 0 with --pass-with-no-tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { testDir: 'unknown' };
    `,
  }, undefined, undefined, { additionalArgs: ['--pass-with-no-tests'] });
  expect(result.exitCode).toBe(0);
});

test('should exit with code 1 when config is not found', async ({ runInlineTest }) => {
  const result = await runInlineTest({ 'my.config.js': '' }, { 'config': 'foo.config.js' });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`foo.config.js does not exist`);
});

test('should force-kill a worker that does not exit on stop', async ({ runInlineTest }) => {
  const now = monotonicTime();
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        hangOnExit: [async ({}, use) => {
          await use();
          // Disable graceful exit to simulate a worker that cannot self-terminate.
          process.exit = (() => {}) as any;
          setInterval(() => {}, 1000);
        }, { scope: 'worker' }],
      });
      test('passes', async ({ hangOnExit }) => {});
    `,
  }, undefined, { PWTEST_CHILD_PROCESS_TIMEOUT: '2000' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('process did not exit within 2000ms after stop, force-killed it');
  // Should complete well within a minute thanks to the watchdog.
  expect(monotonicTime() - now).toBeLessThan(60000);
});

test('should not force-kill a worker that is running a slow fixture teardown', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42007' });
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend<{}, { slowTeardown: void }>({
        slowTeardown: [async ({}, use) => {
          await use();
          await new Promise(f => setTimeout(f, 4000));
          console.log('slow teardown finished');
        }, { scope: 'worker', timeout: 0 }],
      });
      test('passes', async ({ slowTeardown }) => {});
    `,
  }, undefined, { PWTEST_CHILD_PROCESS_TIMEOUT: '2000' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('slow teardown finished');
  expect(result.output).not.toContain('force-killed');
});

test('should not fail when the worker artifacts removal does not finish', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44304' },
}, async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import fs from 'fs';
      import path from 'path';
      const rm = fs.promises.rm;
      fs.promises.rm = async (target, ...args) => {
        if (path.basename(String(target)).startsWith('.playwright-artifacts-'))
          await new Promise(() => {});
        return rm(target, ...args);
      };
      export default {};
    `,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('passes', async () => {});
    `,
  }, undefined, { PWTEST_CHILD_PROCESS_TIMEOUT: '2000' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.errors).toEqual([]);
  expect(result.output).not.toContain('force-killed');
  expect(fs.existsSync(testInfo.outputPath('test-results', '.playwright-artifacts-0'))).toBe(true);
});

test('should finish the worker artifacts removal after the worker stop timeout', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44304' },
}, async ({ runInlineTest }, testInfo) => {
  // The worker takes 2500ms to exit and the removal takes 4000ms more. Together they
  // exceed the 5000ms timeout, but each of them is within its own 5000ms timeout.
  const result = await runInlineTest({
    'playwright.config.ts': `
      import fs from 'fs';
      import path from 'path';
      const rm = fs.promises.rm;
      fs.promises.rm = async (target, ...args) => {
        if (path.basename(String(target)).startsWith('.playwright-artifacts-'))
          await new Promise(f => setTimeout(f, 4000));
        return rm(target, ...args);
      };
      export default {};
    `,
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('passes', async () => {
        process.on('exit', () => {
          // Delay process exit without sending another shutdown heartbeat.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
        });
      });
    `,
  }, undefined, { PWTEST_CHILD_PROCESS_TIMEOUT: '5000' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.errors).toEqual([]);
  expect(result.output).not.toContain('force-killed');
  expect(fs.existsSync(testInfo.outputPath('test-results', '.playwright-artifacts-0'))).toBe(false);
});

test('should not start a worker that was stopped before its process started', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import fs from 'fs';
      import path from 'path';
      // Hold the start of the second worker until the first worker stops because of the failure.
      let startSecondWorker;
      const firstWorkerStopped = new Promise(f => startSecondWorker = f);
      const { mkdir, rm } = fs.promises;
      fs.promises.mkdir = async (target, ...args) => {
        if (path.basename(String(target)) === '.playwright-artifacts-1')
          await firstWorkerStopped;
        return mkdir(target, ...args);
      };
      fs.promises.rm = async (target, ...args) => {
        if (path.basename(String(target)) === '.playwright-artifacts-0')
          startSecondWorker();
        return rm(target, ...args);
      };
      export default {};
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async () => {
        expect(1).toBe(2);
      });
    `,
    'b.spec.ts': `
      import { test } from '@playwright/test';
      test('does not run', async () => {
        console.log('%%second worker started');
      });
    `,
  }, { 'max-failures': 1, 'workers': 2 }, { PWTEST_CHILD_PROCESS_TIMEOUT: '2000' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(1);
  expect(result.output).not.toContain('%%second worker started');
  expect(result.output).not.toContain('force-killed');
  expect(fs.existsSync(testInfo.outputPath('test-results', '.playwright-artifacts-1'))).toBe(false);
});

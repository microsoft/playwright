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

import { TestCase, TestResult, TestStep } from 'packages/playwright-test/reporter';
import { ReporterV2 } from 'packages/playwright/src/reporters/reporterV2';
import { test, expect } from './playwright-test-fixtures';

test.describe.configure({ mode: 'parallel' });

class LocationReporter implements ReporterV2 {
  private _foundErrors = 0;
  version() {
    return 'v2' as const;
  }
  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    if (step.title === 'Paused') {
      console.log(`%%onStepBegin: ${step.titlePath().join(' > ')} at :${step.location?.line}:${step.location?.column}`);
      this._printErrors(result);
    }
  }
  async onTestPaused(test: TestCase, result: TestResult) {
    if (result.error)
      console.log(`%%onTestPaused on error at :${result.error.location?.line}:${result.error.location?.column}`);
    else
      console.log(`%%onTestPaused at end`);
    this._printErrors(result);
    if (process.env.SIGINT_AFTER_PAUSE) {
      console.log('%%SIGINT');
      process.kill(process.pid, 'SIGINT');
      await new Promise(() => {});
    }
  }
  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    if (step.title === 'Paused') {
      console.log(`%%onStepEnd: ${step.titlePath().join(' > ')}`);
      this._printErrors(result);
    }
  }
  onTestEnd(test: TestCase, result: TestResult): void {
    console.log('%%onTestEnd');
    this._printErrors(result);
  }
  onStdOut(chunk: string | Buffer) {
    console.log(chunk);
  }
  private _printErrors(result: TestResult) {
    for (const [index, error] of result.errors.entries()) {
      if (index >= this._foundErrors)
        console.log(`%%result.errors[${index}] at :${error.location?.line}:${error.location?.column}`);
    }
    this._foundErrors = result.errors.length;
  }
}

test('--pause should pause at end', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: './location-reporter.js' };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
      });
      test.afterEach(() => {
        console.log('%%teardown');
      });
    `
  }, {}, { PWPAUSE: '1' });
  expect(result.outputLines).toEqual([
    'onTestPaused at end',
    'teardown',
    'onTestEnd',
  ]);
});

test('--pause should pause at end with setup project', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = {
        reporter: './location-reporter.js',
        projects: [
          { name: 'setup', testMatch: /setup\\.test\\.js/ },
          { name: 'main', dependencies: ['setup'] }
        ]
      };
    `,
    'setup.test.js': `
      import { test } from '@playwright/test';
      test('setup', () => {
      });
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        console.log('main test started');
      });
    `
  }, {}, { PWPAUSE: '1' });
  expect(result.outputLines).toContain('onTestPaused at end');
});

test('--pause should pause on error', async ({ runInlineTest, mergeReports }) => {
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: [['./location-reporter.js'], ['blob']] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        expect.soft(1).toBe(2);
        expect(2).toBe(3);
        console.log('%%after error');
      });
    `
  }, {}, { PWPAUSE: '1' });
  expect(result.outputLines).toEqual([
    'onTestPaused on error at :4:24',
    'result.errors[0] at :4:24',
    'result.errors[1] at :5:19',
    'onTestEnd',
  ]);

  const merged = await mergeReports('blob-report', undefined, { additionalArgs: ['--reporter', 'location-reporter.js'] });
  expect(merged.outputLines, 'merge reporter doesnt get onTestPaused').toEqual([
    'onTestEnd',
    'result.errors[0] at :4:24',
    'result.errors[1] at :5:19',
  ]);
});

test('SIGINT after pause at end should still run teardown', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'no SIGINT on windows');
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: './location-reporter.js' };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
      });
      test.afterEach(() => {
        console.log('%%teardown');
      });
    `
  }, {}, { PWPAUSE: '1', SIGINT_AFTER_PAUSE: '1' });
  expect(result.outputLines).toEqual([
    'onTestPaused at end',
    'SIGINT',
    'teardown',
    'onTestEnd',
  ]);
});

test('SIGINT after pause on error should still run teardown', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'no SIGINT on windows');
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: './location-reporter.js' };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        expect(2).toBe(3);
        console.log('%%after error');
      });
      test.afterEach(() => {
        console.log('%%teardown');
      });
    `
  }, {}, { PWPAUSE: '1', SIGINT_AFTER_PAUSE: '1' });
  expect(result.outputLines).toEqual([
    'onTestPaused on error at :4:19',
    'result.errors[0] at :4:19',
    'SIGINT',
    'teardown',
    'onTestEnd',
  ]);
});

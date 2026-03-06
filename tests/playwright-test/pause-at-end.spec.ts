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

import { TestCase, TestResult, TestStep, TestError } from 'packages/playwright-test/reporter';
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
  async onTestPaused(test: TestCase, result: TestResult, error?: TestError) {
    if (error)
      console.log(`%%onTestPaused on error at :${error.location?.line}:${error.location?.column}`);
    else if (result.errors.length)
      console.log(`%%onTestPaused at end with error at :${result.errors[0].location?.line}:${result.errors[0].location?.column}`);
    else
      console.log(`%%onTestPaused at end`);
    this._printErrors(result);
    if (process.env.SIGINT_AFTER_PAUSE) {
      console.log('%%SIGINT');
      process.kill(process.pid, 'SIGINT');
      await new Promise(() => {});
    }
    if (process.env.CONTINUE_ON_PAUSE)
      return { disposition: 'continue' as const };
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
    'onTestPaused at end with error at :4:24',
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
    'onTestPaused at end with error at :4:19',
    'result.errors[0] at :4:19',
    'SIGINT',
    'teardown',
    'onTestEnd',
  ]);
});

test('--pause should continue past async expect failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: './location-reporter.js', expect: { timeout: 1000 } };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('expect failure', async ({ page }) => {
        await expect(page.locator('#missing')).toBeVisible();
        console.log('%%after expect');
      });
    `
  }, {}, { PWPAUSE: '1', CONTINUE_ON_PAUSE: '1' });
  expect(result.outputLines).toEqual([
    'onTestPaused on error at :4:48',
    'after expect',
    'onTestPaused at end',
    'onTestEnd',
  ]);
  expect(result.exitCode).toBe(0);
});

test('--pause should continue past API call failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: './location-reporter.js', use: { actionTimeout: 1000 } };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('api failure', async ({ page }) => {
        await page.click('#missing');
        console.log('%%after click');
      });
    `
  }, {}, { PWPAUSE: '1', CONTINUE_ON_PAUSE: '1' });
  expect(result.outputLines).toEqual([
    'onTestPaused on error at :4:20',
    'after click',
    'onTestPaused at end',
    'onTestEnd',
  ]);
  expect(result.exitCode).toBe(0);
});

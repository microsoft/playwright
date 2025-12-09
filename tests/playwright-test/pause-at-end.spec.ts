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
  async onTestPaused(test: TestCase, result: TestResult, step?: TestStep) {
    console.log(`%%onTestPaused`);
    this._printErrors(result);
    return { action: process.env.ACTION as 'continue' | 'abort' };
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

test('--debug should pause at end', async ({ runInlineTest }) => {
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
  }, { debug: true }, { ACTION: 'continue' });
  expect(result.outputLines).toEqual([
    'onStepBegin: After Hooks > Paused at :4:7',
    'onTestPaused',
    'onStepEnd: After Hooks > Paused',
    'teardown',
    'onTestEnd',
  ]);
});

test('--debug should pause at end with setup project', async ({ runInlineTest }) => {
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
  }, { debug: true }, { ACTION: 'continue' });
  expect(result.outputLines).toContain('onStepBegin: After Hooks > Paused at :5:7');
});

test('--debug should pause on error', async ({ runInlineTest, mergeReports }) => {
  const result = await runInlineTest({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: [['blob'], ['./location-reporter.js']] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        expect.soft(1).toBe(2);
        expect(2).toBe(3);
        console.log('%%after error');
      });
    `
  }, { debug: true }, { ACTION: 'abort' });
  expect(result.outputLines).toEqual([
    'onStepBegin: After Hooks > Paused at :4:24',
    'onTestPaused',
    'result.errors[0] at :4:24',
    'result.errors[1] at :5:19',
    'onStepEnd: After Hooks > Paused',
    'onTestEnd',
  ]);

  const merged = await mergeReports('blob-report', undefined, { additionalArgs: ['--reporter', 'location-reporter.js'] });
  expect(merged.outputLines, 'merge reporter doesnt get onTestPaused').toEqual([
    'onStepBegin: After Hooks > Paused at :4:24',
    'onStepEnd: After Hooks > Paused',
    'onTestEnd',
    'result.errors[0] at :4:24',
    'result.errors[1] at :5:19',
  ]);
});

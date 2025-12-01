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

import { Reporter, TestCase, TestResult, TestStep } from 'packages/playwright-test/reporter';
import { test, expect, parseTestRunnerOutput } from './playwright-test-fixtures';

class LocationReporter implements Reporter {
  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    if (step.title.startsWith('Paused')) {
      console.log('\n');
      console.log(`%%${step.title} at :${step.location?.line}:${step.location?.column}`);
      if (result.error)
        console.log(`%%result.error at :${result.error.location?.line}:${result.error.location?.column}`);
      for (const [index, error] of result.errors.entries())
        console.log(`%%result.errors[${index}] at :${error.location?.line}:${error.location?.column}`);
      console.log('\n');
    }
  }
}

test('--debug should pause at end', async ({ interactWithTestRunner, }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
  const testProcess = await interactWithTestRunner({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: [['list'], ['./location-reporter.js']] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
      });
      test.afterEach(() => {
        console.log('teardown'.toUpperCase()); // uppercase so we dont confuse it with source snippets
      });
    `
  }, { debug: true }, { PLAYWRIGHT_FORCE_TTY: 'true' });
  await testProcess.waitForOutput('Paused at End');
  await testProcess.kill('SIGINT');
  expect(testProcess.output).toContain('TEARDOWN');
  expect(testProcess.outputLines()).toEqual(['Paused at End at :4:7']);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.interrupted).toBe(1);
});

test('--debug should pause at end with setup project', async ({ interactWithTestRunner, }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
  const testProcess = await interactWithTestRunner({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = {
        reporter: [['list'], ['./location-reporter.js']],
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
  }, { debug: true }, { PLAYWRIGHT_FORCE_TTY: 'true' });
  await testProcess.waitForOutput('main test started');
  await testProcess.waitForOutput('Paused at End');
  await testProcess.kill('SIGINT');
  expect(testProcess.outputLines()).toEqual(['Paused at End at :5:7']);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.interrupted).toBe(1);
});

test('--debug should pause on error', async ({ interactWithTestRunner, mergeReports }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
  const testProcess = await interactWithTestRunner({
    'location-reporter.js': `export default ${LocationReporter}`,
    'playwright.config.js': `
      module.exports = { reporter: [['list'], ['blob'], ['./location-reporter.js']] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        expect.soft(1).toBe(2);
        expect(2).toBe(3);
        console.log('after error'.toUpperCase());
      });
    `
  }, { debug: true }, { PLAYWRIGHT_FORCE_TTY: 'true' });
  await testProcess.waitForOutput('Paused on Error');
  expect(testProcess.output).not.toContain('AFTER ERROR');
  await testProcess.kill('SIGINT');
  expect(testProcess.output).not.toContain('AFTER ERROR');
  expect(testProcess.outputLines()).toEqual([
    'Paused on Error at :4:24',
    'result.error at :4:24',
    'result.errors[0] at :4:24',
    'result.errors[1] at :5:19',
  ]);

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.failed).toBe(1);

  const merged = await mergeReports('blob-report', undefined, { additionalArgs: ['--reporter', 'location-reporter.js'] });
  expect(merged.outputLines).toEqual(testProcess.outputLines());
});

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

import { test, expect, parseTestRunnerOutput } from './playwright-test-fixtures';

test('--debug should pause at end', async ({ interactWithTestRunner }) => {
  const testProcess = await interactWithTestRunner({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
      });
      test.afterEach(() => {
        console.log('teardown'.toUpperCase());
      });
    `
  }, { debug: true, reporter: 'list' }, { PLAYWRIGHT_FORCE_TTY: 'true' });
  await testProcess.waitForOutput('Paused at End');
  await testProcess.kill('SIGINT');
  expect(testProcess.output).toContain('TEARDOWN');

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.interrupted).toBe(1);
});

test('--debug should pause on error', async ({ interactWithTestRunner }) => {
  const testProcess = await interactWithTestRunner({
    'playwright.config.js': `
      module.exports = {};
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        throw new Error('error');
        console.log('after error'.toUpperCase());
      });
    `
  }, { debug: true, reporter: 'list' }, { PLAYWRIGHT_FORCE_TTY: 'true' });
  await testProcess.waitForOutput('Paused on Error');
  expect(testProcess.output).not.toContain('AFTER ERROR');
  await testProcess.kill('SIGINT');
  expect(testProcess.output).not.toContain('AFTER ERROR');

  const result = parseTestRunnerOutput(testProcess.output);
  expect(result.failed).toBe(1);
});

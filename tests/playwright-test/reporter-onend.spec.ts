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

const reporter = `
class Reporter {
  async onEnd() {
    return { status: 'passed' };
  }
}
module.exports = Reporter;
`;

test('should override exit code', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': reporter,
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({}) => {
        expect(1 + 1).toBe(3);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should fail run and report error when reporter throws in onEnd', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      export default class Reporter {
        async onEnd() {
          throw new Error('Error in onEnd!');
        }
      }
    `,
    'playwright.config.ts': `module.exports = { reporter: [['dot'], ['./reporter.ts']] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passing', async () => {});
    `,
  }, { reporter: '' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('Error in onEnd!');
});

test('should fail run and report error when reporter throws in onTestEnd', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      export default class Reporter {
        onTestEnd() {
          throw new Error('Error in onTestEnd!');
        }
      }
    `,
    'playwright.config.ts': `module.exports = { reporter: [['dot'], ['./reporter.ts']] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passing', async () => {});
    `,
  }, { reporter: '' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('Error in onTestEnd!');
});

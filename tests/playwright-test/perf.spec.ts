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

test('should not load rare bundles during test run', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {});
    `
  }, {}, { PW_INSTRUMENT_MODULES: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const output = result.output;
  expect(output).toContain('babelBundle');
  expect(output).not.toContain('mcpBundle');
  expect(output).not.toContain('zodBundle');
  expect(output).not.toContain('zipBundle');
});

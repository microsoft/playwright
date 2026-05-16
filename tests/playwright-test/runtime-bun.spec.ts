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

// PW_RUNTIME is always set on workers regardless of the host runtime; under Node it should be 'node'.
test('PW_RUNTIME env var is set to "node" by default on workers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('reports runtime', () => {
        console.log('%%PW_RUNTIME=' + (process.env.PW_RUNTIME ?? '<unset>'));
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toContain('PW_RUNTIME=node');
});

// Smoke test that runs only when actually invoked under bun. Off-by-default in Node CI.
test('basic test executes under bun', async ({ runInlineTest }) => {
  test.skip(!process.versions.bun, 'requires bun runtime');
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('runs', () => {
        expect(1 + 1).toBe(2);
        console.log('%%PW_RUNTIME=' + process.env.PW_RUNTIME);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toContain('PW_RUNTIME=bun');
});

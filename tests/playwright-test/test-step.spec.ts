/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

test('test.step should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;

      test('passed', async ({}) => {
        expect(1).toBe(1);
        await test.step('step 1', async () => {
          expect(1).toBe(1);
          console.log('should run 1.0');
          await test.step('step 1.1', () => {
            expect(1).toBe(1);
            console.log('should run 1.1');
          });
          await test.step('step 1.2', () => {
            expect(1).toBe(1);
            console.log('should run 1.2');
          });
        });
        await test.step('step 2', async () => {
          expect(1).toBe(1);
          console.log('should run 2');
        });
        console.log('should run end');
      });

      test('failed', async ({}) => {
        expect(1).toBe(1);
        await test.step('step 1', async () => {
          expect(1).toBe(1);
          await test.step('step 1.1', () => {
            expect(1).toBe(2);
          });
          console.log('\\nshould not run');
          await test.step('step 1.2', () => {
            expect(1).toBe(1);
          });
        });
        console.log('\\nshould not run');
        await test.step('step 2', async () => {
          expect(1).toBe(1);
        });
      });
    `,
  });

  expect(result.passed).toBe(1);
  expect(result.output).toContain('should run 1.0');
  expect(result.output).toContain('should run 1.1');
  expect(result.output).toContain('should run 1.2');
  expect(result.output).toContain('should run 2');
  expect(result.output).toContain('should run end');
  expect(result.report.suites[0].specs[0].tests[0].results[0].steps).toEqual([
    { title: 'step 1', steps: [{ title: 'step 1.1', steps: [] }, { title: 'step 1.2', steps: [] }] },
    { title: 'step 2', steps: [] },
  ]);

  expect(result.failed).toBe(1);
  expect(result.output).not.toContain('\nshould not run');
  expect(result.report.suites[0].specs[1].tests[0].results[0].steps).toEqual([
    { title: 'step 1', steps: [{ title: 'step 1.1', steps: [] }] },
  ]);
});

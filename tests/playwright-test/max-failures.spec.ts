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

test('max-failures should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
    'b.spec.js': `
      import { test, expect } from '@playwright/test';
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `
  }, { 'max-failures': 8 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(8);
  expect(result.output.split('\n').filter(l => l.includes('expect(')).length).toBe(16);
});

test('-x should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
    'b.spec.js': `
      import { test, expect } from '@playwright/test';
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `
  }, { '-x': true });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(l => l.includes('expect(')).length).toBe(2);
});

test('max-failures should work with retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      for (let i = 0; i < 10; ++i) {
        test('fail_' + i, () => {
          expect(true).toBe(false);
        });
      }
    `,
  }, { 'max-failures': 2, 'retries': 4 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n').filter(l => l.includes('Received:')).length).toBe(2);
});

test('max-failures should stop workers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('passed', async () => {
        await new Promise(f => setTimeout(f, 2000));
      });
      test('failed', async () => {
        test.expect(1).toBe(2);
      });
    `,
    'b.spec.js': `
      import { test, expect } from '@playwright/test';
      test('passed short', async () => {
        await new Promise(f => setTimeout(f, 1));
      });
      test('interrupted reported as interrupted', async () => {
        console.log('\\n%%interrupted');
        await new Promise(f => setTimeout(f, 5000));
      });
      test('skipped', async () => {
        console.log('\\n%%skipped');
      });
    `,
  }, { 'max-failures': 1, 'workers': 2 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.interrupted).toBe(1);
  expect(result.didNotRun).toBe(1);
  expect(result.output).toContain('%%interrupted');
  expect(result.output).not.toContain('%%skipped');
});

test('max-failures should properly shutdown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      const config = {
        testDir: './',
        maxFailures: 1,
      };
      export default config;
    `,
    'test1.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('spec 1', () => {
        test('test 1', async () => {
          expect(false).toBeTruthy()
        })
      });
    `,
    'test2.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('spec 2', () => {
        test('test 2', () => {
          expect(true).toBeTruthy()
        })
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('expect(false).toBeTruthy()');
});

test('max-failures should work across phases', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/26344' });

  const result = await runInlineTest({
    'playwright.config.ts': `
      const config = {
        testDir: './',
        maxFailures: 1,
        projects: [
          { name: 'a', testMatch: ['example.spec.ts'] },
          { name: 'b', testMatch: ['example.spec.ts'], dependencies: ['a'] },
          { name: 'c', testMatch: ['example.spec.ts'], dependencies: ['a'] },
          { name: 'd', testMatch: ['example.spec.ts'], dependencies: ['b'] },
        ]
      };
      export default config;
    `,
    'example.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', () => {
        const project = test.info().project.name;
        console.log('running ' + project);
        if (project === 'c')
          throw new Error('failed!');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.didNotRun).toBe(1);
  expect(result.output).toContain('running a');
  expect(result.output).toContain('running b');
  expect(result.output).toContain('running c');
  expect(result.output).not.toContain('running d');
});

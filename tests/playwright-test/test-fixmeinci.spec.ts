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

import { test, expect, expectTestHelper } from './playwright-test-fixtures';

test('fixmeinci should skip tests in CI environments only', async ({ runInlineTest }) => {
  // Save original CI value
  const originalCI = process.env.CI;
  
  try {
    // Test with CI=1 (in CI environment)
    // Set parent process CI variable to '1' - this doesn't affect child processes directly
    process.env.CI = '1';
    console.log('Setting parent process CI environment variable to:', process.env.CI);
    
    // Explicitly pass CI environment to child process
    // We must explicitly pass the CI environment variable to the child process
    const resultInCI = await runInlineTest({
      'helper.ts': `
        import { test as base, expect } from '@playwright/test';
        export const test = base.extend({
          foo: true,
        });
      `,
      'a.test.ts': `
        import { test } from './helper';

        test('should run normally', async ({foo}) => {
          // This test should run normally
        });
        
        test.fixmeinci('should be skipped in CI', async ({foo}) => {
          // This test should be skipped in CI but run locally
        });
        
        test('should be skipped via method in CI', async ({foo}) => {
          test.fixmeinci();
        });
        
        test('should be skipped with reason in CI', async ({foo}) => {
          test.fixmeinci('skipping in CI with reason');
        });
        
        test.describe('suite with fixmeinci', () => {
          test.fixmeinci();
          // Add console output to debug the environment
          test('should be skipped in CI in suite', () => {
            console.log('Inside test: CI env variable is:', process.env.CI);
            // This test should be skipped in CI but run locally
          });
        });
        
        test.describe.fixmeinci('suite declared with fixmeinci', () => {
          test('should be skipped in CI in fixmeinci suite', () => {
            console.log('Inside fixmeinci suite test: CI env variable is:', process.env.CI);
            // This test should be skipped in CI but run locally
          });
        });
      `,
    }, { reporter: 'line' }, { CI: '1' });

    // Verify tests are skipped when in CI
    expect(resultInCI.exitCode).toBe(0);
    
    const expectTestInCI = expectTestHelper(resultInCI);
    expectTestInCI('should run normally', 'passed', 'expected', []);
    expectTestInCI('should be skipped in CI', 'skipped', 'skipped', ['fixme']);
    expectTestInCI('should be skipped via method in CI', 'skipped', 'skipped', ['fixme']);
    expectTestInCI('should be skipped with reason in CI', 'skipped', 'skipped', ['fixme']);
    expectTestInCI('should be skipped in CI in suite', 'skipped', 'skipped', ['fixme']);
    expectTestInCI('should be skipped in CI in fixmeinci suite', 'skipped', 'skipped', ['fixme']);
    
    // Now test without CI (local environment)
    // Set parent process CI variable to empty - this doesn't affect child processes directly
    process.env.CI = '';
    
    const resultLocal = await runInlineTest({
      'helper.ts': `
        import { test as base, expect } from '@playwright/test';
        export const test = base.extend({
          foo: true,
        });
      `,
      'a.test.ts': `
        import { test } from './helper';

        test('should run normally', async ({foo}) => {
          // This test should run normally
        });
        
        test.fixmeinci('should run locally', async ({foo}) => {
          // This test should be skipped in CI but run locally
        });
        
        test('should run with fixmeinci method locally', async ({foo}) => {
          test.fixmeinci();
        });
        
        test('should run with fixmeinci reason locally', async ({foo}) => {
          test.fixmeinci('would skip in CI with reason');
        });
        
        test.describe('suite with fixmeinci', () => {
          test.fixmeinci();
          test('should run locally in suite', () => {
            // This test should run locally
          });
        });
        
        test.describe.fixmeinci('suite declared with fixmeinci', () => {
          test('should run locally in fixmeinci suite', () => {
            // This test should run locally
          });
        });
      `,
    }, { reporter: 'line' }, { CI: '' });

    // Verify tests run normally when not in CI
    expect(resultLocal.exitCode).toBe(0);
    
    const expectTestLocal = expectTestHelper(resultLocal);
    expectTestLocal('should run normally', 'passed', 'expected', []);
    expectTestLocal('should run locally', 'passed', 'expected', []);
    expectTestLocal('should run with fixmeinci method locally', 'passed', 'expected', []);
    expectTestLocal('should run with fixmeinci reason locally', 'passed', 'expected', []);
    expectTestLocal('should run locally in suite', 'passed', 'expected', []);
    expectTestLocal('should run locally in fixmeinci suite', 'passed', 'expected', []);
    
  } finally {
    // Restore original CI value
    process.env.CI = originalCI;
  }
});

test('fixmeinci should work alongside other modifiers', async ({ runInlineTest }) => {
  // Save original CI value
  const originalCI = process.env.CI;
  
  try {
    // Test with CI=1
    process.env.CI = '1';
    
    const result = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.describe('suite1', () => {
          test('no marker', () => {});
          test.skip('skip wrap', () => {});
          test.fixmeinci('fixmeinci wrap', () => {});
          test('fixmeinci inner', () => { test.fixmeinci(); });
          test.fixme('fixme wrap', () => {});
          test.fixmeinci.skip('fixmeinci and skip', () => {});
        });
      `,
    }, { reporter: 'line' }, { CI: '1' });
    
    const expectTest = expectTestHelper(result);

    expect(result.exitCode).toBe(0);
    expectTest('no marker', 'passed', 'expected', []);
    expectTest('skip wrap', 'skipped', 'skipped', ['skip']);
    expectTest('fixmeinci wrap', 'skipped', 'skipped', ['fixme']);
    expectTest('fixmeinci inner', 'skipped', 'skipped', ['fixme']);
    expectTest('fixme wrap', 'skipped', 'skipped', ['fixme']);
    expectTest('fixmeinci and skip', 'skipped', 'skipped', ['skip']);
    
    // Now test without CI
    process.env.CI = '';
    
    const resultLocal = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';

        test.describe('suite1', () => {
          test('no marker', () => {});
          test.skip('skip wrap', () => {});
          test.fixmeinci('fixmeinci wrap', () => {});
          test('fixmeinci inner', () => { test.fixmeinci(); });
          test.fixme('fixme wrap', () => {});
          test.fixmeinci.skip('fixmeinci and skip', () => {});
        });
      `,
    }, { reporter: 'line' }, { CI: '' });
    
    const expectTestLocal = expectTestHelper(resultLocal);

    expect(resultLocal.exitCode).toBe(0);
    expectTestLocal('no marker', 'passed', 'expected', []);
    expectTestLocal('skip wrap', 'skipped', 'skipped', ['skip']);
    expectTestLocal('fixmeinci wrap', 'passed', 'expected', []);
    expectTestLocal('fixmeinci inner', 'passed', 'expected', []);
    expectTestLocal('fixme wrap', 'skipped', 'skipped', ['fixme']);
    expectTestLocal('fixmeinci and skip', 'skipped', 'skipped', ['skip']);
    
  } finally {
    // Restore original CI value
    process.env.CI = originalCI;
  }
});

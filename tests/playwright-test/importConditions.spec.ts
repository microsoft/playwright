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

// Config Validation Tests
test('should validate importConditions is an array', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: 'invalid',
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('dummy', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('config.importConditions must be an array');
});

test('should validate importConditions array elements are strings', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: ['valid', 123, 'another'],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('dummy', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('config.importConditions[1] must be a string');
});

test('should allow empty importConditions array', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: [],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('passes', () => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should allow undefined importConditions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: undefined,
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('passes', () => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

// execArgv Passing Tests
test('should pass importConditions to worker process.execArgv', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: ['custom', 'development'],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('verify execArgv', () => {
        console.log('%%execArgv=' + JSON.stringify(process.execArgv));
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('--conditions=custom');
  expect(result.output).toContain('--conditions=development');
});

test('should pass single importCondition to worker', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: ['test-condition'],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('verify single condition', () => {
        const hasCondition = process.execArgv.some(arg => arg === '--conditions=test-condition');
        console.log('%%hasCondition=' + hasCondition);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('hasCondition=true');
});

test('should not pass conditions when importConditions is empty', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: [],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('verify no conditions', () => {
        const hasConditions = process.execArgv.some(arg => arg.startsWith('--conditions='));
        console.log('%%hasConditions=' + hasConditions);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('hasConditions=false');
});

// Integration Tests
test('should run tests successfully with importConditions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: ['custom'],
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('should pass', () => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should work with multiple workers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: ['test'],
        workers: 2,
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('test 1', () => {
        console.log('%%worker-' + process.env.TEST_WORKER_INDEX);
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      test('test 2', () => {
        console.log('%%worker-' + process.env.TEST_WORKER_INDEX);
      });
    `
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

// Edge Cases
test('should handle many conditions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        importConditions: ['cond1', 'cond2', 'cond3', 'cond4', 'cond5'],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('verify all conditions', () => {
        const conditions = process.execArgv.filter(arg => arg.startsWith('--conditions='));
        console.log('%%conditionCount=' + conditions.length);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('conditionCount=5');
});

test('should not interfere with existing tests when omitted', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        workers: 1,
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('normal test', () => {
        expect(true).toBe(true);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

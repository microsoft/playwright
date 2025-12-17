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

const tests = {
  'a1.spec.ts': `
    import { test } from '@playwright/test';
    test('test1', async () => {
      console.log('\\n%%a1-test1-done');
    });
    test('test2', async () => {
      console.log('\\n%%a1-test2-done');
    });
    test('test3', async () => {
      console.log('\\n%%a1-test3-done');
    });
    test('test4', async () => {
      console.log('\\n%%a1-test4-done');
    });
  `,
  'a2.spec.ts': `
    import { test } from '@playwright/test';
    test.describe.configure({ mode: 'parallel' });
    test('test1', async () => {
      console.log('\\n%%a2-test1-done');
    });
    test('test2', async () => {
      console.log('\\n%%a2-test2-done');
    });
  `,
  'a3.spec.ts': `
    import { test } from '@playwright/test';
    test.describe.configure({ mode: 'parallel' });
    test('test1', async () => {
      console.log('\\n%%a3-test1-done');
    });
    test('test2', async () => {
      console.log('\\n%%a3-test2-done');
    });
  `,
  'a4.spec.ts': `
    import { test } from '@playwright/test';
    test('test1', async () => {
      console.log('\\n%%a4-test1-done');
    });
    test('test2', async () => {
      console.log('\\n%%a4-test2-done');
    });
  `,
};

test('should respect shard=1/2', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '1/2', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a1-test1-done',
    'a1-test2-done',
    'a1-test3-done',
    'a1-test4-done',
    'a2-test1-done',
  ]);
});

test('should respect shard=2/2', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '2/2', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a2-test2-done',
    'a3-test1-done',
    'a3-test2-done',
    'a4-test1-done',
    'a4-test2-done',
  ]);
});

test('should respect shard=1/3', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '1/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a1-test1-done',
    'a1-test2-done',
    'a1-test3-done',
    'a1-test4-done',
  ]);
});

test('should respect shard=2/3', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '2/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a2-test1-done',
    'a2-test2-done',
    'a3-test1-done',
  ]);
});

test('should respect shard=3/3', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '3/3', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a3-test2-done',
    'a4-test1-done',
    'a4-test2-done',
  ]);
});

test('should respect shard=3/4', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '3/4', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a3-test1-done',
    'a3-test2-done',
  ]);
});

test('should exit with shard=/3', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34463' });
  const result = await runInlineTest(tests, { shard: '/3' });
  expect(result.exitCode).toBe(1);
});

test('should not produce skipped tests for zero-sized shards', async ({ runInlineTest }) => {
  const result = await runInlineTest(tests, { shard: '10/10', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([]);
});

test('should respect shard=1/2 in config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...tests,
    'playwright.config.js': `
      module.exports = { shard: { current: 1, total: 2 } };
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'a1-test1-done',
    'a1-test2-done',
    'a1-test3-done',
    'a1-test4-done',
    'a2-test1-done',
  ]);
});

test('should work with workers=1 and --fully-parallel', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21226' });
  const tests = {
    'a1.spec.ts': `
      import { test } from '@playwright/test';
      test('should pass', async ({ }) => {
      });
      test.skip('should skip', async ({ }) => {
      });
    `,
    'a2.spec.ts': `
    import { test } from '@playwright/test';
    test('should pass', async ({ }) => {
    });
  `,
  };

  const result = await runInlineTest(tests, { shard: '1/2', ['fully-parallel']: true, workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(1);
});

test('should skip dependency when project is sharded out', async ({ runInlineTest }) => {
  const tests = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup1', testMatch: /setup.ts/ },
          { name: 'tests1', dependencies: ['setup1'] },
          { name: 'setup2', testMatch: /setup.ts/ },
          { name: 'tests2', dependencies: ['setup2'] },
        ],
      };
    `,
    'test.spec.ts': `
      import { test } from '@playwright/test';
      test('test', async ({}) => {
        console.log('\\n%%test in ' + test.info().project.name);
      });
    `,
    'setup.ts': `
      import { test } from '@playwright/test';
      test('setup', async ({}) => {
        console.log('\\n%%setup in ' + test.info().project.name);
      });
    `,
  };

  const result = await runInlineTest(tests, { shard: '2/2', workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'setup in setup2',
    'test in tests2',
  ]);
});

test('should not shard mode:default suites', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22891' });

  const tests = {
    'a1.spec.ts': `
      import { test } from '@playwright/test';
      test('test0', async ({ }) => {
        console.log('\\n%%test0');
      });
      test('test1', async ({ }) => {
        console.log('\\n%%test1');
      });
    `,
    'a2.spec.ts': `
      import { test } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });

      test.describe(() => {
        test.describe.configure({ mode: 'default' });
        test.beforeAll(() => {
          console.log('\\n%%beforeAll1');
        });
        test('test2', async ({ }) => {
          console.log('\\n%%test2');
        });
        test('test3', async ({ }) => {
          console.log('\\n%%test3');
        });
      });

      test.describe(() => {
        test.describe.configure({ mode: 'default' });
        test.beforeAll(() => {
          console.log('\\n%%beforeAll2');
        });
        test('test4', async ({ }) => {
          console.log('\\n%%test4');
        });
        test('test5', async ({ }) => {
          console.log('\\n%%test5');
        });
      });
  `,
  };

  {
    const result = await runInlineTest(tests, { shard: '2/3', workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['beforeAll1', 'test2', 'test3']);
  }
  {
    const result = await runInlineTest(tests, { shard: '3/3', workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['beforeAll2', 'test4', 'test5']);
  }
});

test('should shard tests with beforeAll based on shards total instead of workers', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33077' },
}, async ({ runInlineTest }) => {
  const tests = {
    'a.spec.ts': `
      import { test } from '@playwright/test';

      test.describe.configure({ mode: 'parallel' });
      test.beforeAll(() => {
        console.log('\\n%%beforeAll');
      });

      for (let i = 1; i <= 8; i++) {
        test('test ' + i, async ({ }) => {
          console.log('\\n%%test' + i);
        });
      }
    `,
  };

  {
    const result = await runInlineTest(tests, { shard: '1/4', workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['beforeAll', 'test1', 'test2']);
  }
  {
    const result = await runInlineTest(tests, { shard: '2/4', workers: 1 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['beforeAll', 'test3', 'test4']);
  }
  {
    const result = await runInlineTest(tests, { shard: '7/8', workers: 6 });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(result.outputLines).toEqual(['beforeAll', 'test7']);
  }
});

test('should balance shards more evenly with durations file', async ({ runInlineTest, writeFiles }) => {
  await writeFiles({
    'durations.json': JSON.stringify({
      '479195fc753889991fa5-5813cc103c54d7741584': 10, // a1.spec.ts > test1
      '479195fc753889991fa5-9fc80721f6be35c12708': 10, // a1.spec.ts > test2
      '479195fc753889991fa5-edf96c89d82c3bba716e': 10, // a1.spec.ts > test3
      '479195fc753889991fa5-5d262514ede0791df9af': 10, // a1.spec.ts > test4
      '849e62166c098efb00be-9dfd3bf7693a6ef90503': 5,  // a2.spec.ts > test1
      '849e62166c098efb00be-29652a6c5c890f4ac524': 5,  // a2.spec.ts > test2
      '9d5849c1ce6ce86c54ac-d1d1fc129ec68ce96b3c': 1,  // a3.spec.ts > test1
      '9d5849c1ce6ce86c54ac-943f7c2b686bb5c44d92': 1,  // a3.spec.ts > test2
      'a98e42b62cec32949233-8e5cad63ca1c4a4ec75d': 1,  // a4.spec.ts > test1
      'a98e42b62cec32949233-9e2fc217c36d40f8765c': 1,  // a4.spec.ts > test2
    }),
  });
  const shard1 = await runInlineTest(tests, {
    shard: '1/2',
    workers: 1,
    durations: 'durations.json',
  });
  expect(shard1.exitCode).toBe(0);
  expect(shard1.outputLines).toEqual([
    'a1-test1-done',
    'a1-test2-done',
    'a1-test3-done',
    'a1-test4-done',
  ]);

  const shard2 = await runInlineTest(tests, {
    shard: '2/2',
    workers: 1,
    durations: 'durations.json',
  });
  expect(shard2.exitCode).toBe(0);
  expect(shard2.outputLines).toEqual([
    'a2-test1-done',
    'a2-test2-done',
    'a3-test1-done',
    'a3-test2-done',
    'a4-test1-done',
    'a4-test2-done',
  ]);
});

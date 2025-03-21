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

test('should run in parallel', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    '1.spec.ts': `
      import * as fs from 'fs';
      import * as path from 'path';
      import { test, expect } from '@playwright/test';
      test('succeeds', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
        // First test waits for the second to start to work around the race.
        while (true) {
          if (fs.existsSync(path.join(testInfo.project.outputDir, 'parallel-index.txt')))
            break;
          await new Promise(f => setTimeout(f, 100));
        }
      });
    `,
    '2.spec.ts': `
      import * as fs from 'fs';
      import * as path from 'path';
      import { test, expect } from '@playwright/test';
      test('succeeds', async ({}, testInfo) => {
        // First test waits for the second to start to work around the race.
        fs.mkdirSync(testInfo.project.outputDir, { recursive: true });
        fs.writeFileSync(path.join(testInfo.project.outputDir, 'parallel-index.txt'), 'TRUE');
        expect(testInfo.workerIndex).toBe(1);
        expect(testInfo.parallelIndex).toBe(1);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.exitCode).toBe(0);
});

test('should reuse worker for multiple tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('succeeds 3', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(3);
  expect(result.exitCode).toBe(0);
});

test('should reuse worker after test.fixme()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('fixme 1', async ({}, testInfo) => {
        test.fixme();
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should reuse worker after test.skip()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('skip 1', async ({}, testInfo) => {
        test.skip();
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(2);
  expect(result.skipped).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should not use new worker after test.fail()', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('fail 1', async ({}, testInfo) => {
        test.fail();
        expect(1).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });
    `,
  });
  expect(result.passed).toBe(3);
  expect(result.failed).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should use new worker after test failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds 1', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(0);
        expect(testInfo.parallelIndex).toBe(0);
      });

      test('fail 1', async ({}, testInfo) => {
        expect(1).toBe(0);
      });

      test('succeeds 2', async ({}, testInfo) => {
        expect(testInfo.workerIndex).toBe(1);
        expect(testInfo.parallelIndex).toBe(0);
      });
    `,
  }, { workers: 1 });
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test('should not reuse worker for different suites', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [{}, {}, {}] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds', async ({}, testInfo) => {
        console.log('workerIndex-' + testInfo.workerIndex);
        console.log('parallelIndex-' + testInfo.parallelIndex);
      });
    `,
  }, { workers: 1 });
  expect(result.passed).toBe(3);
  expect(result.exitCode).toBe(0);
  expect(result.results.map(r => r.workerIndex).sort()).toEqual([0, 1, 2]);
  expect(result.output).toContain('workerIndex-0');
  expect(result.output).toContain('workerIndex-1');
  expect(result.output).toContain('workerIndex-2');
  expect(result.output).toContain('parallelIndex-0');
  expect(result.output).not.toContain('parallelIndex-1');
});

test('parallelIndex should be in 0..workers-1', async ({ runInlineTest }) => {
  const files = {};
  for (let i = 0; i < 10; i++) {
    files[`a${i}.test.js`] = `
      import { test, expect } from '@playwright/test';
      test('passes-1', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 100 + 50 * ${i}));
        expect(testInfo.parallelIndex >= 0).toBeTruthy();
        expect(testInfo.parallelIndex < testInfo.config.workers).toBeTruthy();
      });
      test('passes-2', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 100 + 50 * ${i}));
        expect(testInfo.parallelIndex >= 0).toBeTruthy();
        expect(testInfo.parallelIndex < testInfo.config.workers).toBeTruthy();
      });
    `;
  }
  const result = await runInlineTest(files, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(20);
});

test('should not spawn workers for statically skipped tests', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20156' });

  const result = await runInlineTest({
    'a.test.js': `
      console.log('%%workerIndex=' + process.env.TEST_WORKER_INDEX);
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      test('success', () => {});
      test.skip('skipped', () => {});
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.output).toContain('workerIndex=undefined');
  expect(result.output).toContain('workerIndex=0');
  expect(result.output).not.toContain('workerIndex=1');
});

test('should respect project.workers=1', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        workers: 10,
        projects: [
          { name: 'project1', workers: 1 },
          { name: 'project2', workers: 1 },
        ],
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      test('test1', async ({}, testInfo) => {
        console.log('%%test1-begin:' + testInfo.project.name);
        await new Promise(f => setTimeout(f, 1000 + (testInfo.project.name === 'project1' ? 2000 : 0)));
        console.log('%%test1-end:' + testInfo.project.name);
      });
      test('test2', async ({}, testInfo) => {
        console.log('%%test2:' + testInfo.project.name);
      });
    `,
  }, { workers: 10 });
  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);

  // test1 from both projects start, test2 starts once test1 for that project finishes
  expect(result.outputLines.slice(0, 2).sort()).toEqual([
    'test1-begin:project1',
    'test1-begin:project2',
  ]);
  expect(result.outputLines.slice(2, 6)).toEqual([
    'test1-end:project2',
    'test2:project2',
    'test1-end:project1',
    'test2:project1',
  ]);
});

test('should respect project.workers>1', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        workers: 10,
        projects: [
          { name: 'project', workers: 2 },
        ],
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      test('test1', async ({}, testInfo) => {
        console.log('%%test1-begin');
        await new Promise(f => setTimeout(f, 2000));
        console.log('%%test1-end');
      });
      test('test2', async ({}, testInfo) => {
        console.log('%%test2-begin');
        await new Promise(f => setTimeout(f, 1000));
        console.log('%%test2-end');
      });
      test('test3', async ({}, testInfo) => {
        console.log('%%test3');
      });
    `,
  }, { workers: 10 });
  expect(result.passed).toBe(3);
  expect(result.exitCode).toBe(0);

  // 1+2 start, 1 finishes => 3 runs, 2 finishes
  expect(result.outputLines.slice(0, 2).sort()).toEqual([
    'test1-begin',
    'test2-begin',
  ]);
  expect(result.outputLines.slice(2, 4)).toEqual([
    'test2-end',
    'test3',
  ]);
  expect(result.outputLines.slice(4, 5)).toEqual([
    'test1-end',
  ]);
});

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

test('should run projects with dependencies', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A' },
          { name: 'B', dependencies: ['A'] },
          { name: 'C', dependencies: ['A'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['--project=B', '--project=C'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toEqual(['A', 'B', 'C']);
});

test('should not run projects with dependencies when --no-deps is passed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A' },
          { name: 'B', dependencies: ['A'] },
          { name: 'C', dependencies: ['A'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['--no-deps', '--project=B', '--project=C'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toEqual(['B', 'C']);
});

test('should not run project if dependency failed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A' },
          { name: 'B', dependencies: ['A'] },
          { name: 'C', dependencies: ['B'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
        if (testInfo.project.name === 'B')
          throw new Error('Failed project B');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.output).toContain('Failed project B');
  expect(result.outputLines).toEqual(['A', 'B']);
});

test('should not run project if dependency failed (2)', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A1' },
          { name: 'A2', dependencies: ['A1'] },
          { name: 'A3', dependencies: ['A2'] },
          { name: 'B1' },
          { name: 'B2', dependencies: ['B1'] },
          { name: 'B3', dependencies: ['B2'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
        if (testInfo.project.name === 'B1')
          throw new Error('Failed project B1');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.outputLines.sort()).toEqual(['A1', 'A2', 'A3', 'B1']);
});

test('should filter by project list, but run deps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'A' },
        { name: 'B' },
        { name: 'C', dependencies: ['A'] },
        { name: 'D' },
      ] };
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `
  }, { project: ['C', 'D'] });
  expect(result.passed).toBe(3);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines.sort()).toEqual(['A', 'C', 'D']);
});


test('should not filter dependency by file name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'A' },
        { name: 'B', dependencies: ['A'] },
      ] };
    `,
    'one.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
    'two.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', () => { });
    `,
  }, undefined, undefined, { additionalArgs: ['two.spec.ts'] });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('1) [A] › one.spec.ts:3:11 › fails');
});

test('should not filter dependency by only', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'setup', testMatch: /setup.ts/ },
        { name: 'browser', dependencies: ['setup'] },
      ] };
    `,
    'setup.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {
        console.log('\\n%% setup in ' + test.info().project.name);
      });
      test.only('passes 2', () => {
        console.log('\\n%% setup 2 in ' + test.info().project.name);
      });
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        console.log('\\n%% test in ' + test.info().project.name);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['setup in setup', 'setup 2 in setup', 'test in browser']);
});

test('should not filter dependency by only 2', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'setup', testMatch: /setup.ts/ },
        { name: 'browser', dependencies: ['setup'] },
      ] };
    `,
    'setup.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {
        console.log('\\n%% setup in ' + test.info().project.name);
      });
      test.only('passes 2', () => {
        console.log('\\n%% setup 2 in ' + test.info().project.name);
      });
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        console.log('\\n%% test in ' + test.info().project.name);
      });
    `,
  }, { project: ['setup'] });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['setup 2 in setup']);
});

test('should not filter dependency by only 3', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'setup', testMatch: /setup.*.ts/ },
        { name: 'browser', dependencies: ['setup'] },
      ] };
    `,
    'setup-1.ts': `
      import { test, expect } from '@playwright/test';
      test('setup 1', () => {
        console.log('\\n%% setup in ' + test.info().project.name);
      });
    `,
    'setup-2.ts': `
      import { test, expect } from '@playwright/test';
      test('setup 2', () => {
        console.log('\\n%% setup 2 in ' + test.info().project.name);
      });
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {
        console.log('\\n%% test in ' + test.info().project.name);
      });
    `,
  }, undefined, undefined, { additionalArgs: ['setup-2.ts'] });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['setup 2 in setup']);
});

test('should report skipped dependent tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'setup', testMatch: /setup.ts/ },
        { name: 'browser', dependencies: ['setup'] },
      ] };
    `,
    'setup.ts': `
      import { test, expect } from '@playwright/test';
      test('setup', () => {
        expect(1).toBe(2);
      });
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.results.length).toBe(2);
});

test('should report circular dependencies', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'A', dependencies: ['B'] },
        { name: 'B', dependencies: ['A'] },
      ] };
    `,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Circular dependency detected between projects.');
});

test('should run dependency in each shard', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: /setup.ts/ },
          { name: 'chromium', dependencies: ['setup'] },
        ],
      };
    `,
    'setup.ts': `
      import { test, expect } from '@playwright/test';
      test('setup', async ({}) => {
        console.log('\\n%%setup');
      });
    `,
    'test1.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async ({}) => {
        console.log('\\n%%test1');
      });
    `,
    'test2.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test2', async ({}) => {
        console.log('\\n%%test2');
      });
    `,
  };
  {
    const result = await runInlineTest(files, { workers: 1, shard: '1/2' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['setup', 'test1']);
  }
  {
    const result = await runInlineTest(files, { workers: 1, shard: '2/2' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(2);
    expect(result.outputLines).toEqual(['setup', 'test2']);
  }
});

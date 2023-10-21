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

test('should inherit env changes from dependencies', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'A', testMatch: '**/a.spec.ts' },
        { name: 'B', testMatch: '**/b.spec.ts', teardown: 'E' },
        { name: 'C', testMatch: '**/c.spec.ts', dependencies: ['A'] },
        { name: 'D', testMatch: '**/d.spec.ts', dependencies: ['B'] },
        { name: 'E', testMatch: '**/e.spec.ts' },
      ] };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        process.env.SET_IN_A = 'valuea';
        delete process.env.SET_OUTSIDE;
        console.log('\\n%%A');
      });
    `,
    'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        process.env.SET_IN_B = 'valueb';
        console.log('\\n%%B');
      });
    `,
    'c.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log('\\n%%C-' + process.env.SET_IN_A + '-' + process.env.SET_IN_B + '-' + process.env.SET_OUTSIDE);
      });
    `,
    'd.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log('\\n%%D-' + process.env.SET_IN_A + '-' + process.env.SET_IN_B + '-' + process.env.SET_OUTSIDE);
      });
    `,
    'e.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log('\\n%%E-' + process.env.SET_IN_A + '-' + process.env.SET_IN_B + '-' + process.env.SET_OUTSIDE);
      });
    `,
  }, {}, { SET_OUTSIDE: 'outside' });
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines.sort()).toEqual(['A', 'B', 'C-valuea-undefined-undefined', 'D-undefined-valueb-outside', 'E-undefined-valueb-outside']);
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
  expect(result.didNotRun).toBe(1);
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

test('should filter dependency by only', async ({ runInlineTest }) => {
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
  expect(result.outputLines).toEqual(['setup 2 in setup']);
});

test('should filter dependency by only when running explicitly', async ({ runInlineTest }) => {
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

test('should not report skipped dependent tests', async ({ runInlineTest }) => {
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
  expect(result.didNotRun).toBe(1);
  expect(result.results.length).toBe(1);
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

test('should run setup project with zero tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: /not-matching/ },
          { name: 'real', dependencies: ['setup'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual(['real']);
});

test('should run setup project with zero tests recursively', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', testMatch: /a.spec/ },
          { name: 'B', testMatch: /not-matching/, dependencies: ['A'] },
          { name: 'C', testMatch: /c.spec/, dependencies: ['B'] },
        ],
      };`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
    'c.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1, project: 'C' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toEqual(['A', 'C']);
});

test('should run project with teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', teardown: 'B' },
          { name: 'B' },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['--project=A'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toEqual(['A', 'B']);
});

test('should run teardown after dependents', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', teardown: 'E' },
          { name: 'B', dependencies: ['A'] },
          { name: 'C', dependencies: ['B'], teardown: 'D' },
          { name: 'D' },
          { name: 'E' },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['--project=C'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
  expect(result.outputLines).toEqual(['A', 'B', 'C', 'D', 'E']);
});

test('should run teardown after failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', teardown: 'D' },
          { name: 'B', dependencies: ['A'] },
          { name: 'C', dependencies: ['B'] },
          { name: 'D' },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
        if (testInfo.project.name === 'A')
          throw new Error('ouch');
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['--project=C'] });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(2);
  expect(result.outputLines).toEqual(['A', 'D']);
});

test('should complain about teardown being a dependency', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', teardown: 'B' },
          { name: 'B' },
          { name: 'C', dependencies: ['B'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Project C must not depend on a teardown project B`);
});

test('should complain about teardown having a dependency', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', teardown: 'B' },
          { name: 'B', dependencies: ['C'] },
          { name: 'C' },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Teardown project B must not have dependencies`);
});

test('should support the same teardown used multiple times', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'A', teardown: 'D' },
          { name: 'B', teardown: 'D' },
          { name: 'D' },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toEqual(['A', 'B', 'D']);
});

test('should only apply --repeat-each to top-level', async ({ runInlineTest }) => {
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
  }, { 'workers': 1, 'repeat-each': 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
  expect(result.outputLines).toEqual(['A', 'B', 'B', 'C', 'C']);
});

test('should run teardown when all projects are top-level at run point', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', teardown: 'teardown' },
          { name: 'teardown' },
          { name: 'project', dependencies: ['setup'] },
        ],
      };`,
    'test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['test.spec.ts'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toEqual(['setup', 'project', 'teardown']);
});

test('should not run deps for projects filtered with grep', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setupA', teardown: 'teardownA', testMatch: '**/hook.spec.ts' },
          { name: 'teardownA', testMatch: '**/hook.spec.ts' },
          { name: 'projectA', dependencies: ['setupA'], testMatch: '**/a.spec.ts' },
          { name: 'setupB', teardown: 'teardownB', testMatch: '**/hook.spec.ts' },
          { name: 'teardownB', testMatch: '**/hook.spec.ts' },
          { name: 'projectB', dependencies: ['setupB'], testMatch: '**/b.spec.ts' },
        ],
      };`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
    'hook.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
    'b.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.project.name);
      });
    `,
  }, { workers: 1 }, undefined, { additionalArgs: ['--grep=b.spec.ts'] });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toEqual(['setupB', 'projectB', 'teardownB']);
});

test('should allow only in dependent', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: '**/setup.ts' },
          { name: 'project', dependencies: ['setup'] },
        ],
      };`,
    'setup.ts': `
      import { test, expect } from '@playwright/test';
      test('setup', async ({}) => {});
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.only('test', async ({}) => {
      });
      test('test 2', async ({}) => { expect(1).toBe(2); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should allow only in dependent (2)', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'setup', testMatch: '**/setup.ts' },
          { name: 'project', dependencies: ['setup'] },
        ],
      };`,
    'setup.ts': `
      import { test, expect } from '@playwright/test';
      test.only('setup', async ({}) => {});
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}) => { expect(1).toBe(2); });
      test('test 2', async ({}) => { expect(1).toBe(2); });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

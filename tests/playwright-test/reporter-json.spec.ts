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

import * as path from 'path';
import * as fs from 'fs';
import { test, expect, stripAnsi } from './playwright-test-fixtures';

test('should support spec.ok and stats', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('math fails!', async ({}) => {
        expect(1 + 1).toBe(3);
      });
      test.skip('math skipped', async ({}) => {
      });
    `
  }, { });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites[0].specs[0].ok).toBe(true);
  expect(result.report.suites[0].specs[1].ok).toBe(false);
  expect(result.report.suites[0].specs[2].ok).toBe(true);
  expect(result.report.stats.expected).toEqual(1);
  expect(result.report.stats.unexpected).toEqual(1);
  expect(result.report.stats.flaky).toEqual(0);
  expect(result.report.stats.skipped).toEqual(1);
});

test('should not report skipped due to sharding', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('one', async () => {
      });
      test('two', async () => {
        test.skip();
      });
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      test('three', async () => {
      });
      test('four', async () => {
        test.skip();
      });
      test('five', async () => {
      });
    `,
  }, { shard: '1/3', reporter: 'json' });
  expect(result.exitCode).toBe(0);
  expect(result.report.suites.length).toBe(1);
  expect(result.report.suites[0].specs.length).toBe(2);
  expect(result.report.suites[0].specs[0].tests[0].status).toBe('expected');
  expect(result.report.suites[0].specs[1].tests[0].status).toBe('skipped');
});

test('should report projects and stats', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        retries: 2,
        projects: [
          {
            timeout: 5000,
            name: 'p1',
            metadata: { foo: 'bar' },
          },
          {
            timeout: 8000,
            name: 'p2',
            metadata: { bar: 42 },
          }
        ]
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { });
  expect(result.exitCode).toBe(0);
  const projects = result.report.config.projects;
  const testDir = testInfo.outputDir.split(path.sep).join(path.posix.sep);

  expect(projects[0].name).toBe('p1');
  expect(projects[0].retries).toBe(2);
  expect(projects[0].timeout).toBe(5000);
  expect(projects[0].metadata).toEqual({ foo: 'bar' });
  expect(projects[0].testDir).toBe(testDir);

  expect(projects[1].name).toBe('p2');
  expect(projects[1].retries).toBe(2);
  expect(projects[1].timeout).toBe(8000);
  expect(projects[1].metadata).toEqual({ bar: 42 });
  expect(projects[1].testDir).toBe(testDir);

  expect(result.report.suites[0].specs[0].tests[0].projectName).toBe('p1');
  expect(result.report.suites[0].specs[0].tests[1].projectName).toBe('p2');

  expect(new Date(result.report.stats.startTime).valueOf()).not.toBeNaN();
  expect(result.report.stats.duration).toEqual(expect.any(Number));
});

test('should show steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
        await test.step('math works in a step', async () => {
          expect(2 + 2).toBe(4);
          await test.step('nested step', async () => {
            expect(2 + 2).toBe(4);
            await test.step('deeply nested step', async () => {
              expect(2 + 2).toBe(4);
            });
          })
        })
        await test.step('failing step', async () => {
          expect(2 + 2).toBe(5);
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites.length).toBe(1);
  expect(result.report.suites[0].specs.length).toBe(1);
  const testResult = result.report.suites[0].specs[0].tests[0].results[0];
  const steps = testResult.steps!;
  expect(steps[0].title).toBe('math works in a step');
  expect(steps[0].steps![0].title).toBe('nested step');
  expect(steps[0].steps![0].steps![0].title).toBe('deeply nested step');
  expect(steps[0].steps![0].steps![0].steps).toBeUndefined();
  expect(steps[1].error).not.toBeUndefined();
  expect(testResult.errors).toHaveLength(1);
  const snippet = stripAnsi(testResult.errors[0].message);
  expect(snippet).toContain('failing step');
  expect(snippet).toContain('expect(2 + 2).toBe(5)');
});

test('should display tags separately from title', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math works! @USR-MATH-001 @USR-MATH-002', { tag: '@foo' }, async ({}) => {
        test.info().annotations.push({ type: 'issue', description: 'issue-link' });
        test.info().annotations.push({ type: 'novalue' });
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.report.suites[0].specs[0].tags).toEqual(['USR-MATH-001', 'USR-MATH-002', 'foo']);
});

test('should have relative always-posix paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.report.config.rootDir.indexOf(path.win32.sep)).toBe(-1);
  expect(result.report.suites[0].specs[0].file).toBe('a.test.js');
  expect(result.report.suites[0].specs[0].line).toBe(3);
  expect(result.report.suites[0].specs[0].column).toBe(7);
});

test('should have error position in results', async ({
  runInlineTest,
}) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(3);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites[0].specs[0].file).toBe('a.test.js');
  expect(result.report.suites[0].specs[0].tests[0].results[0].errorLocation!.line).toBe(4);
  expect(result.report.suites[0].specs[0].tests[0].results[0].errorLocation!.column).toBe(23);
});

test('should add dot in addition to file json with CI', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { reporter: [['json', { outputFile: 'a.json' }]] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}) => {
        expect(1).toBe(1);
      });
    `,
  }, { reporter: '' }, { CI: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('·');
  expect(fs.existsSync(testInfo.outputPath('a.json'))).toBeTruthy();
});

test('should add line in addition to file json without CI', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { reporter: [['json', { outputFile: 'a.json' }]] };
    `,
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('one', async ({}) => {
        expect(1).toBe(1);
      });
    `,
  }, { reporter: '' }, { PW_TEST_DEBUG_REPORTERS: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('[1/1] a.test.js:3:7 › one');
  expect(fs.existsSync(testInfo.outputPath('a.json'))).toBeTruthy();
});
test('should have starting time in results', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  },   { reporter: 'json' });
  expect(result.exitCode).toBe(0);
  const startTime = result.report.suites[0].specs[0].tests[0].results[0].startTime;
  expect(new Date(startTime).getTime()).toBeGreaterThan(new Date('1/1/2000').getTime());
});

test.describe('report location', () => {
  test('with config should create report relative to config', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'nested/project/playwright.config.ts': `
        module.exports = { reporter: [['json', { outputFile: '../my-report/a.json' }]] };
      `,
      'nested/project/a.test.js': `
        import { test, expect } from '@playwright/test';
        test('one', async ({}) => {
          expect(1).toBe(1);
        });
      `,
    }, { reporter: '', config: './nested/project/playwright.config.ts' });
    expect(result.exitCode).toBe(0);
    expect(fs.existsSync(testInfo.outputPath(path.join('nested', 'my-report', 'a.json')))).toBeTruthy();
  });

  test('with env var should create relative to cwd', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'foo/package.json': `{ "name": "foo" }`,
      // unused config along "search path"
      'foo/bar/playwright.config.js': `
        module.exports = { projects: [ {} ] };
      `,
      'foo/bar/baz/tests/a.spec.js': `
        import { test, expect } from '@playwright/test';
        const fs = require('fs');
        test('pass', ({}, testInfo) => {
        });
      `
    }, { 'reporter': 'json' }, { 'PLAYWRIGHT_JSON_OUTPUT_NAME': '../my-report.json' }, {
      cwd: 'foo/bar/baz/tests',
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report.json'))).toBe(true);
  });

  test('support PLAYWRIGHT_JSON_OUTPUT_FILE', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'foo/package.json': `{ "name": "foo" }`,
      // unused config along "search path"
      'foo/bar/playwright.config.js': `
        module.exports = { projects: [ {} ] };
      `,
      'foo/bar/baz/tests/a.spec.js': `
        import { test, expect } from '@playwright/test';
        const fs = require('fs');
        test('pass', ({}, testInfo) => {
        });
      `
    }, { 'reporter': 'json' }, { 'PLAYWRIGHT_JSON_OUTPUT_FILE': '../my-report.json' }, {
      cwd: 'foo/bar/baz/tests',
    });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report.json'))).toBe(true);
  });

  test('support PLAYWRIGHT_JSON_OUTPUT_DIR and PLAYWRIGHT_JSON_OUTPUT_NAME', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'playwright.config.js': `
        module.exports = { projects: [ {} ] };
      `,
      'tests/a.spec.js': `
        import { test, expect } from '@playwright/test';
        const fs = require('fs');
        test('pass', ({}, testInfo) => {
        });
      `
    }, { 'reporter': 'json' }, { 'PLAYWRIGHT_JSON_OUTPUT_DIR': 'foo/bar', 'PLAYWRIGHT_JSON_OUTPUT_NAME': 'baz/my-report.json' });
    expect(result.exitCode).toBe(0);
    expect(result.passed).toBe(1);
    expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report.json'))).toBe(true);
  });
});

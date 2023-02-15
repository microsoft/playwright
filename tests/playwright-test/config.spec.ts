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

import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('should be able to define config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { timeout: 12345 };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        expect(testInfo.timeout).toBe(12345);
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should prioritize project timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { timeout: 500, projects: [{ timeout: 10000}, {}] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 1500));
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 500ms exceeded.');
});

test('should prioritize command line timeout over project timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [{ timeout: 10000}] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 1500));
      });
    `
  }, { timeout: '500' });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 500ms exceeded.');
});

test('should read config from --config, resolve relative testDir', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'my.config.ts': `
      import * as path from 'path';
      module.exports = {
        testDir: 'dir',
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('ignored', async ({}) => {
      });
    `,
    'dir/b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('run', async ({}) => {
      });
    `,
  }, { config: 'my.config.ts' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites.length).toBe(1);
  expect(result.report.suites[0].file).toBe('b.test.ts');
});

test('should default testDir to the config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'dir/my.config.ts': `
      module.exports = {};
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('ignored', async ({}) => {
      });
    `,
    'dir/b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('run', async ({}) => {
      });
    `,
  }, { config: path.join('dir', 'my.config.ts') });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.report.suites.length).toBe(1);
  expect(result.report.suites[0].file).toBe('b.test.ts');
});

test('should be able to set reporters', async ({ runInlineTest }, testInfo) => {
  const reportFile = testInfo.outputPath('my-report.json');
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['json', { outputFile: ${JSON.stringify(reportFile)} }],
          ['list'],
        ]
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async () => {
      });
    `
  }, { reporter: '' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  const report = JSON.parse(fs.readFileSync(reportFile).toString());
  expect(report.suites[0].file).toBe('a.test.ts');
});

test('should support different testDirs', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = { projects: [
        { testDir: __dirname },
        { testDir: 'dir' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('runs once', async ({}) => {
      });
    `,
    'dir/b.test.ts': `
      import { test, expect } from '@playwright/test';
      test('runs twice', async ({}) => {
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);

  expect(result.report.suites[0].specs[0].tests.length).toBe(1);
  expect(result.report.suites[0].specs[0].title).toBe('runs once');

  expect(result.report.suites[1].specs[0].tests.length).toBe(2);
  expect(result.report.suites[1].specs[0].title).toBe('runs twice');
});


test('should allow root testDir and use it for relative paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'config/config.ts': `
      import * as path from 'path';
      module.exports = {
        testDir: path.join(__dirname, '..'),
        projects: [{ testDir: path.join(__dirname, '..', 'dir') }]
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({}, testInfo) => {
        expect(1 + 1).toBe(3);
      });
    `,
    'dir/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({}, testInfo) => {
        expect(1 + 1).toBe(3);
      });
    `,
  }, { config: path.join('config', 'config.ts') });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain(`1) ${path.join('dir', 'a.test.ts')}:3:11 › fails`);
});

test('should throw when test() is called in config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { test, expect } from '@playwright/test';
      test('hey', () => {});
      module.exports = {};
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}) => {
      });
    `,
  });
  expect(result.output).toContain('Playwright Test did not expect test() to be called here');
});

test('should filter by project, case-insensitive', async ({ runInlineTest }) => {
  const { passed, failed, output, skipped } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log(testInfo.project.name);
      });
    `
  }, { project: 'SUite2' });
  expect(passed).toBe(1);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(output).toContain('suite2');
  expect(output).not.toContain('suite1');
});

test('should print nice error when project is unknown', async ({ runInlineTest }) => {
  const { output, exitCode } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log(testInfo.project.name);
      });
    `
  }, { project: 'suite3' });
  expect(exitCode).toBe(1);
  expect(output).toContain('Project(s) "suite3" not found. Available named projects: "suite1", "suite2"');
});

test('should filter by project list, case-insensitive', async ({ runInlineTest }) => {
  const { passed, failed, output, skipped } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
        { name: 'suite3' },
        { name: 'suite4' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log(testInfo.project.name);
      });
    `
  }, { project: ['SUite2',  'Suite3'] });
  expect(passed).toBe(2);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(output).toContain('suite2');
  expect(output).toContain('suite3');
  expect(output).not.toContain('suite1');
  expect(output).not.toContain('suite4');
});

test('should filter when duplicate project names exist', async ({ runInlineTest }) => {
  const { passed, failed, output, skipped } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
        { name: 'suite1' },
        { name: 'suite4' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log(testInfo.project.name);
      });
    `
  }, { project: ['suite1',  'sUIte4'] });
  expect(passed).toBe(3);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(output).toContain('suite1');
  expect(output).toContain('suite4');
  expect(output).not.toContain('suite2');
});

test('should print nice error when some of the projects are unknown', async ({ runInlineTest }) => {
  const { output, exitCode } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log(testInfo.project.name);
      });
    `
  }, { project: ['suitE1', 'suIte3', 'SUite4'] });
  expect(exitCode).toBe(1);
  expect(output).toContain('Project(s) "suIte3", "SUite4" not found. Available named projects: "suite1", "suite2"');
});

test('should work without config file', async ({ runInlineTest }) => {
  const { exitCode, passed, failed, skipped } = await runInlineTest({
    'playwright.config.ts': `
      throw new Error('This file should not be required');
    `,
    'dir/a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}) => {
        test.expect(1 + 1).toBe(2);
      });
    `
  }, { config: 'dir' });
  expect(exitCode).toBe(0);
  expect(passed).toBe(1);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
});

test('should inherit use options in projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { foo: 'config' },
        projects: [{
          use: { bar: 'project' },
        }]
      };
    `,
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({ foo: ['', {option:true}], bar: ['', {option: true}] });
      test('pass', async ({ foo, bar  }, testInfo) => {
        test.expect(foo).toBe('config');
        test.expect(bar).toBe('project');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support ignoreSnapshots config option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        ignoreSnapshots: true,
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        expect('foo').toMatchSnapshot();
        expect('foo').not.toMatchSnapshot();
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should validate workers option set to percent', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        workers: '50%'
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async () => {
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should throw when workers option is invalid', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = {
          workers: ''
        };
      `,
    'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('pass', async () => {
        });
      `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('config.workers must be a number or percentage');
});

test('should work with undefined values and base', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        updateSnapshots: undefined,
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        expect(testInfo.config.updateSnapshots).toBe('missing');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should have correct types for the config', async ({ runTSC }) => {
  const result = await runTSC({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';

      export default defineConfig({
        webServer: [
          {
            command: 'echo 123',
            env: { PORT: '123' },
            port: 123,
          },
          {
            command: 'echo 123',
            env: { NODE_ENV: 'test' },
            port: 8082,
          },
        ],
        globalSetup: './globalSetup',
        // @ts-expect-error
        globalTeardown: null,
        projects: [
          {
            name: 'project name',
          }
        ],
      });
  `
  });
  expect(result.exitCode).toBe(0);
});

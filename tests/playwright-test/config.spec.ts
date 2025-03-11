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

test('should support failOnFlakyTests config option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = {
          failOnFlakyTests: true,
          retries: 1
        };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('flake', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { 'retries': 1 });
  expect(result.exitCode).not.toBe(0);
  expect(result.flaky).toBe(1);
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
  const { passed, failed, outputLines, skipped } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
      ] };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log('%%' + test.info().project.name);
      });
    `
  }, { project: 'SUite2' });
  expect(passed).toBe(1);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(new Set(outputLines)).toEqual(new Set([
    'suite2',
  ]));
});

test('should filter by project wildcard', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
         { name: 'project-name' },
         { name: 'foobar' }
        ]
      };
    `,
    'a.test.js': `
      const { test } = require('@playwright/test');
      test('one', async ({}) => {
        console.log('%%' + test.info().project.name);
      });    `
  }, { '--project': '*oj*t-Na*e' });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('Running 1 test using 1 worker');
  expect(new Set(result.outputLines)).toEqual(new Set([
    'project-name',
  ]));
});

test('should print nice error when the project wildcard does not match anything', async ({ runInlineTest }) => {
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
  }, { '--project': ['not*found'] });
  expect(exitCode).toBe(1);
  expect(output).toContain('Error: No projects matched. Available projects: "suite1", "suite2"');
});

test('should filter by project wildcard and exact name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        projects: [
         { name: 'first' },
         { name: 'fooBar' },
         { name: 'foobarBaz' },
         { name: 'prefix' },
         { name: 'prefixEnd' },
        ]
      };
    `,
    'a.test.js': `
      const { test } = require('@playwright/test');
      test('one', async ({}) => {
        console.log('%%' + test.info().project.name);
      });    `
  }, { '--project': ['first', '*bar', 'pref*x'] });
  expect(result.exitCode).toBe(0);
  expect(new Set(result.outputLines)).toEqual(new Set(['first', 'fooBar', 'prefix']));
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
      test('pass', async ({}, testInfo) => {});
    `
  }, { project: 'suite3' });
  expect(exitCode).toBe(1);
  expect(output).toContain('Project(s) "suite3" not found. Available projects: "suite1", "suite2"');
});

test('should print nice error when project is unknown and launching UI mode', async ({ runInlineTest }) => {
  // Prevent UI mode from opening and the test never finishing
  test.setTimeout(5000);
  const { output, exitCode } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'suite1' },
        { name: 'suite2' },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {});
    `
  }, { project: 'suite3', ui: true });
  expect(exitCode).toBe(1);
  expect(output).toContain('Project(s) "suite3" not found. Available projects: "suite1", "suite2"');
});

test('should filter by project list, case-insensitive', async ({ runInlineTest }) => {
  const { passed, failed, outputLines, skipped } = await runInlineTest({
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
        console.log('%%' + test.info().project.name);
      });
    `
  }, { project: ['SUite2',  'Suite3'] });
  expect(passed).toBe(2);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(new Set(outputLines)).toEqual(new Set(['suite3', 'suite2']));
});

test('should filter when duplicate project names exist', async ({ runInlineTest }) => {
  const { passed, failed, outputLines, skipped } = await runInlineTest({
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
        console.log('%%' + test.info().project.name);
      });
    `
  }, { project: ['suite1',  'sUIte4'] });
  expect(passed).toBe(3);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(new Set(outputLines)).toEqual(new Set(['suite1', 'suite1', 'suite4']));
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
  expect(output).toContain('Project(s) "suIte3", "SUite4" not found. Available projects: "suite1", "suite2"');
});

test('should print nice error when project name is not stable', async ({ runInlineTest }) => {
  const { output, exitCode } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: \`calculated \$\{Date.now()\}\` },
      ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        console.log(testInfo.project.name);
      });
    `
  });
  expect(exitCode).toBe(1);
  expect(output).toContain('not found in the worker process. Make sure project name does not change.');
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
        projects: [
          { name: 'p1' },
          { name: 'p2', ignoreSnapshots: false },
        ]
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({}, testInfo) => {
        testInfo.snapshotSuffix = '';
        expect(testInfo.project.name).toMatchSnapshot();
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).not.toContain(`pass-1-p1.txt, writing actual.`);
  expect(result.output).toContain(`pass-1-p2.txt, writing actual.`);
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

test('should not allow tracesDir in launchOptions', async ({ runTSC }) => {
  const result = await runTSC({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';

      export default defineConfig({
        use: {
          launchOptions: {
            tracesDir: 'foo',
          },
        },
      });
  `
  });
  expect(result.exitCode).not.toBe(0);
});

test('should merge configs', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig, expect } from '@playwright/test';
      const baseConfig = defineConfig({
        timeout: 10,
        use: {
          foo: 1,
        },
        expect: {
          timeout: 11,
        },
        projects: [
          {
            name: 'A',
            timeout: 20,
          }
        ],
      });
      const derivedConfig = defineConfig(baseConfig, {
        timeout: 30,
        use: {
          bar: 2,
        },
        expect: {
          timeout: 12,
        },
        projects: [
          { name: 'B', timeout: 40 },
          { name: 'A', timeout: 50 },
        ],
        webServer: {
          command: 'echo 123',
        }
      });

      expect(derivedConfig).toEqual(expect.objectContaining({
        timeout: 30,
        use: { foo: 1, bar: 2 },
        expect: { timeout: 12 },
        projects: [
          { name: 'B', timeout: 40, use: {} },
          { name: 'A', timeout: 50, use: {} }
        ],
        webServer: [{
          command: 'echo 123',
        }]
      }));

      // Should not add an empty project list.
      expect(defineConfig({}, {}).projects).toBeUndefined();
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('pass', async ({}) => {});
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should merge ct configs', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig, expect } from '@playwright/experimental-ct-react';
      const baseConfig = defineConfig({
        timeout: 10,
        use: {
          foo: 1,
        },
      });
      const derivedConfig = defineConfig(baseConfig, {
        grep: 'hi',
        use: {
          bar: 2,
        },
      });

      // Make sure ct-specific properties are preserved
      // and config properties are merged.
      expect(derivedConfig).toEqual(expect.objectContaining({
        use: { foo: 1, bar: 2 },
        grep: 'hi',
        '@playwright/test': expect.objectContaining({
          babelPlugins: [[expect.stringContaining('tsxTransform.js')]]
        }),
        '@playwright/experimental-ct-core': expect.objectContaining({
          registerSourceFile: expect.stringContaining('registerSource'),
        }),
      }));
    `,
    'a.test.ts': `
      import { test } from '@playwright/experimental-ct-react';
      test('pass', async ({}) => {});
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should throw on invalid config.tsconfig option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        tsconfig: true,
      };
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`config.tsconfig must be a string`);
});

test('should throw on nonexistant config.tsconfig', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        tsconfig: './does-not-exist.json',
      };
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`config.tsconfig does not exist`);
});

test('should throw on invalid --tsconfig', async ({ runInlineTest }) => {
  const result = await runInlineTest({}, { 'tsconfig': 'does-not-exist.json' });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`--tsconfig "does-not-exist.json" does not exist`);
});

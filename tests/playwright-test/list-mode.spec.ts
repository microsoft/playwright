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
import path from 'path';
import fs from 'fs';

test('should list tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo' }, {}] };
    `,
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    `Listing tests:`,
    `  [foo] › a.test.js:3:7 › example1`,
    `  [foo] › a.test.js:6:7 › example2`,
    `  a.test.js:3:7 › example1`,
    `  a.test.js:6:7 › example2`,
    `Total: 4 tests in 1 file`
  ].join('\n'));
});

test('should list tests to stdout when JSON reporter outputs to a file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo' }, {}] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { 'list': true, 'reporter': 'json' });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('Listing tests');
  expect(result.report.config.projects.length).toBe(2);
  expect(result.report.suites.length).toBe(1);
  expect(result.report.suites[0].specs.length).toBe(2);
  expect(result.report.suites[0].specs.map(spec => spec.title)).toStrictEqual(['example1', 'example2']);
});

test('globalSetup and globalTeardown should not run', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = {
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      };
    `,
    'globalSetup.ts': `
      module.exports = () => {
        console.log('Running globalSetup');
      };
    `,
    'globalTeardown.ts': `
      module.exports = () => {
        console.log('Running globalTeardown');
      };
    `,
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('should work 1', async ({}, testInfo) => {
        console.log('Running test 1');
      });
    `,
    'b.test.js': `
      const { test, expect } = require('@playwright/test');
      test('should work 2', async ({}, testInfo) => {
        console.log('Running test 2');
      });
    `,
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    `Listing tests:`,
    `  a.test.js:3:7 › should work 1`,
    `  b.test.js:3:7 › should work 2`,
    `Total: 2 tests in 2 files`,
  ].join('\n'));
});

test('outputDir should not be removed', async ({ runInlineTest }, testInfo) => {
  const outputDir = testInfo.outputPath('dummy-output-dir');

  const result1 = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { outputDir: ${JSON.stringify(outputDir)} };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('my test', async ({}, testInfo) => {
        console.log(testInfo.outputDir);
        require('fs').writeFileSync(testInfo.outputPath('myfile.txt'), 'hello');
      });
    `,
  });
  expect(result1.exitCode).toBe(0);
  expect(fs.existsSync(path.join(outputDir, 'a-my-test', 'myfile.txt'))).toBe(true);

  const result2 = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { outputDir: ${JSON.stringify(outputDir)} };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('my test', async ({}, testInfo) => {
        console.log(testInfo.outputDir);
      });
    `,
  }, { list: true });
  expect(result2.exitCode).toBe(0);
  expect(fs.existsSync(path.join(outputDir, 'a-my-test', 'myfile.txt'))).toBe(true);
});

test('should report errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const oh = '';
      oh = 2;
    `
  }, { 'list': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('> 3 |       oh = 2;');
});

test('should ignore .only', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test.only('example2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    `Listing tests:`,
    `  a.test.js:3:7 › example1`,
    `  a.test.js:6:12 › example2`,
    `Total: 2 tests in 1 file`
  ].join('\n'));
});

test('should report errors with location', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `module.exports = { reporter: './reporter' };`,
    'reporter.ts': `
      class Reporter {
        onError(error) {
          console.log('%% ' + JSON.stringify(error.location));
        }
      }
      module.exports = Reporter;
    `,
    'a.test.js': `
      const oh = '';
      oh = 2;
    `
  }, { 'list': true });
  expect(result.exitCode).toBe(1);
  expect(JSON.parse(result.outputLines[0])).toEqual({
    file: expect.stringContaining('a.test.js'),
    line: 3,
    column: 9,
  });
});

test('should list tests once', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27087' });
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { };
    `,
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('test 1', ({}) => {});
    `
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toEqual(`Listing tests:
  a.test.js:3:7 › test 1
Total: 1 test in 1 file
`);
});

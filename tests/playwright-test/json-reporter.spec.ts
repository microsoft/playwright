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
import { test, expect } from './playwright-test-fixtures';

test('should support spec.ok', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('math fails!', async ({}) => {
        expect(1 + 1).toBe(3);
      });
    `
  }, { });
  expect(result.exitCode).toBe(1);
  expect(result.report.suites[0].specs[0].ok).toBe(true);
  expect(result.report.suites[0].specs[1].ok).toBe(false);
});

test('should report skipped due to sharding', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async () => {
      });
      test('two', async () => {
        test.skip();
      });
    `,
    'b.test.js': `
      const { test } = pwt;
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
  expect(result.report.suites[0].specs[0].tests[0].status).toBe('expected');
  expect(result.report.suites[0].specs[1].tests[0].status).toBe('skipped');
  expect(result.report.suites[1].specs[0].tests[0].status).toBe('skipped');
  expect(result.report.suites[1].specs[1].tests[0].status).toBe('skipped');
  expect(result.report.suites[1].specs[2].tests[0].status).toBe('skipped');
});

test('should report projects', async ({ runInlineTest }, testInfo) => {
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
      const { test } = pwt;
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
});

test('should have relative always-posix paths', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('math works!', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.report.config.rootDir.indexOf(path.win32.sep)).toBe(-1);
  expect(result.report.suites[0].specs[0].file).toBe('a.test.js');
  expect(result.report.suites[0].specs[0].line).toBe(6);
  expect(result.report.suites[0].specs[0].column).toBe(7);
});

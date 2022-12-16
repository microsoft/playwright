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

const testFiles = {
  'a.test.js': `
    const { test } = pwt;
    test('should work 1', async ({}, testInfo) => {
      console.log('Running test 1');
    });
  `,
  'b.test.js': `
    const { test } = pwt;
    test('should work 2', async ({}, testInfo) => {
      console.log('Running test 2');
    });
  `,
};

test('config.changed should list uncommitted tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { 'changed': true };
    `,
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    `Listing tests:`,
    `  a.test.js:6:5 › should work 1`,
    `Total: 1 test in 1 file`
  ].join('\n'));
});

test('config.changed should list test since commit', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { 'changed': 'bc78db07dfd605ef88c310cd88e7684e4589bcf6' };
    `,
  }, { 'list': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    `Listing tests:`,
    `  a.test.js:6:5 › should work 1`,
    `Total: 1 test in 1 file`
  ].join('\n'));
});

test('--changed should list uncommitted tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
  }, { 'list': true, 'changed': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain([
    `Listing tests:`,
    `  a.test.js:6:5 › should work 1`,
    `Total: 1 test in 1 file`
  ].join('\n'));
});

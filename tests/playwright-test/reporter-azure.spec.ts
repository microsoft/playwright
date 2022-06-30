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

import { expect, stripAnsi, test } from './playwright-test-fixtures';

import path from 'path';

const reporterPath = path.join(__dirname, '.', 'reporter-azure.intercept.ts');

test("'orgUrl' in config expected @azure", async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { reporter: [
        ['azure']
      ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain("Cannot read properties of undefined (reading 'orgUrl')");
  expect(result.exitCode).toBe(1);
});

test("'projectName' in config expected @azure", async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = { reporter: [
            ['azure', { 
              orgUrl: 'http://azure.devops.com' 
            }]
          ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(0);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain("azure: 'projectName' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
});

test("'planId' in config expected @azure", async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = { reporter: [
            ['azure', { 
              orgUrl: 'http://azure.devops.com',
              projectName: 'test',
             }]
          ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(0);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain("azure: 'planId' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
});

test("'token' in config expected @azure", async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = { reporter: [
            ['azure', { 
              orgUrl: 'http://azure.devops.com',
              projectName: 'test',
              planId: 231
             }]
          ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(0);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain("azure: 'token' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
});

test('incorrect orgUrl config expected @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = { reporter: [
            ['azure', { 
              orgUrl: 'http://azure.devops.com',
              projectName: 'test',
              planId: 231,
              token: 'token'
             }]
          ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(0);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain('getaddrinfo ENOTFOUND azure.devops.com');
  expect(result.exitCode).toBe(1);
});


test('correct orgUrl config, incorrect token @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = { reporter: [
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-neo',
            projectName: 'test',
            planId: 231,
            token: 'token'
          }]
        ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(0);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain('Failed request: (401)');
  expect(result.exitCode).toBe(1);
  console.log(stripAnsi(result.output));
});

test.only('correct orgUrl config, correct token @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
        module.exports = { 
          timeout: 10_000,
          reporter: [
          ['${reporterPath}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleProject',
            planId: 4,
            token: 'avarxt4kuvyz3xyfssthwj7itzmjfhpdps5aupp2prwjvzka5e2q'
          }]
        ]};
      `,
    'a.spec.js': `
      const { test } = pwt;
      test('[33] foobar', async ({}) => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain('azure: Using run 150 to publish test results');
  expect(stripAnsi(result.output)).toContain('azure: No test points found for test case');
  expect(result.exitCode).toBe(1);
  console.log(stripAnsi(result.output));
});

// 'avarxt4kuvyz3xyfssthwj7itzmjfhpdps5aupp2prwjvzka5e2q'
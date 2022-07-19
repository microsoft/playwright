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

/**
 * @param {string} number - The number of reporter to test. Format is: 01, 02, etc.
 */
const reporterPath = (number: string) => {
  return path.join(__dirname, '.', 'assets', 'azure-reporter', `reporter-azure.intercept.${number}.ts`).replace(/\\/g, '/');
};

test("'orgUrl' in config expected @azure", async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure']
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async ({}) => {
        expect(1).toBe(0);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).toContain("azure: 'orgUrl' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
});

test("'projectName' in config expected @azure", async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://azure.devops.com' 
          }]
        ]
      };
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
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://azure.devops.com',
            projectName: 'test',
            }]
        ]
      };
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
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://azure.devops.com',
            projectName: 'test',
            planId: 231
          }]
        ]
      };
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

test('correct orgUrl config expected @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://azure.devops.com',
            projectName: 'test',
            planId: 231,
            token: 'token'
          }]
        ]
      };
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

test('06 correct orgUrl config, incorrect token @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['${reporterPath('06')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'test',
            planId: 231,
            token: 'token'
          }]
        ]
      };
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
});

test('01 correct orgUrl config, correct token, incorrect testCaseId @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['${reporterPath('01')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token'
          }]
        ]
      };
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
  expect(stripAnsi(result.output)).toContain('azure: Test [33] foobar - passed');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [33] foobar');
  expect(stripAnsi(result.output)).toContain('azure: No test points found for test case');
  expect(stripAnsi(result.output)).toContain('azure: Run 150 - Completed');
  expect(result.exitCode).toBe(0);
});

test('02 correct orgUrl config, correct token, correct testCaseId @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['${reporterPath('02')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token'
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain('azure: Using run 150 to publish test results');
  expect(stripAnsi(result.output)).toContain('azure: Test [3] foobar - passed');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Result published: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Run 150 - Completed');
  expect(result.exitCode).toBe(0);
});

test('02 disable logging @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['${reporterPath('02')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
            logging: false
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).not.toMatch(/azure: (.*)/);
  expect(result.exitCode).toBe(0);
});

test('03 testCaseId not specified @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['${reporterPath('03')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token'
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async () => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain('azure: Using run 150 to publish test results');
  expect(stripAnsi(result.output)).toContain('azure: Test foobar - passed');
  expect(stripAnsi(result.output)).not.toContain('azure: Start publishing: foobar');
  expect(stripAnsi(result.output)).not.toContain('azure: Result published: foobar');
  expect(stripAnsi(result.output)).toContain('azure: Run 150 - Completed');
  expect(result.exitCode).toBe(0);
});

test('04 incorrect planId @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['${reporterPath('04')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 44,
            token: 'token'
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain('azure: Using run 150 to publish test results');
  expect(stripAnsi(result.output)).toContain('azure: Test [3] foobar - passed');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: While getting test point ids, by test cases ids.');
  expect(stripAnsi(result.output)).toContain('Could not find test point for test case [3] associated with test plan 44. Check, maybe testPlanId, what you specifiyed, is incorrect');
  expect(stripAnsi(result.output)).not.toContain('azure: Result published: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Run 150 - Completed');
  expect(result.exitCode).toBe(0);
});

test('05 upload attachments, attachmentsType in not defined - default "screenshot" @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        use: {
          screenshot: 'only-on-failure',
          trace: 'retain-on-failure',
          video: 'retain-on-failure',
        },
        reporter: [
          ['list'],
          ['${reporterPath('05')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
            uploadAttachments: true,
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      test('[7] with screenshot', async ({ page }) => {
        await page.goto('https://playwright.dev/')
        await page.locator('text=Get started').click()
        await expect(page).toHaveTitle(/Getting sttttarted/)
      });
      `
  }, { reporter: '' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain("azure: 'attachmentsType' is not set. Attachments Type will be set to 'screenshot' by default.");
  expect(stripAnsi(result.output)).toContain('azure: Using run 150 to publish test results');
  expect(stripAnsi(result.output)).toContain('azure: Test [3] foobar - passed');
  expect(stripAnsi(result.output)).toContain('azure: Test [7] with screenshot - failed');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [7] with screenshot');
  expect(stripAnsi(result.output)).toContain('azure: Start upload attachments for test case [7]');
  expect(stripAnsi(result.output)).toContain('azure: Result published: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Result published: [7] with screenshot');
  expect(stripAnsi(result.output)).toContain('azure: Run 150 - Completed');
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
});

test('05 upload attachments with attachments type @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        use: {
          screenshot: 'only-on-failure',
          trace: 'retain-on-failure',
          video: 'retain-on-failure',
        },
        reporter: [
          ['list'],
          ['${reporterPath('05')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
            uploadAttachments: true,
            attachmentsType: ['screenshot', 'trace', 'video']
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      test('[7] with screenshot', async ({ page }) => {
        await page.goto('https://playwright.dev/')
        await page.locator('text=Get started').click()
        await expect(page).toHaveTitle(/Getting sttttarted/)
      });
      `
  }, { reporter: '' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain('azure: Using run 150 to publish test results');
  expect(stripAnsi(result.output)).toContain('azure: Test [3] foobar - passed');
  expect(stripAnsi(result.output)).toContain('azure: Test [7] with screenshot - failed');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Start publishing: [7] with screenshot');
  expect(stripAnsi(result.output)).toContain('azure: Start upload attachments for test case [7]');
  expect(stripAnsi(result.output)).toContain('azure: Result published: [3] foobar');
  expect(stripAnsi(result.output)).toContain('azure: Result published: [7] with screenshot');
  expect(stripAnsi(result.output)).toContain('azure: Run 150 - Completed');
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
});

test('07 incorrect project name @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['${reporterPath('07')}'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toContain('azure: Project SampleSample does not exist. Reporting is disabled.');
  expect(stripAnsi(result.output)).not.toContain('azure: Using run');
  expect(stripAnsi(result.output)).not.toContain('azure: Start publishing:');
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('disabled reporter @azure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'https://dev.azure.com/alex-alex',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
            isDisabled: true
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(1);
      });
      `
  }, { reporter: '' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).not.toContain('azure:');
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

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

import colors from 'colors/safe';
import path from 'path';
import azureAreas from './assets/azure-reporter/azureAreas';
import headers from './assets/azure-reporter/azureHeaders';
import location from './assets/azure-reporter/azureLocationOptionsResponse.json';
import { expect, stripAnsi, test } from './playwright-test-fixtures';

const TEST_OPTIONS_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'azureTestOptionsResponse.json');
const CORE_OPTIONS_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'azureCoreOptionsResponse.json');
const PROJECT_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'projectValidResponse.json');
const PROJECT_INVALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'projectInvalidResponse.json');
const CREATE_RUN_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'createRunValidResponse.json');
const CREATE_RUN_INVALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'createRunInvalidResponse.json');
const POINTS_3_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'points3Response.json');
const POINTS_7_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'points7Response.json');
const POINTS_33_INVALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'points33InvalidResponse.json');
const COMPLETE_RUN_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'completeRunValidResponse.json');
const TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'testRunResults3ValidResponse.json');
const TEST_RUN_RESULTS_7_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'testRunResults7ValidResponse.json');
const RUN_RESULTS_ATTACHMENTS_VALID_RESPONSE_PATH = path.join(__dirname, '.', 'assets', 'azure-reporter', 'runResultsAttachmentsResponse.json');

function setHeaders(response, headers) {
  const head = {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [i, _] of headers.entries()) {
    if (i % 2 === 0)
      head[headers[i]] = headers[i + 1];

  }
  for (const [key, value] of Object.entries(head))
    response.setHeader(key, value);

}

async function getRequestBody(req: import('http').IncomingMessage & { postBody: Promise<Buffer>; }) {
  return req.postBody.then(body => body.toString('utf-8')).then(body => JSON.parse(body));
}

test("'orgUrl' in config expected", async ({ runInlineTest }) => {
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
  expect(stripAnsi(result.output)).toContain("pw:test:azure 'orgUrl' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test("'projectName' in config expected", async ({ runInlineTest }) => {
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
  expect(stripAnsi(result.output)).toContain("pw:test:azure 'projectName' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test("'planId' in config expected", async ({ runInlineTest }) => {
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
  expect(stripAnsi(result.output)).toContain("pw:test:azure 'planId' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test("'token' in config expected", async ({ runInlineTest }) => {
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
  expect(stripAnsi(result.output)).toContain("pw:test:azure 'token' is not set. Reporting is disabled.");
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('correct orgUrl config expected', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://azure.devops.com',
            projectName: 'test',
            planId: 231,
            token: 'token',
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
  expect(stripAnsi(result.output)).toContain('Failed to create test run. Check your orgUrl. Reporting is disabled.');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('06 correct orgUrl config, incorrect token', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.statusCode = 401;
    res.end('');
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['list'],
          ['azure', {
            orgUrl: 'http://localhost:${server.PORT}',
            projectName: 'test',
            planId: 231,
            token: 'token',
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
  expect(stripAnsi(result.output)).toContain('pw:test:azure Failed to create test run. Check your token. Reporting is disabled.');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('01 correct orgUrl config, correct token, incorrect testCaseId', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, POINTS_33_INVALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://localhost:${server.PORT}',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[33] foobar', async ({}) => {
        expect(1).toBe(0);
      });
    `
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Using run (\d.*) to publish test results/);
  expect(stripAnsi(result.output)).toContain('pw:test:azure [33] foobar - failed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [33] foobar');
  expect(result.output).toContain(colors.yellow(colors.red('No test points found for test case [33]')));
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Run (\d.*) - Completed/);
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('02 correct orgUrl config, correct token, correct testCaseId', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, POINTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', {
            orgUrl: 'http://localhost:${server.PORT}',
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
        expect(1).toBe(0);
      });
    `
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Using run (\d.*) to publish test results/);
  expect(stripAnsi(result.output)).toContain('pw:test:azure [3] foobar - failed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Result published: [3] foobar');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Run (\d.*) - Completed/);
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('02 logging default is disabled', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, POINTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', {
            orgUrl: 'http://localhost:${server.PORT}',
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
        expect(1).toBe(0);
      });
    `
  }, { reporter: '' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).not.toMatch(/pw:test:azure (.*)/);
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('03 testCaseId not specified', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, POINTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://localhost:${server.PORT}',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('foobar', async () => {
        expect(1).toBe(0);
      });
    `
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Using run (\d.*) to publish test results/);
  expect(stripAnsi(result.output)).toContain('pw:test:azure foobar - failed');
  expect(stripAnsi(result.output)).not.toContain('pw:test:azure Start publishing: foobar');
  expect(stripAnsi(result.output)).not.toContain('pw:test:azure Result published: foobar');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Run (\d.*) - Completed/);
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('04 incorrect planId', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, POINTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://localhost:${server.PORT}',
            projectName: 'SampleSample',
            planId: 44,
            token: 'token',
          }]
        ]
      };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('[3] foobar', async () => {
        expect(1).toBe(0);
      });
    `
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });
  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Using run (\d.*) to publish test results/);
  expect(stripAnsi(result.output)).toContain('pw:test:azure [3] foobar - failed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('Could not find test point for test case [3] associated with test plan 44. Check, maybe testPlanId, what you specified, is incorrect');
  expect(result.output).toContain(colors.yellow(colors.red('No test points found for test case [3]')));
  expect(stripAnsi(result.output)).not.toContain('pw:test:azure Result published: [3] foobar');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Run (\d.*) - Completed/);
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('05 upload attachments, attachmentsType in not defined - default "screenshot"', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', async (req, res) => {
    const body = await getRequestBody(req);
    setHeaders(res, headers);
    if (body.pointsFilter?.testcaseIds[0] === 3)
      server.serveFile(req, res, POINTS_3_VALID_RESPONSE_PATH);
    else if (body.pointsFilter?.testcaseIds[0] === 7)
      server.serveFile(req, res, POINTS_7_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results', async (req, res) => {
    const body = await getRequestBody(req);
    setHeaders(res, headers);
    if (body[0].testCase?.id === '3')
      server.serveFile(req, res, TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH);
    else if (body[0].testCase?.id === '7')
      server.serveFile(req, res, TEST_RUN_RESULTS_7_VALID_RESPONSE_PATH);

  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results/100001/Attachments', async (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, RUN_RESULTS_ATTACHMENTS_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

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
          ['azure', {
            orgUrl: 'http://localhost:${server.PORT}',
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
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(result.output).toContain(colors.yellow("'attachmentsType' is not set. Attachments Type will be set to 'screenshot' by default."));
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Using run (\d.*) to publish test results/);
  expect(stripAnsi(result.output)).toContain('pw:test:azure [3] foobar - passed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure [7] with screenshot - failed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [7] with screenshot');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start upload attachments for test case [7]');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Result published: [3] foobar');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Result published: [7] with screenshot');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Run (\d.*) - Completed/);
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
});

test('05 upload attachments with attachments type', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, PROJECT_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CREATE_RUN_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Points', async (req, res) => {
    const body = await getRequestBody(req);
    setHeaders(res, headers);
    if (body.pointsFilter?.testcaseIds[0] === 3)
      server.serveFile(req, res, POINTS_3_VALID_RESPONSE_PATH);
    else if (body.pointsFilter?.testcaseIds[0] === 7)
      server.serveFile(req, res, POINTS_7_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results', async (req, res) => {
    const body = await getRequestBody(req);
    setHeaders(res, headers);
    if (body[0].testCase?.id === '3')
      server.serveFile(req, res, TEST_RUN_RESULTS_3_VALID_RESPONSE_PATH);
    else if (body[0].testCase?.id === '7')
      server.serveFile(req, res, TEST_RUN_RESULTS_7_VALID_RESPONSE_PATH);

  });

  server.setRoute('/SampleSample/_apis/test/Runs/150/Results/100001/Attachments', async (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, RUN_RESULTS_ATTACHMENTS_VALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs/150', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, COMPLETE_RUN_VALID_RESPONSE_PATH);
  });

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
          ['azure', { 
            orgUrl: 'http://localhost:${server.PORT}',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
            uploadAttachments: true,
            attachmentsType: ['screenshot', 'trace', 'video'],
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
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).not.toContain("pw:test:azure 'attachmentsType' is not set. Attachments Type will be set to 'screenshot' by default.");
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Using run (\d.*) to publish test results/);
  expect(stripAnsi(result.output)).toContain('pw:test:azure [3] foobar - passed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure [7] with screenshot - failed');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [3] foobar');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start publishing: [7] with screenshot');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Start upload attachments for test case [7]');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Result published: [3] foobar');
  expect(stripAnsi(result.output)).toContain('pw:test:azure Result published: [7] with screenshot');
  expect(stripAnsi(result.output)).toMatch(/pw:test:azure Run (\d.*) - Completed/);
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
});

test('07 incorrect project name', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/projects/SampleSample', (req, res) => {
    setHeaders(res, headers);
    res.statusCode = 404;
    server.serveFile(req, res, PROJECT_INVALID_RESPONSE_PATH);
  });

  server.setRoute('/SampleSample/_apis/test/Runs', (req, res) => {
    setHeaders(res, headers);
    res.statusCode = 404;
    server.serveFile(req, res, CREATE_RUN_INVALID_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', { 
            orgUrl: 'http://localhost:${server.PORT}',
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
        expect(1).toBe(0);
      });
    `
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(result.output).toContain(colors.yellow(colors.red('Project SampleSample does not exist. Reporting is disabled.')));
  expect(result.output).toContain(colors.yellow(colors.red('Failed to create test run. Reporting is disabled.')));
  expect(stripAnsi(result.output)).not.toContain('pw:test:azure Using run');
  expect(stripAnsi(result.output)).not.toContain('pw:test:azure Start publishing:');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('disabled reporter', async ({ runInlineTest, server }) => {
  server.setRoute('/_apis/Location', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(location));
  });

  server.setRoute('/_apis/ResourceAreas', (_, res) => {
    setHeaders(res, headers);
    res.end(JSON.stringify(azureAreas(server.PORT)));
  });

  server.setRoute('/_apis/Test', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, TEST_OPTIONS_RESPONSE_PATH);
  });

  server.setRoute('/_apis/core', (req, res) => {
    setHeaders(res, headers);
    server.serveFile(req, res, CORE_OPTIONS_RESPONSE_PATH);
  });

  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { 
        reporter: [
          ['list'],
          ['azure', {
            orgUrl: 'http://localhost:${server.PORT}',
            projectName: 'SampleSample',
            planId: 4,
            token: 'token',
            isDisabled: true,
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
  }, { reporter: '' }, { DEBUG: 'pw:test:azure' });

  expect(stripAnsi(result.output)).not.toContain('Failed request: (401)');
  expect(stripAnsi(result.output)).not.toContain('pw:test:azure');
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

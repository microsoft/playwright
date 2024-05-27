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
import { expect, test } from './playwright-test-fixtures';

type LastRunReport = {
  status: string;
  failedTests: string[];
  testDurations: { [testId: string]: number };
};

const testCases = {
  'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('a', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('math fails!', async ({}) => {
        expect(1 + 1).toBe(3);
      });
      test.skip('math skipped', async ({}) => {
      });
    `
};

test('report lastrun info', async ({ runInlineTest }) => {
  const result = await runInlineTest(testCases, { reporter: 'lastrun' });
  expect(result.exitCode).toBe(1);
  const lastRunFilename = test.info().outputPath('.last-run.json');
  const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
  expect(lastRun.status).toEqual('failed');
  expect(lastRun.failedTests.length).toEqual(1);
  expect(Object.keys(lastRun.testDurations).length).toEqual(3);
});

test('keep test-ids consistent when re-run', async ({ runInlineTest }) => {
  let lastRun: LastRunReport;
  {
    const result = await runInlineTest(testCases, { reporter: 'lastrun' });
    expect(result.exitCode).toBe(1);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const currentRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    expect(currentRun.failedTests.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(currentRun.testDurations).length).toBeGreaterThanOrEqual(1);
    lastRun = currentRun;
  }
  {
    const result = await runInlineTest(testCases, { reporter: 'lastrun' });
    expect(result.exitCode).toBe(1);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const currentRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    // Ensure test-ids are the same as the previous run.
    expect(currentRun.failedTests.sort()).toEqual(lastRun.failedTests.sort());
    expect(Object.keys(currentRun.testDurations).sort()).toEqual(Object.keys(lastRun.testDurations).sort());
  }
});

test('keep test-ids consistent when merging reports', async ({ runInlineTest, mergeReports }) => {
  const reportDir = test.info().outputPath('blob-report');
  const allFailedTests: string[] = [];
  const allTestDurations: { [testId: string]: number } = {};
  const testFiles = {
    ...testCases,
    'playwright.config.ts': `module.exports = {
      reporter: [
        ['lastrun'],
        ['blob', { outputDir: 'blob-report' }],
      ]
    };`,
  };
  {
    await runInlineTest(testFiles, { shard: '1/2' });
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    lastRun.failedTests.forEach(t => allFailedTests.push(t));
    Object.entries(lastRun.testDurations).forEach(([k, v]) => allTestDurations[k] = v);
  }
  {
    await runInlineTest(testFiles, { shard: '2/2' }, { PWTEST_BLOB_DO_NOT_REMOVE: '1' });
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    lastRun.failedTests.forEach(t => allFailedTests.push(t));
    Object.entries(lastRun.testDurations).forEach(([k, v]) => allTestDurations[k] = v);
  }
  {
    expect(allFailedTests.length).toBeGreaterThanOrEqual(1);
    expect(Object.keys(allTestDurations).length).toBeGreaterThanOrEqual(1);
  }
  {
    const reportFiles = await fs.promises.readdir(reportDir);
    reportFiles.sort();
    expect(reportFiles).toEqual(['report-1.zip', 'report-2.zip']);
    const result = await mergeReports(reportDir, { 'PLAYWRIGHT_HTML_OPEN': 'never' }, { additionalArgs: ['--reporter', 'lastrun'] });
    expect(result.exitCode).toBe(0);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    // Ensure test-ids are the same as the previous run.
    expect(Object.keys(lastRun.testDurations).sort()).toEqual(Object.keys(allTestDurations).sort());
    expect(lastRun.failedTests.sort()).toEqual(allFailedTests.sort());
  }
});

test('keep existing test-ids when test files are modified', async ({ runInlineTest }) => {
  let firstTestId: string;
  {
    // First we start with a single test and record the test-id.
    const result = await runInlineTest({
      'a.test.js': `
        import { test, expect } from '@playwright/test';
        test('first test created', async ({}) => {
          expect(1 + 1).toBe(2);
        });
      `
    }, { reporter: 'lastrun' });
    expect(result.exitCode).toBe(0);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    expect(lastRun.failedTests.length).toEqual(0);
    expect(Object.keys(lastRun.testDurations).length).toEqual(1);
    firstTestId = Object.keys(lastRun.testDurations)[0];
  }
  {
    // Then we add more tests and ensure the test-id is still the same.
    const result = await runInlineTest({
      'a.test.js': `
        import { test, expect } from '@playwright/test';
        test('another test', async ({}) => {
          expect(1 + 1).toBe(2);
        });
        test('first test created', async ({}) => {
          expect(1 + 1).toBe(2);
        });
        test('yet another test', async ({}) => {
          expect(1 + 1).toBe(2);
        });
      `
    }, { reporter: 'lastrun' });
    expect(result.exitCode).toBe(0);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    expect(lastRun.failedTests.length).toEqual(0);
    expect(Object.keys(lastRun.testDurations).length).toEqual(3);
    expect(Object.keys(lastRun.testDurations)).toContain(firstTestId);
  }
});

test('ensure same tests in different files have distinct test-ids', async ({ runInlineTest }) => {
  let firstTestId: string;
  {
    const result = await runInlineTest({
      'a.test.js': `
        import { test, expect } from '@playwright/test';
        test('math test', async ({}) => {
          expect(1 + 1).toBe(2);
        });
      `
    }, { reporter: 'lastrun' }, {}, { additionalArgs: ['a.test.js'] });
    expect(result.exitCode).toBe(0);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    expect(lastRun.failedTests.length).toEqual(0);
    expect(Object.keys(lastRun.testDurations).length).toEqual(1);
    firstTestId = Object.keys(lastRun.testDurations)[0];
  }
  {
    const result = await runInlineTest({
      'b.test.js': `
        import { test, expect } from '@playwright/test';
        test('math test', async ({}) => {
          expect(1 + 1).toBe(2);
        });
      `
    }, { reporter: 'lastrun' }, {}, { additionalArgs: ['b.test.js'] });
    expect(result.exitCode).toBe(0);
    const lastRunFilename = test.info().outputPath('.last-run.json');
    const lastRun = JSON.parse(await fs.promises.readFile(lastRunFilename, 'utf8')) as LastRunReport;
    expect(lastRun.failedTests.length).toEqual(0);
    expect(Object.keys(lastRun.testDurations).length).toEqual(1);
    const otherTestId = Object.keys(lastRun.testDurations)[0];
    expect(otherTestId).not.toEqual(firstTestId);
  }
});

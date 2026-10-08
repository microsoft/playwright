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

import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { test, expect, stripAnsi } from './playwright-test-fixtures';
import { extractZip } from '../../packages/utils/third_party/extractZip';

import type { HTMLReport, TestFile } from '../../packages/html-reporter/src/types';
import type { JSONReport, JSONReportSpec, JSONReportSuite } from '@playwright/test/reporter';

const passingTest = `
  import { test } from '@playwright/test';
  test('passes', () => {});
`;

const testFiles = {
  'passing.test.ts': `
    import fs from 'fs';
    import { test } from '@playwright/test';
    test('passes', async ({}, testInfo) => {
      fs.writeFileSync('passing-ran.txt', 'ran');
      const attachmentPath = testInfo.outputPath('passing.txt');
      fs.writeFileSync(attachmentPath, 'passing attachment');
      await testInfo.attach('passing', { path: attachmentPath });
    });
  `,
  'failures.test.ts': `
    import fs from 'fs';
    import { test, expect } from '@playwright/test';
    test.describe('failures', () => {
      test('fails', async ({}, testInfo) => {
        const attachmentPath = testInfo.outputPath('failure.txt');
        fs.writeFileSync(attachmentPath, 'failure attachment');
        await testInfo.attach('failure', { path: attachmentPath });
        expect(1).toBe(2);
      });
      test('flaky', ({}, testInfo) => {
        console.log('flaky attempt ' + testInfo.retry);
        console.error('flaky stderr ' + testInfo.retry);
        if (!testInfo.retry)
          throw new Error('flaky failure');
      });
      test('unexpectedly passes', () => {
        test.fail();
      });
    });
    test.describe('ignored', () => {
      test.skip('skipped', () => {});
      test('expected failure', () => {
        test.fail();
        throw new Error('expected failure');
      });
    });
  `,
};

test('--reporter-only-failures leaves terminal reporters unchanged', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': passingTest,
  }, { 'reporter': 'list,line,dot', 'reporter-only-failures': true }, { PLAYWRIGHT_FORCE_TTY: '0' });
  expect(result.exitCode).toBe(0);
  expect(result.output.match(/Running 1 test using/g)).toHaveLength(3);
  expect(result.output.match(/› passes/g)).toHaveLength(2);
  expect(result.output).toContain('·');
});

test('failures reporter accounts for passing and failing test durations', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        reporter: 'failures',
        fullyParallel: false,
        reportSlowTests: { max: 1, threshold: 300 },
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('passes', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });
      test('fails', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        throw new Error('failure');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Slow test file: a.test.ts');
});

test('failures reporter respects quiet and reports errors outside tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        reporter: 'failures',
        quiet: true,
        globalTeardown: './global-teardown.ts',
      };
    `,
    'global-teardown.ts': `
      export default () => {
        throw new Error('global teardown failed');
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('passes', () => {
        process.stdout.write('test stdout');
        process.stderr.write('test stderr');
      });
      test.skip('skipped', () => {});
      test('expected failure', () => {
        test.fail();
        throw new Error('expected failure');
      });
    `,
  }, {}, { PLAYWRIGHT_FORCE_TTY: '1' });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.output).not.toContain('test stdout');
  expect(result.output).not.toContain('test stderr');
  expect(result.output.match(/Error: global teardown failed/g)).toHaveLength(1);
  expect(result.output).toContain('1 error was not a part of any test');
  expect(result.output).toContain('1 skipped');
  expect(result.output).not.toContain('Running 1 test using');
  expect(result.output).not.toMatch(/› (?:passes|skipped|expected failure)/);
  expect(result.rawOutput).not.toContain('\u001B[1A');
});

test('failures reporter avoids automatic terminal output', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      export default { reporter: [['json', { outputFile: 'report.json' }]] };
    `,
    'a.test.ts': passingTest,
  };
  const fallback = await runInlineTest(files, { 'reporter-only-failures': true }, { CI: undefined });
  expect(fallback.exitCode).toBe(0);
  expect(fallback.output).toContain('Running 1 test using');
  expect(fallback.output).toContain('› passes');
  const added = await runInlineTest(files, { 'reporter-only-failures': true, 'add-reporter': 'failures' }, { CI: undefined });
  expect(added.exitCode).toBe(0);
  expect(added.output).toMatch(/^  1 passed \([^)]+\)\n$/);
});

test('onlyFailures can be configured independently for each reporter', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        reporter: [
          ['failures'],
          ['json', { onlyFailures: true, outputFile: 'failures.json' }],
          ['json', { outputFile: 'complete.json' }],
        ],
      };
    `,
    'a.test.ts': passingTest + `
      test('fails', () => {
        throw new Error('failure');
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain('› passes');
  expect(result.passed).toBe(1);
  const failures: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('failures.json'), 'utf8'));
  const complete: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('complete.json'), 'utf8'));
  expect(jsonTestSpecs(failures.suites).map(spec => spec.title)).toEqual(['fails']);
  expect(jsonTestSpecs(complete.suites).map(spec => spec.title)).toEqual(['passes', 'fails']);
});

for (const merge of [false, true]) {
  test(`--reporter-only-failures filters final reports and preserves blobs when ${merge ? 'merging' : 'running'}`, async ({ runInlineTest, mergeReports }, testInfo) => {
    const result = await runInlineTest({
      ...testFiles,
      'playwright.config.ts': `
        export default {
          retries: 1,
          reporter: [
            ['failures'],
            ['json', { outputFile: 'report.json' }],
            ['junit', { outputFile: 'report.xml', includeRetries: false }],
            ['html', { open: 'never' }],
            ['blob', { outputDir: 'complete-blob-report' }],
            ['perfetto', { outputFile: 'perfetto.json' }],
            ['./integrity-reporter.ts', { onlyFailures: false }],
          ],
        };
      `,
      'integrity-reporter.ts': `
        export default class {
          constructor(options: { onlyFailures?: boolean }) {
            console.log('%%onlyFailures: ' + options.onlyFailures);
          }
          onBegin(config, suite) {
            this.suite = suite;
            console.log('%%begin: ' + suite.allTests().length);
          }
          onTestBegin(test) {
            console.log('%%begin: ' + test.title);
          }
          onTestEnd(test) {
            console.log('%%end: ' + test.title);
          }
          onEnd() {
            console.log('%%end: ' + this.suite.allTests().length);
          }
        }
      `,
    }, merge ? { reporter: 'blob', workers: 1 } : { 'reporter-only-failures': true, 'workers': 1 }, { PLAYWRIGHT_JUNIT_INCLUDE_RETRIES: '0' });
    expect(result.exitCode).toBe(1);
    let output = result.output;
    if (merge) {
      const merged = await mergeReports(testInfo.outputPath('blob-report'), { PLAYWRIGHT_JUNIT_INCLUDE_RETRIES: '0' }, {
        cwd: testInfo.outputPath(),
        additionalArgs: ['--config', testInfo.outputPath('playwright.config.ts'), '--reporter-only-failures'],
      });
      expect(merged.exitCode).toBe(0);
      output = stripAnsi(merged.output);
    }
    expect(output).toContain('2 passed');
    expect(output).toContain('2 failed');
    expect(output).toContain('1 flaky');
    expect(output).toContain('Passed on retry #1');
    expect(output.match(/^    Error: expect\(received\)/gm)).toHaveLength(2);
    expect(output.match(/^    Error: flaky failure/gm)).toHaveLength(1);
    expect(output).toContain('Expected: 2');
    expect(output).toContain('Received: 1');
    expect(output).toMatch(/> +\d+ \| +expect\(1\)\.toBe\(2\);/);
    expect(output).toMatch(/at .*failures\.test\.ts:\d+:\d+/);
    expect(output).not.toContain('Running 6 tests');
    expect(output).not.toContain('passing.test.ts');
    expect(output).toContain('%%begin: 6');
    expect(output).toContain('%%end: 6');
    expect(output).toContain('%%onlyFailures: true');
    expect(fs.existsSync(testInfo.outputPath('passing-ran.txt'))).toBe(true);

    const titles = ['fails', 'flaky', 'unexpectedly passes'];
    const allTitles = [...titles, 'passes', 'skipped', 'expected failure'].sort();
    for (const title of allTitles) {
      expect(output).toContain(`%%begin: ${title}`);
      expect(output).toContain(`%%end: ${title}`);
    }
    for (const retry of [0, 1]) {
      expect(output).toContain(`flaky attempt ${retry}`);
      expect(output).toContain(`flaky stderr ${retry}`);
    }
    const json: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('report.json'), 'utf8'));
    const specs = jsonTestSpecs(json.suites);
    expect(specs.map(spec => spec.title).sort()).toEqual(titles);
    expect(json.stats).toMatchObject({ expected: 0, skipped: 0, unexpected: 2, flaky: 1 });
    for (const spec of specs) {
      const statuses = spec.title === 'flaky' ? ['failed', 'passed'] : spec.title === 'fails' ? ['failed', 'failed'] : ['passed', 'passed'];
      expect(spec.tests[0].results.map(result => result.status)).toEqual(statuses);
    }

    const xml = await xml2js.parseStringPromise(fs.readFileSync(testInfo.outputPath('report.xml'), 'utf8'));
    expect(xml.testsuites.$.tests).toBe('3');
    expect(xml.testsuites.testsuite).toHaveLength(1);
    expect(xml.testsuites.testsuite[0].testcase.map((entry: { $: { name: string } }) => entry.$.name).sort()).toEqual(titles.map(title => `failures › ${title}`));
    const junitTests = xml.testsuites.testsuite[0].testcase;
    expect(junitTests[0].failure).toHaveLength(1);
    expect(junitTests[0].rerunFailure).toHaveLength(1);
    expect(junitTests[1].flakyError).toHaveLength(1);
    expect(junitTests[1].flakyError[0]['system-out'][0]).toContain('flaky attempt 0');
    expect(junitTests[1]['system-out'][0]).toContain('flaky attempt 1');

    const html = fs.readFileSync(testInfo.outputPath('playwright-report', 'index.html'), 'utf8');
    const data = html.match(/<template id="playwrightReportBase64">data:application\/zip;base64,([^<]+)<\/template>/);
    expect(data).not.toBeNull();
    const htmlZip = testInfo.outputPath('html-data.zip');
    fs.writeFileSync(htmlZip, Buffer.from(data![1], 'base64'));
    const htmlDataDir = testInfo.outputPath('html-data');
    await extractZip(htmlZip, { dir: htmlDataDir });
    const htmlReport: HTMLReport = JSON.parse(fs.readFileSync(path.join(htmlDataDir, 'report.json'), 'utf8'));
    expect(htmlReport.files.flatMap(file => file.tests.map(test => test.title)).sort()).toEqual(titles);
    expect(htmlReport.stats).toMatchObject({ total: 3, expected: 0, skipped: 0, unexpected: 2, flaky: 1 });
    const htmlFile: TestFile = JSON.parse(fs.readFileSync(path.join(htmlDataDir, htmlReport.files[0].fileId + '.json'), 'utf8'));
    for (const test of htmlFile.tests) {
      const statuses = test.title === 'flaky' ? ['failed', 'passed'] : test.title === 'fails' ? ['failed', 'failed'] : ['passed', 'passed'];
      expect(test.results.map(result => result.status)).toEqual(statuses);
    }

    if (!merge) {
      const trace: { traceEvents: { cat: string, name: string }[] } = JSON.parse(fs.readFileSync(testInfo.outputPath('perfetto.json'), 'utf8'));
      expect([...new Set(trace.traceEvents.filter(event => event.cat === 'test').map(event => event.name))].sort()).toEqual(allTitles);

      const blobDir = testInfo.outputPath('complete-blob-report');
      const blobFile = fs.readdirSync(blobDir).find(file => file.endsWith('.zip'))!;
      const extractedBlob = testInfo.outputPath('extracted-blob');
      await extractZip(path.join(blobDir, blobFile), { dir: extractedBlob });
      const messages = fs.readFileSync(path.join(extractedBlob, 'report.jsonl'), 'utf8');
      expect(messages).toContain('passing.test.ts');
      for (const title of allTitles)
        expect(messages).toContain(`"title":"${title}"`);
      const resources = fs.readdirSync(path.join(extractedBlob, 'resources'));
      const attachments = resources.filter(resource => resource.endsWith('.txt')).map(resource => fs.readFileSync(path.join(extractedBlob, 'resources', resource), 'utf8'));
      expect(attachments.sort()).toEqual(['failure attachment', 'failure attachment', 'passing attachment']);
    }
  });
}

test('failures reporter prints timeout and successful retry details live without progress', async ({ interactWithTestRunner }, testInfo) => {
  const runner = await interactWithTestRunner({
    'playwright.config.ts': `
      export default {
        reporter: [['failures', { omitTags: true }]],
        retries: 1,
      };
    `,
    'a.test.ts': `
      import fs from 'fs';
      import { test } from '@playwright/test';
      test('flaky', { tag: '@tag' }, async ({}, testInfo) => {
        if (testInfo.retry) {
          console.log('RETRY STARTED');
          while (!fs.existsSync('continue'))
            await new Promise(resolve => setTimeout(resolve, 10));
        } else {
          process.stdout.write('partial stdout');
          test.setTimeout(500);
          await new Promise(() => {});
        }
      });
      test('passes', async () => {
        await test.step('passing step', async () => {});
        console.log('LATER TEST STARTED');
        while (!fs.existsSync('finish'))
          await new Promise(resolve => setTimeout(resolve, 10));
      });
    `,
  }, { workers: 1 }, { PLAYWRIGHT_FORCE_TTY: '1', PLAYWRIGHT_FAILURES_OMIT_TAGS: 'false' });

  await runner.waitForOutput('RETRY STARTED');
  const liveOutput = stripAnsi(runner.output);
  expect(liveOutput).toContain('partial stdout\n  1) ');
  expect(liveOutput).toContain('Test timeout of 500ms exceeded.');
  expect(liveOutput.indexOf('Test timeout of 500ms exceeded.')).toBeLessThan(liveOutput.indexOf('RETRY STARTED'));
  fs.writeFileSync(testInfo.outputPath('continue'), '');

  await runner.waitForOutput('LATER TEST STARTED');
  const retryOutput = stripAnsi(runner.output);
  expect(retryOutput).toContain('Passed on retry #1');
  expect(retryOutput.indexOf('Passed on retry #1')).toBeLessThan(retryOutput.indexOf('LATER TEST STARTED'));
  fs.writeFileSync(testInfo.outputPath('finish'), '');

  expect((await runner.exited).exitCode).toBe(0);
  const output = stripAnsi(runner.output);
  expect(output.match(/^    Test timeout of 500ms exceeded\./gm)).toHaveLength(1);
  expect(output.match(/^    Passed on retry #1 /gm)).toHaveLength(1);
  const titleLines = output.split('\n').filter(line => line.startsWith('  1) '));
  expect(titleLines).toHaveLength(2);
  for (const line of titleLines)
    expect(line).toContain('@tag');
  expect(output).toContain('1 flaky');
  expect(output).toContain('1 passed');
  expect(output).not.toContain('passing step');
  expect(output).not.toMatch(/^\s*(?:✓|ok|✘|x|-)\s+\d+ /m);
  expect(runner.output).not.toContain('\u001B[1A');
  expect(runner.output).not.toContain('\u001B[2K');
});

test('--reporter-only-failures does not filter --list', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        reporter: [['failures'], ['json', { onlyFailures: true, outputFile: 'report.json' }]],
      };
    `,
    'a.test.ts': passingTest,
  }, { 'list': true, 'reporter-only-failures': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('Listing tests:');
  expect(result.output).toContain('› passes');
  const report: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('report.json'), 'utf8'));
  expect(jsonTestSpecs(report.suites).map(spec => spec.title)).toEqual(['passes']);
});

function jsonTestSpecs(suites: JSONReportSuite[]): JSONReportSpec[] {
  return suites.flatMap(suite => [
    ...suite.specs,
    ...jsonTestSpecs(suite.suites || []),
  ]);
}

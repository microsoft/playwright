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

import type { HTMLReport } from '../../packages/html-reporter/src/types';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';

const passingTest = `
  import { test } from '@playwright/test';
  test('passes', async () => {
    await test.step('passing step', async () => {});
  });
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

for (const reporter of ['list', 'line', 'dot']) {
  test(`--reporter-only-failures overrides ${reporter} configuration`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default { reporter: [['${reporter}', { onlyFailures: false }]] };
      `,
      'a.test.ts': passingTest,
    }, { 'reporter-only-failures': true }, {
      [`PLAYWRIGHT_${reporter.toUpperCase()}_ONLY_FAILURES`]: undefined,
      PLAYWRIGHT_FORCE_TTY: '1',
    });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/^\n?  1 passed \([^)]+\)\n$/);
    expect(result.rawOutput).not.toContain('\u001B[1A');
    expect(result.rawOutput).not.toContain('\u001B[2K');
  });

  for (const onlyFailures of [false, true]) {
    test(`${reporter} onlyFailures environment overrides ${onlyFailures ? 'configuration' : 'CLI'}`, async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          export default { reporter: [['${reporter}', { onlyFailures: ${!onlyFailures} }]] };
        `,
        'a.test.ts': passingTest,
      }, onlyFailures ? {} : { 'reporter-only-failures': true }, { [`PLAYWRIGHT_${reporter.toUpperCase()}_ONLY_FAILURES`]: String(onlyFailures) });
      expect(result.exitCode).toBe(0);
      expect(result.passed).toBe(1);
      expect(result.output.includes('Running 1 test using')).toBe(!onlyFailures);
      expect(result.output.includes(reporter === 'dot' ? '·' : '› passes')).toBe(!onlyFailures);
    });
  }

  for (const omitTags of [false, true]) {
    test(`${reporter} onlyFailures respects omitTags environment override ${omitTags}`, async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          export default { reporter: [['${reporter}', { onlyFailures: true, omitTags: ${!omitTags} }]] };
        `,
        'a.test.ts': `
          import { test } from '@playwright/test';
          test('fails', { tag: '@tag' }, () => {
            throw new Error('failure');
          });
        `,
      }, {}, { [`PLAYWRIGHT_${reporter.toUpperCase()}_OMIT_TAGS`]: String(omitTags) });
      expect(result.exitCode).toBe(1);
      const titleLines = result.output.split('\n').filter(line => line.includes('› fails'));
      expect(titleLines.length).toBeGreaterThan(0);
      for (const line of titleLines)
        expect(line.includes('@tag')).toBe(!omitTags);
    });
  }
}

for (const fullyParallel of [false, true]) {
  test(`onlyFailures preserves timing with fullyParallel=${fullyParallel}`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default {
          reporter: [['list', { onlyFailures: true }]],
          fullyParallel: ${fullyParallel},
          reportSlowTests: { max: 1, threshold: ${fullyParallel ? 1 : 300} },
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
    expect(result.output.includes('Slow test file: a.test.ts')).toBe(!fullyParallel);
  });
}

for (const tty of ['0', '1']) {
  test(`onlyFailures prints only the summary for successful tests with TTY=${tty}`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default { reporter: [['list', { onlyFailures: true }]] };
      `,
      'a.test.ts': passingTest + `
        test.skip('skipped', () => {});
        test('expected failure', () => {
          test.fail();
          throw new Error('expected failure');
        });
      `,
    }, {}, { PLAYWRIGHT_FORCE_TTY: tty });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/^  1 skipped\n  2 passed \([^)]+\)\n$/);
    expect(result.rawOutput).not.toContain('\u001B[1A');
  });
}

for (const useIntermediateMergeReport of [false, true]) {
  test.describe(useIntermediateMergeReport ? 'merged stdio' : 'live stdio', () => {
    test.use({ useIntermediateMergeReport });

    for (const quiet of [false, true]) {
      test(`onlyFailures preserves quiet=${quiet}`, async ({ runInlineTest }) => {
        const result = await runInlineTest({
          'playwright.config.ts': `
            export default { reporter: [['list', { onlyFailures: true }]], quiet: ${quiet} };
          `,
          'a.test.ts': `
            import { test } from '@playwright/test';
            test('passes', () => {
              process.stdout.write('test stdout');
              process.stderr.write('test stderr');
            });
          `,
        });
        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(1);
        expect(result.output.includes('test stdout')).toBe(!quiet);
        expect(result.output.includes('test stderr')).toBe(!quiet);
      });
    }
  });
}

test('onlyFailures preserves errors outside tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { reporter: [['list', { onlyFailures: true }]], globalTeardown: './global-teardown.ts' };
    `,
    'global-teardown.ts': `
      export default () => {
        throw new Error('global teardown failed');
      };
    `,
    'a.test.ts': passingTest,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('Error: global teardown failed');
  expect(result.output).toContain('1 error was not a part of any test');
  expect(result.output).not.toContain('Running 1 test using');
});

test('onlyFailures prints timeout details for each attempt', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { reporter: [['list', { onlyFailures: true }]], retries: 1 };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('times out', async () => {
        test.setTimeout(500);
        await new Promise(() => {});
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output.match(/^    Test timeout of 500ms exceeded\./gm)).toHaveLength(2);
  expect(result.output).toContain('Retry #1');
});

for (const ci of [undefined, 'true']) {
  test(`--reporter-only-failures works with the default reporter on CI=${ci}`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.ts': passingTest,
    }, { 'reporter-only-failures': true }, { CI: ci });
    expect(result.exitCode).toBe(0);
    expect(result.output).toMatch(/^\n?  1 passed \([^)]+\)\n$/);
  });
}

test('--reporter-only-failures applies to added and fallback reporters', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      export default { reporter: [['json', { outputFile: 'report.json' }]] };
    `,
    'a.test.ts': passingTest,
  };
  const env = { PLAYWRIGHT_LINE_ONLY_FAILURES: undefined, PLAYWRIGHT_DOT_ONLY_FAILURES: undefined, PLAYWRIGHT_LIST_ONLY_FAILURES: undefined };
  const fallback = await runInlineTest(files, { 'reporter-only-failures': true }, env);
  expect(fallback.exitCode).toBe(0);
  expect(fallback.output).toMatch(/^  1 passed \([^)]+\)\n$/);
  const added = await runInlineTest(files, { 'reporter-only-failures': true, 'add-reporter': 'list' }, env);
  expect(added.exitCode).toBe(0);
  expect(added.output).toMatch(/^  1 passed \([^)]+\)\n$/);
});

test('onlyFailures can be configured independently for each reporter', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      export default {
        retries: 1,
        reporter: [
          ['list', { onlyFailures: true }],
          ['json', { onlyFailures: true, outputFile: 'failures.json' }],
          ['json', { outputFile: 'complete.json' }],
        ],
      };
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain('passing.test.ts');
  expect(result.passed).toBe(2);
  const failures: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('failures.json'), 'utf8'));
  const complete: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('complete.json'), 'utf8'));
  expect(jsonTestTitles(failures.suites).sort()).toEqual(['fails', 'flaky', 'unexpectedly passes']);
  expect(jsonTestTitles(complete.suites).sort()).toEqual(['expected failure', 'fails', 'flaky', 'passes', 'skipped', 'unexpectedly passes']);
});

for (const merge of [false, true]) {
  test(`--reporter-only-failures filters final reports and preserves blobs when ${merge ? 'merging' : 'running'}`, async ({ runInlineTest, mergeReports }, testInfo) => {
    const result = await runInlineTest({
      ...testFiles,
      'playwright.config.ts': `
        export default {
          retries: 1,
          reporter: [
            ['list'],
            ['github'],
            ['null'],
            ['json', { outputFile: 'report.json' }],
            ['junit', { outputFile: 'report.xml' }],
            ['html', { open: 'never' }],
            ['blob', { outputDir: 'complete-blob-report' }],
            ['perfetto', { outputFile: 'perfetto.json' }],
            ['./integrity-reporter.ts'],
          ],
        };
      `,
      'integrity-reporter.ts': `
        export default class {
          onBegin(config, suite) {
            this.suite = suite;
            console.log('%%begin: ' + suite.allTests().length);
          }
          onEnd() {
            console.log('%%end: ' + this.suite.allTests().length);
          }
        }
      `,
    }, merge ? { reporter: 'blob', workers: 1 } : { 'reporter-only-failures': true, 'workers': 1 });
    expect(result.exitCode).toBe(1);
    let output = result.output;
    if (merge) {
      const merged = await mergeReports(testInfo.outputPath('blob-report'), {}, {
        cwd: testInfo.outputPath(),
        additionalArgs: ['--config', testInfo.outputPath('playwright.config.ts'), '--reporter-only-failures'],
      });
      expect(merged.exitCode).toBe(0);
      output = stripAnsi(merged.output);
    }
    expect(output).toContain('2 passed');
    expect(output).toContain('2 failed');
    expect(output).toContain('1 flaky');
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
    expect(fs.existsSync(testInfo.outputPath('passing-ran.txt'))).toBe(true);

    const titles = ['fails', 'flaky', 'unexpectedly passes'];
    const json: JSONReport = JSON.parse(fs.readFileSync(testInfo.outputPath('report.json'), 'utf8'));
    expect(jsonTestTitles(json.suites).sort()).toEqual(titles);
    expect(json.stats).toMatchObject({ expected: 0, skipped: 0, unexpected: 2, flaky: 1 });

    const xml = await xml2js.parseStringPromise(fs.readFileSync(testInfo.outputPath('report.xml'), 'utf8'));
    expect(xml.testsuites.$.tests).toBe('3');
    expect(xml.testsuites.testsuite).toHaveLength(1);
    expect(xml.testsuites.testsuite[0].testcase.map((entry: { $: { name: string } }) => entry.$.name).sort()).toEqual(titles.map(title => `failures › ${title}`));

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

    const trace: { traceEvents: { cat: string, name: string }[] } = JSON.parse(fs.readFileSync(testInfo.outputPath('perfetto.json'), 'utf8'));
    expect([...new Set(trace.traceEvents.filter(event => event.cat === 'test').map(event => event.name))].sort()).toEqual(titles);

    const blobDir = testInfo.outputPath('complete-blob-report');
    const blobFile = fs.readdirSync(blobDir).find(file => file.endsWith('.zip'))!;
    const extractedBlob = testInfo.outputPath('extracted-blob');
    await extractZip(path.join(blobDir, blobFile), { dir: extractedBlob });
    const messages = fs.readFileSync(path.join(extractedBlob, 'report.jsonl'), 'utf8');
    expect(messages).toContain('passing.test.ts');
    for (const title of [...titles, 'passes', 'skipped', 'expected failure'])
      expect(messages).toContain(`"title":"${title}"`);
    const resources = fs.readdirSync(path.join(extractedBlob, 'resources'));
    const attachments = resources.filter(resource => resource.endsWith('.txt')).map(resource => fs.readFileSync(path.join(extractedBlob, 'resources', resource), 'utf8'));
    expect(attachments.sort()).toEqual(['failure attachment', 'failure attachment', 'passing attachment']);

    const replay = await mergeReports(blobDir, {}, { additionalArgs: ['--reporter=dot'] });
    expect(replay.exitCode).toBe(0);
    expect(replay.output).toContain('2 failed');
    expect(replay.output).toContain('1 flaky');
    expect(replay.output).toContain('2 passed');
    expect(replay.output).toContain('1 skipped');

    const filteredReplay = await mergeReports(blobDir, {}, { additionalArgs: ['--reporter=list', '--reporter-only-failures'] });
    expect(filteredReplay.exitCode).toBe(0);
    expect(filteredReplay.output).toContain('2 failed');
    expect(filteredReplay.output).toContain('1 flaky');
    expect(filteredReplay.output).toContain('2 passed');
    expect(filteredReplay.output).not.toContain('passing.test.ts');
  });
}

test('onlyFailures overrides inline and step output options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        reporter: [['list', { onlyFailures: true, printFailuresInline: false, printSteps: true }]],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('fails', () => {
        throw new Error('failure');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      test('passes', async () => {
        await test.step('passing step', async () => {});
        console.log('LATER OUTPUT');
      });
    `,
  }, { workers: 1 }, { PLAYWRIGHT_FORCE_TTY: '1', PLAYWRIGHT_LIST_PRINT_FAILURES_INLINE: '0' });
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain('passing step');
  expect(result.output.match(/^    Error: failure$/gm)).toHaveLength(1);
  expect(result.output.indexOf('Error: failure')).toBeLessThan(result.output.indexOf('LATER OUTPUT'));
  expect(result.output).not.toMatch(/^\s*(?:✓|ok|✘|x|-)\s+\d+ /m);
});

for (const tty of ['0', '1']) {
  test(`onlyFailures prints each failed attempt before retry completes with TTY=${tty}`, async ({ interactWithTestRunner }, testInfo) => {
    const runner = await interactWithTestRunner({
      'playwright.config.ts': `
        export default { reporter: [['list', { onlyFailures: true }]], retries: 1 };
      `,
      'a.test.ts': `
        import fs from 'fs';
        import { test } from '@playwright/test';
        test('fails', async ({}, testInfo) => {
          if (testInfo.retry) {
            console.log('RETRY STARTED');
            while (!fs.existsSync('continue'))
              await new Promise(resolve => setTimeout(resolve, 10));
          }
          throw new Error('attempt ' + testInfo.retry);
        });
        test('passes', () => {});
      `,
    }, { workers: 1 }, { PLAYWRIGHT_FORCE_TTY: tty });

    await runner.waitForOutput('RETRY STARTED');
    const liveOutput = stripAnsi(runner.output);
    expect(liveOutput).toContain('Error: attempt 0');
    expect(liveOutput.indexOf('Error: attempt 0')).toBeLessThan(liveOutput.indexOf('RETRY STARTED'));
    fs.writeFileSync(testInfo.outputPath('continue'), '');

    expect((await runner.exited).exitCode).toBe(1);
    const output = stripAnsi(runner.output);
    expect(output.match(/^    Error: attempt 0$/gm)).toHaveLength(1);
    expect(output.match(/^    Error: attempt 1$/gm)).toHaveLength(1);
    expect(output.match(/^  1\) /gm)).toHaveLength(2);
    expect(output).toContain('Retry #1');
    expect(output).toContain('1 failed');
    expect(output).toContain('1 passed');
    expect(runner.output).not.toContain('\u001B[1A');
    expect(runner.output).not.toContain('\u001B[2K');
  });
}

test('onlyFailures preserves pause diagnostics and errors during teardown', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No SIGINT on Windows');
  const runner = await interactWithTestRunner({
    'playwright.config.ts': `
      export default { reporter: [['list', { onlyFailures: true }]] };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('fails', () => {
        throw new Error('initial failure');
      });
      test.afterEach(() => {
        throw new Error('teardown failure');
      });
    `,
  }, {}, { PW_TEST_DEBUG_REPORTERS: '1', PWPAUSE: '1' });
  await runner.waitForOutput('Paused on error. Press Ctrl+C to end.');
  expect(stripAnsi(runner.output)).toContain('Error: initial failure');
  expect((await runner.kill('SIGINT')).exitCode).toBe(130);
  const output = stripAnsi(runner.output);
  expect(output.match(/^    Error: initial failure$/gm)).toHaveLength(1);
  expect(output.match(/^    Error: teardown failure$/gm)).toHaveLength(1);
  expect(output).toContain('1 failed');
  expect(output).not.toContain('Running 1 test');
  expect(runner.output).not.toContain('\u001B[1A');
});

test('onlyFailures reports interruptions after pausing at test end', async ({ interactWithTestRunner }) => {
  test.skip(process.platform === 'win32', 'No SIGINT on Windows');
  const runner = await interactWithTestRunner({
    'playwright.config.ts': `
      export default { reporter: [['line', { onlyFailures: true }]] };
    `,
    'a.test.ts': passingTest,
  }, {}, { PW_TEST_DEBUG_REPORTERS: '1', PWPAUSE: '1' });
  await runner.waitForOutput('Paused at test end. Press Ctrl+C to end.');
  expect((await runner.kill('SIGINT')).exitCode).toBe(130);
  const output = stripAnsi(runner.output);
  expect(output.match(/^    Test was interrupted\.$/gm)).toHaveLength(1);
  expect(output).toContain('1 interrupted');
  expect(output).not.toContain('Running 1 test');
  expect(runner.output).not.toContain('\u001B[1A');
});

for (const reporter of ['list', 'json']) {
  test(`--reporter-only-failures does not filter --list with ${reporter}`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default { reporter: [['${reporter}', { onlyFailures: true }]] };
      `,
      'a.test.ts': passingTest,
    }, { 'list': true, 'reporter-only-failures': true });
    expect(result.exitCode).toBe(0);
    expect(jsonTestTitles(result.report.suites)).toEqual(['passes']);
  });
}

test('--reporter-only-failures exposes the mode without filtering custom reporter callbacks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { reporter: [['./reporter.ts', { onlyFailures: false }]] };
    `,
    'reporter.ts': `
      import type { ReporterOptions } from '@playwright/test/reporter';
      export default class {
        constructor(options: ReporterOptions) {
          console.log('%%onlyFailures: ' + options.onlyFailures);
        }
        onBegin(config, suite) {
          console.log('%%' + suite.allTests().length);
        }
        onTestBegin(test) {
          console.log('%%begin: ' + test.title);
        }
        onTestEnd(test) {
          console.log('%%end: ' + test.title);
        }
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('passes', () => {});
    `,
  }, { 'reporter-only-failures': true });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual(['onlyFailures: true', '1', 'begin: passes', 'end: passes']);
});

function jsonTestTitles(suites: JSONReportSuite[]): string[] {
  return suites.flatMap(suite => [
    ...suite.specs.map(spec => spec.title),
    ...jsonTestTitles(suite.suites || []),
  ]);
}

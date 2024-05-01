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

import xml2js from 'xml2js';
import path from 'path';
import { test, expect } from './playwright-test-fixtures';
import fs from 'fs';

for (const useIntermediateMergeReport of [false, true] as const) {
  test.describe(`${useIntermediateMergeReport ? 'merged' : 'created'}`, () => {
    test.use({ useIntermediateMergeReport });

    test('should render expected', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            expect(1).toBe(1);
          });
        `,
        'b.test.js': `
          import { test, expect } from '@playwright/test';
          test('two', async ({}) => {
            expect(1).toBe(1);
          });
        `,
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      expect(xml['testsuites']['$']['tests']).toBe('2');
      expect(xml['testsuites']['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'].length).toBe(2);
      expect(xml['testsuites']['testsuite'][0]['$']['name']).toBe('a.test.js');
      expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('1');
      expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('0');
      expect(xml['testsuites']['testsuite'][1]['$']['name']).toBe('b.test.js');
      expect(result.exitCode).toBe(0);
    });

    test('should render unexpected', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            expect(1).toBe(0);
          });
        `,
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      expect(xml['testsuites']['$']['tests']).toBe('1');
      expect(xml['testsuites']['$']['failures']).toBe('1');
      const failure = xml['testsuites']['testsuite'][0]['testcase'][0]['failure'][0];
      expect(failure['$']['message']).toContain('a.test.js');
      expect(failure['$']['message']).toContain('one');
      expect(failure['$']['type']).toBe('FAILURE');
      expect(failure['_']).toContain('expect(1).toBe(0)');
      expect(result.exitCode).toBe(1);
    });

    test('should render unexpected after retry', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            expect(1).toBe(0);
          });
        `,
      }, { retries: 3, reporter: 'junit' });
      expect(result.output).toContain(`tests="1"`);
      expect(result.output).toContain(`failures="1"`);
      expect(result.output).toContain(`<failure`);
      expect(result.output).toContain('Retry #1');
      expect(result.output).toContain('Retry #2');
      expect(result.output).toContain('Retry #3');
      expect(result.exitCode).toBe(1);
    });

    test('should render flaky', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(3);
          });
        `,
      }, { retries: 3, reporter: 'junit' });
      expect(result.output).not.toContain('Retry #1');
      expect(result.exitCode).toBe(0);
    });

    test('should render stdout', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import colors from 'colors/safe';
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            console.log(colors.yellow('Hello world'));
            console.log('Hello again');
            console.error('My error');
            console.error('\\0'); // null control character
            test.expect("abc").toBe('abcd');
          });
        `,
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['system-out'].length).toBe(1);
      expect(testcase['system-out'][0]).toContain('[33mHello world[39m\nHello again');
      expect(testcase['system-out'][0]).not.toContain('u00');
      expect(testcase['system-err'][0]).toContain('My error');
      expect(testcase['system-err'][0]).not.toContain('\u0000'); // null control character
      expect(testcase['failure'][0]['_']).toContain(`>  9 |             test.expect("abc").toBe('abcd');`);
      expect(result.exitCode).toBe(1);
    });

    test('should render stdout without ansi escapes', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reporter: [ ['junit', { stripANSIControlSequences: true }] ],
          };
        `,
        'a.test.ts': `
          import colors from 'colors/safe';
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            console.log(colors.yellow('Hello world'));
          });
        `,
      }, { reporter: '' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['system-out'].length).toBe(1);
      expect(testcase['system-out'][0].trim()).toBe('Hello world');
      expect(result.exitCode).toBe(0);
    });

    test('should render, by default, character data as CDATA sections', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            reporter: [ ['junit'] ],
          };
        `,
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            process.stdout.write('Hello world &"\\'<>]]>');
          });
        `,
      }, { reporter: '' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['system-out'].length).toBe(1);
      expect(testcase['system-out'][0].trim()).toBe('Hello world &"\'<>]]&gt;');
      expect(result.output).toContain(`<system-out>\n<![CDATA[Hello world &"\'<>]]&gt;]]>\n</system-out>`);
      expect(result.exitCode).toBe(0);
    });

    test('should render skipped', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async () => {
            console.log('Hello world');
          });
          test('two', async () => {
            test.skip();
            console.log('Hello world');
          });
        `,
      }, { retries: 3, reporter: 'junit' });
      const xml = parseXML(result.output);
      expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('2');
      expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('1');
      expect(result.exitCode).toBe(0);
    });

    test('should report skipped due to sharding', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async () => {
          });
          test('two', async () => {
            test.skip();
          });
        `,
        'b.test.js': `
          import { test, expect } from '@playwright/test';
          test('three', async () => {
          });
          test('four', async () => {
            test.skip();
          });
          test('five', async () => {
          });
        `,
      }, { shard: '1/3', reporter: 'junit' });
      const xml = parseXML(result.output);
      expect(xml['testsuites']['testsuite'].length).toBe(1);
      expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('2');
      expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('1');
      expect(result.exitCode).toBe(0);
    });

    test('should not render projects if they dont exist', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            expect(1).toBe(1);
          });
        `,
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      expect(xml['testsuites']['$']['tests']).toBe('1');
      expect(xml['testsuites']['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'].length).toBe(1);

      expect(xml['testsuites']['testsuite'][0]['$']['name']).toBe('a.test.js');
      expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('1');
      expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['name']).toBe('one');
      expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['classname']).toBe('a.test.js');
      expect(result.exitCode).toBe(0);
    });

    test('should render projects', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = { projects: [ { name: 'project1' }, { name: 'project2' } ] };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            expect(1).toBe(1);
          });
        `,
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      expect(xml['testsuites']['$']['tests']).toBe('2');
      expect(xml['testsuites']['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'].length).toBe(2);

      expect(xml['testsuites']['testsuite'][0]['$']['name']).toBe('a.test.js');
      expect(xml['testsuites']['testsuite'][0]['$']['hostname']).toBe('project1');
      expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('1');
      expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('0');
      expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['name']).toBe('one');
      expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['classname']).toBe('a.test.js');

      expect(xml['testsuites']['testsuite'][1]['$']['name']).toBe('a.test.js');
      expect(xml['testsuites']['testsuite'][1]['$']['hostname']).toBe('project2');
      expect(xml['testsuites']['testsuite'][1]['$']['tests']).toBe('1');
      expect(xml['testsuites']['testsuite'][1]['$']['failures']).toBe('0');
      expect(xml['testsuites']['testsuite'][1]['$']['skipped']).toBe('0');
      expect(xml['testsuites']['testsuite'][1]['testcase'][0]['$']['name']).toBe('one');
      expect(xml['testsuites']['testsuite'][1]['testcase'][0]['$']['classname']).toBe('a.test.js');
      expect(result.exitCode).toBe(0);
    });

    test('should includeProjectInTestName', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          module.exports = {
            projects: [ { name: 'project1' }, { name: 'project2' } ],
            reporter: [['junit', { includeProjectInTestName: true }]]
          };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            expect(1).toBe(1);
          });
        `,
      }, { reporter: '' });
      expect(result.exitCode).toBe(0);
      const xml = parseXML(result.output);
      expect(xml['testsuites']['testsuite'][0]['$']['name']).toBe('a.test.js');
      expect(xml['testsuites']['testsuite'][0]['$']['hostname']).toBe('project1');
      expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('1');
      expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['name']).toBe('[project1] one');
      expect(xml['testsuites']['testsuite'][1]['$']['name']).toBe('a.test.js');
      expect(xml['testsuites']['testsuite'][1]['$']['hostname']).toBe('project2');
      expect(xml['testsuites']['testsuite'][1]['$']['tests']).toBe('1');
      expect(xml['testsuites']['testsuite'][1]['testcase'][0]['$']['name']).toBe('[project2] one');
    });

    test('should render existing attachments, but not missing ones', async ({ runInlineTest }) => {
      test.skip(useIntermediateMergeReport, 'Blob report hashes attachment paths');
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test.use({ screenshot: 'on' });
          test('one', async ({ page }, testInfo) => {
            await page.setContent('hello');
            const file = testInfo.outputPath('file.txt');
            require('fs').writeFileSync(file, 'my file', 'utf8');
            testInfo.attachments.push({ name: 'my-file', path: file, contentType: 'text/plain' });
            testInfo.attachments.push({ name: 'my-file-missing', path: file + '-missing', contentType: 'text/plain' });
            console.log('log here');
          });
        `,
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['system-out'].length).toBe(1);
      expect(testcase['system-out'][0].trim()).toBe([
        `log here`,
        `\n[[ATTACHMENT|test-results${path.sep}a-one${path.sep}file.txt]]`,
        `\n[[ATTACHMENT|test-results${path.sep}a-one${path.sep}test-finished-1.png]]`,
      ].join('\n'));
      expect(result.exitCode).toBe(0);
    });

    test('should render attachment paths relative to report file when report file name is specified', async ({ runInlineTest }, testInfo) => {
      test.skip(useIntermediateMergeReport, 'Blob report hashes attachment paths');
      const result = await runInlineTest({
        'project/playwright.config.ts': `
            module.exports = { reporter: [['junit', { outputFile: '../my-report/junit/a.xml' }]] };
        `,
        'project/a.test.js': `
          import { test, expect } from '@playwright/test';
          test.use({ screenshot: 'on' });
          test('one', async ({ page }, testInfo) => {
            await page.setContent('hello');
            const file = testInfo.outputPath('file.txt');
            require('fs').writeFileSync(file, 'my file', 'utf8');
            testInfo.attachments.push({ name: 'my-file', path: file, contentType: 'text/plain' });
            console.log('log here');
          });
        `,
      }, { reporter: '', config: './project/playwright.config.ts' });

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(testInfo.outputPath(path.join('my-report', 'junit', 'a.xml')))).toBeTruthy();
      const xml = parseXML(fs.readFileSync(testInfo.outputPath(path.join('my-report', 'junit', 'a.xml'))).toString());
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['system-out'].length).toBe(1);
      expect(testcase['system-out'][0].trim()).toBe([
        `log here`,
        `\n[[ATTACHMENT|..${path.sep}..${path.sep}test-results${path.sep}a-one${path.sep}file.txt]]`,
        `\n[[ATTACHMENT|..${path.sep}..${path.sep}test-results${path.sep}a-one${path.sep}test-finished-1.png]]`,
      ].join('\n'));
      expect(result.exitCode).toBe(0);
    });

    function parseXML(xml: string): any {
      let result: any;
      xml2js.parseString(xml, (err, r) => result = r);
      return result;
    }

    test('should render annotations to custom testcase properties', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `module.exports = { reporter: 'junit' };`,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            testInfo.annotations.push({ type: 'test_description', description: 'sample description' });
          });
        `
      }, { reporter: '' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['properties']).toBeTruthy();
      expect(testcase['properties'][0]['property'].length).toBe(1);
      expect(testcase['properties'][0]['property'][0]['$']['name']).toBe('test_description');
      expect(testcase['properties'][0]['property'][0]['$']['value']).toBe('sample description');
      expect(result.exitCode).toBe(0);
    });

    test('should render built-in annotations to testcase properties', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `module.exports = { reporter: 'junit' };`,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            test.slow();
          });
        `
      }, { reporter: '' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['properties']).toBeTruthy();
      expect(testcase['properties'][0]['property'].length).toBe(1);
      expect(testcase['properties'][0]['property'][0]['$']['name']).toBe('slow');
      expect(testcase['properties'][0]['property'][0]['$']['value']).toBe('');
      expect(result.exitCode).toBe(0);
    });

    test('should render all annotations to testcase value based properties, if requested', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          const xrayOptions = {
            embedAnnotationsAsProperties: true
          }
          module.exports = {
            reporter: [ ['junit', xrayOptions] ],
          };
        `,
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            testInfo.annotations.push({ type: 'test_id', description: '1234' });
            testInfo.annotations.push({ type: 'test_key', description: 'CALC-2' });
            testInfo.annotations.push({ type: 'test_summary', description: 'sample summary' });
            testInfo.annotations.push({ type: 'requirements', description: 'CALC-5,CALC-6' });
          });
        `
      }, { reporter: '' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['properties']).toBeTruthy();
      expect(testcase['properties'][0]['property'].length).toBe(4);
      expect(testcase['properties'][0]['property'][0]['$']['name']).toBe('test_id');
      expect(testcase['properties'][0]['property'][0]['$']['value']).toBe('1234');
      expect(testcase['properties'][0]['property'][1]['$']['name']).toBe('test_key');
      expect(testcase['properties'][0]['property'][1]['$']['value']).toBe('CALC-2');
      expect(testcase['properties'][0]['property'][2]['$']['name']).toBe('test_summary');
      expect(testcase['properties'][0]['property'][2]['$']['value']).toBe('sample summary');
      expect(testcase['properties'][0]['property'][3]['$']['name']).toBe('requirements');
      expect(testcase['properties'][0]['property'][3]['$']['value']).toBe('CALC-5,CALC-6');
      expect(result.exitCode).toBe(0);
    });

    test('should not embed attachments to a custom testcase property, if not explicitly requested', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            const file = testInfo.outputPath('evidence1.txt');
            require('fs').writeFileSync(file, 'hello', 'utf8');
            testInfo.attachments.push({ name: 'evidence1.txt', path: file, contentType: 'text/plain' });
            testInfo.attachments.push({ name: 'evidence2.txt', body: Buffer.from('world'), contentType: 'text/plain' });
            // await testInfo.attach('evidence1.txt', { path: file, contentType: 'text/plain' });
            // await testInfo.attach('evidence2.txt', { body: Buffer.from('world'), contentType: 'text/plain' });
          });
        `
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      const testcase = xml['testsuites']['testsuite'][0]['testcase'][0];
      expect(testcase['properties']).not.toBeTruthy();
      expect(result.exitCode).toBe(0);
    });


    test.describe('report location', () => {
      test('with config should create report relative to config', async ({ runInlineTest }, testInfo) => {
        test.skip(useIntermediateMergeReport);
        const result = await runInlineTest({
          'nested/project/playwright.config.ts': `
            module.exports = { reporter: [['junit', { outputFile: '../my-report/a.xml' }]] };
          `,
          'nested/project/a.test.js': `
            import { test, expect } from '@playwright/test';
            test('one', async ({}) => {
              expect(1).toBe(1);
            });
          `,
        }, { reporter: '', config: './nested/project/playwright.config.ts' });
        expect(result.exitCode).toBe(0);
        expect(fs.existsSync(testInfo.outputPath(path.join('nested', 'my-report', 'a.xml')))).toBeTruthy();
      });

      test('with env var should create relative to cwd', async ({ runInlineTest }, testInfo) => {
        const result = await runInlineTest({
          'foo/package.json': `{ "name": "foo" }`,
          // unused config along "search path"
          'foo/bar/playwright.config.js': `
            module.exports = { projects: [ {} ] };
          `,
          'foo/bar/baz/tests/a.spec.js': `
            import { test, expect } from '@playwright/test';
            const fs = require('fs');
            test('pass', ({}, testInfo) => {
            });
          `
        }, { 'reporter': 'junit,line' }, { 'PLAYWRIGHT_JUNIT_OUTPUT_NAME': '../my-report.xml' }, {
          cwd: 'foo/bar/baz/tests',
        });
        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(1);
        expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report.xml'))).toBe(true);
      });

      test('support PLAYWRIGHT_JUNIT_OUTPUT_FILE', async ({ runInlineTest }, testInfo) => {
        const result = await runInlineTest({
          'foo/package.json': `{ "name": "foo" }`,
          // unused config along "search path"
          'foo/bar/playwright.config.js': `
            module.exports = { projects: [ {} ] };
          `,
          'foo/bar/baz/tests/a.spec.js': `
            import { test, expect } from '@playwright/test';
            const fs = require('fs');
            test('pass', ({}, testInfo) => {
            });
          `
        }, { 'reporter': 'junit,line' }, { 'PLAYWRIGHT_JUNIT_OUTPUT_FILE': '../my-report.xml' }, {
          cwd: 'foo/bar/baz/tests',
        });
        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(1);
        expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report.xml'))).toBe(true);
      });

      test('support PLAYWRIGHT_JUNIT_OUTPUT_DIR and PLAYWRIGHT_JUNIT_OUTPUT_NAME', async ({ runInlineTest }, testInfo) => {
        const result = await runInlineTest({
          'playwright.config.js': `
            module.exports = { projects: [ {} ] };
          `,
          'tests/a.spec.js': `
            import { test, expect } from '@playwright/test';
            const fs = require('fs');
            test('pass', ({}, testInfo) => {
            });
          `
        }, { 'reporter': 'junit,line' }, { 'PLAYWRIGHT_JUNIT_OUTPUT_DIR': 'foo/bar', 'PLAYWRIGHT_JUNIT_OUTPUT_NAME': 'baz/my-report.xml' });
        expect(result.exitCode).toBe(0);
        expect(result.passed).toBe(1);
        expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'my-report.xml'))).toBe(true);
      });
    });

    test('testsuites time is test run wall time', async ({ runInlineTest }) => {
      test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/30518' });
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}) => {
            await new Promise(f => setTimeout(f, 1000));
          });
        `
      }, { reporter: 'junit' });
      const xml = parseXML(result.output);
      const time = +xml['testsuites']['$']['time'];
      expect(time).toBe(result.report.stats.duration / 1000);
      expect(time).toBeGreaterThan(1);
    });
  });
}
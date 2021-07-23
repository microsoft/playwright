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
import { test, expect } from './playwright-test-fixtures';

test('should render expected', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}) => {
        expect(1).toBe(1);
      });
    `,
    'b.test.js': `
      const { test } = pwt;
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
      const { test } = pwt;
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
      const { test } = pwt;
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
      const { test } = pwt;
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
      const { test } = pwt;
      test('one', async ({}) => {
        console.log(colors.yellow('Hello world'));
        test.expect("abc").toBe('abcd');
      });
    `,
  }, { reporter: 'junit' });
  const xml = parseXML(result.output);
  const suite = xml['testsuites']['testsuite'][0];
  expect(suite['system-out'].length).toBe(1);
  expect(suite['system-out'][0]).toContain('Hello world');
  expect(suite['system-out'][0]).not.toContain('u00');
  expect(suite['testcase'][0]['failure'][0]['_']).toContain(`>  9 |         test.expect("abc").toBe('abcd');`);
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
      const { test } = pwt;
      test('one', async ({}) => {
        console.log(colors.yellow('Hello world'));
      });
    `,
  }, { reporter: '' });
  const xml = parseXML(result.output);
  const suite = xml['testsuites']['testsuite'][0];
  expect(suite['system-out'].length).toBe(1);
  expect(suite['system-out'][0].trim()).toBe('Hello world');
  expect(result.exitCode).toBe(0);
});

test('should render skipped', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
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
  }, { shard: '1/3', reporter: 'junit' });
  const xml = parseXML(result.output);
  expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('2');
  expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
  expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('1');

  expect(xml['testsuites']['testsuite'][1]['$']['tests']).toBe('3');
  expect(xml['testsuites']['testsuite'][1]['$']['failures']).toBe('0');
  expect(xml['testsuites']['testsuite'][1]['$']['skipped']).toBe('3');
  expect(result.exitCode).toBe(0);
});


test('should render projects', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [ { name: 'project1' }, { name: 'project2' } ] };
    `,
    'a.test.js': `
      const { test } = pwt;
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
  expect(xml['testsuites']['testsuite'][0]['$']['tests']).toBe('1');
  expect(xml['testsuites']['testsuite'][0]['$']['failures']).toBe('0');
  expect(xml['testsuites']['testsuite'][0]['$']['skipped']).toBe('0');
  expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['name']).toBe('one');
  expect(xml['testsuites']['testsuite'][0]['testcase'][0]['$']['classname']).toContain('[project1] › a.test.js:6:7 › one');

  expect(xml['testsuites']['testsuite'][1]['$']['name']).toBe('a.test.js');
  expect(xml['testsuites']['testsuite'][1]['$']['tests']).toBe('1');
  expect(xml['testsuites']['testsuite'][1]['$']['failures']).toBe('0');
  expect(xml['testsuites']['testsuite'][1]['$']['skipped']).toBe('0');
  expect(xml['testsuites']['testsuite'][1]['testcase'][0]['$']['name']).toBe('one');
  expect(xml['testsuites']['testsuite'][1]['testcase'][0]['$']['classname']).toContain('[project2] › a.test.js:6:7 › one');
  expect(result.exitCode).toBe(0);
});

function parseXML(xml: string): any {
  let result: any;
  xml2js.parseString(xml, (err, r) => result = r);
  return result;
}

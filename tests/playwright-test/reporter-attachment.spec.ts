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

import { test, expect, stripAscii } from './playwright-test-fixtures';

test('render text attachment', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}, testInfo) => {
        testInfo.attachments.push({
          name: 'attachment',
          body: Buffer.from('Hello world'),
          contentType: 'text/plain'
        });
        expect(1).toBe(0);
      });
    `,
  }, { reporter: 'line' });
  const text = stripAscii(result.output);
  expect(text).toContain('    attachment #1: attachment (text/plain) ---------------------------------------------------------');
  expect(text).toContain('    Hello world');
  expect(text).toContain('    ------------------------------------------------------------------------------------------------');
  expect(result.exitCode).toBe(1);
});

test('render screenshot attachment', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}, testInfo) => {
        testInfo.attachments.push({
          name: 'screenshot',
          path: testInfo.outputPath('some/path.png'),
          contentType: 'image/png'
        });
        expect(1).toBe(0);
      });
    `,
  }, { reporter: 'line' });
  const text = stripAscii(result.output).replace(/\\/g, '/');
  expect(text).toContain('    attachment #1: screenshot (image/png) ----------------------------------------------------------');
  expect(text).toContain('    test-results/a-one/some/path.png');
  expect(text).toContain('    ------------------------------------------------------------------------------------------------');
  expect(result.exitCode).toBe(1);
});

test('render trace attachment', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('one', async ({}, testInfo) => {
        testInfo.attachments.push({
          name: 'trace',
          path: testInfo.outputPath('trace.zip'),
          contentType: 'application/zip'
        });
        expect(1).toBe(0);
      });
    `,
  }, { reporter: 'line' });
  const text = stripAscii(result.output).replace(/\\/g, '/');
  expect(text).toContain('    attachment #1: trace (application/zip) ---------------------------------------------------------');
  expect(text).toContain('    test-results/a-one/trace.zip');
  expect(text).toContain('npx playwright show-trace test-results/a-one/trace.zip');
  expect(text).toContain('    ------------------------------------------------------------------------------------------------');
  expect(result.exitCode).toBe(1);
});


test(`testInfo.attach errors`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('fail1', async ({}, testInfo) => {
        await testInfo.attach('name', { path: 'foo.txt' });
      });
      test('fail2', async ({}, testInfo) => {
        await testInfo.attach('name', { path: 'foo.txt', body: 'bar' });
      });
      test('fail3', async ({}, testInfo) => {
        await testInfo.attach('name', {});
      });
    `,
  }, { reporter: 'line', workers: 1 });
  const text = stripAscii(result.output).replace(/\\/g, '/');
  expect(text).toMatch(/Error: ENOENT: no such file or directory, open '.*foo.txt.*'/);
  expect(text).toContain(`Exactly one of "path" and "body" must be specified`);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(3);
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach works in fixture`, async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      const fs = require('fs');
      const { test: _test } = pwt;
      const test = _test.extend({
        aFixture: async ({}, use, testInfo) => {
          const outFile = testInfo.outputPath('foo.txt');
          await fs.promises.writeFile(outFile, 'Hello world\\n');
          await use(10);
          await testInfo.attach('example.txt', {
            path: outFile,
          });
        }
      });

      test('working', ({ aFixture }) => {
        expect(aFixture).toBe(2);
      });
    `
  }, { reporter: 'line', workers: 1 });
  const text = stripAscii(result.output).replace(/\\/g, '/');
  expect(text).toContain('    attachment #1: example.txt (text/plain) --------------------------------------------------------');
  expect(text).toContain('    test-results/a-working/attachments/33ab5639bfd8e7b95eb1d8d0b87781d4ffea4d5d.txt');
  expect(text).toContain('    ------------------------------------------------------------------------------------------------');
  expect(result.failed).toBe(1);
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach doesn't hang fixture`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test: _test } = pwt;
      const test = _test.extend({
        aFixture: async ({}, use, testInfo) => {
          await use(10);
          await testInfo.attach('name', {
            path: 'foo.txt',
          });
        },
      });

      test('example', ({ aFixture }) => {
        expect(aFixture).toBe(10);
      });
    `
  }, { reporter: 'line', workers: 1 });
  const text = stripAscii(result.output).replace(/\\/g, '/');
  expect(text).toMatch(/Error: ENOENT: no such file or directory, open '.*foo.txt.*'/);
  expect(result.exitCode).toBe(1);
});

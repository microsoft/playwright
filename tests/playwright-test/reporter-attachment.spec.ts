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

for (const { description, apiCall } of [
  {
    description: 'all options specified',
    apiCall: `attach('non-existent-path', { contentType: 'text/plain', name: 'foo.txt'})`,
  },
  {
    description: 'no options specified',
    apiCall: `attach('non-existent-path')`,
  },
  {
    description: 'partial options - contentType',
    apiCall: `attach('non-existent-path', { contentType: 'text/plain'})`,
  },
  {
    description: 'partial options - name',
    apiCall: `attach('non-existent-path', { name: 'foo.txt'})`,
  },
]) {
  test(`testInfo.attach throws an error when attaching a non-existent - ${description}`, async ({ runInlineTest }) => {
    const result = await runInlineTest({
      'a.test.js': `
        const { test } = pwt;
        test('one', async ({}, testInfo) => {
          await testInfo.${apiCall};
        });
      `,
    }, { reporter: 'line' });
    const text = stripAscii(result.output).replace(/\\/g, '/');
    expect(text).toMatch(/Error: ENOENT: no such file or directory, open '.*non-existent-path.*'/);
    expect(result.exitCode).toBe(1);
  });
}

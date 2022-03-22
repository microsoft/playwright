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

import { test, expect, stripAnsi } from './playwright-test-fixtures';

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
  const text = stripAnsi(result.output);
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
  const text = stripAnsi(result.output).replace(/\\/g, '/');
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
  const text = stripAnsi(result.output).replace(/\\/g, '/');
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
  const text = stripAnsi(result.output).replace(/\\/g, '/');
  expect(text).toMatch(/Error: ENOENT: no such file or directory, copyfile '.*foo.txt.*'/);
  expect(text).toContain(`Exactly one of "path" and "body" must be specified`);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(3);
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach errors with empty path`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('fail', async ({}, testInfo) => {
        await testInfo.attach('name', { path: '' });
      });
    `,
  }, { reporter: 'line', workers: 1 });
  expect(stripAnsi(result.output)).toMatch(/Error: ENOENT: no such file or directory, copyfile ''/);
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach error in fixture`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        fixture: async ({}, use, testInfo) => {
          await use();
          await testInfo.attach('name', { path: 'foo.txt' });
        },
      });
      test('fail1', async ({ fixture }) => {
      });
    `,
  }, { reporter: 'line', workers: 1 });
  const text = stripAnsi(result.output).replace(/\\/g, '/');
  expect(text).toMatch(/Error: ENOENT: no such file or directory, copyfile '.*foo.txt.*'/);
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
});

test(`testInfo.attach success in fixture`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        fixture: async ({}, use, testInfo) => {
          const filePath = testInfo.outputPath('foo.txt');
          require('fs').writeFileSync(filePath, 'hello');
          await use();
          await testInfo.attach('name', { path: filePath });
        },
      });
      test('success', async ({ fixture }) => {
        expect(true).toBe(false);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(stripAnsi(result.output)).toContain('attachment #1: name (text/plain)');
});

test(`testInfo.attach allow empty string body`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('success', async ({}, testInfo) => {
        await testInfo.attach('name', { body: '', contentType: 'text/plain' });
        expect(0).toBe(1);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(stripAnsi(result.output)).toMatch(/^.*attachment #1: name \(text\/plain\).*\n.*\n.*------/gm);
});

test(`testInfo.attach allow empty buffer body`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('success', async ({}, testInfo) => {
        await testInfo.attach('name', { body: Buffer.from(''), contentType: 'text/plain' });
        expect(0).toBe(1);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(stripAnsi(result.output)).toMatch(/^.*attachment #1: name \(text\/plain\).*\n.*\n.*------/gm);
});

test(`TestConfig.attachments works`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'globalSetup.ts': `
      import { FullConfig } from '@playwright/test';

      async function globalSetup(config: FullConfig) {
        config.attachments = [{ contentType: 'text/plain', body: Buffer.from('example data'), name: 'my-attachment.txt' }];
      };

      export default globalSetup;
    `,
    'playwright.config.ts': `
      import path from 'path';
      const config = {
        globalSetup: path.join(__dirname, './globalSetup'),
      }

      export default config;
    `,
    'example.spec.ts': `
      const { test } = pwt;
      test('sample', async ({}) => { expect(2).toBe(2); });
    `,
  }, { reporter: 'json' });

  expect(result.exitCode).toBe(0);
  expect(result.report.config.attachments).toHaveLength(1);
  expect(result.report.config.attachments[0].name).toBe('my-attachment.txt');
  expect(Buffer.from(result.report.config.attachments[0].body, 'base64').toString()).toBe('example data');
});

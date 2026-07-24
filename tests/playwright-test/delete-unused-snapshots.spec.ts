/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as fs from 'fs';
import { test, expect } from './playwright-test-fixtures';

const platformSuffix = '-' + process.platform;

const files = {
  'a.spec.js': `
    const { test, expect } = require('@playwright/test');
    test('is a test', ({}) => {
      expect('Hello world').toMatchSnapshot('snapshot.txt');
    });
  `,
};

const snapshotFiles = {
  [`a.spec.js-snapshots/snapshot${platformSuffix}.txt`]: `Hello world`,
  [`a.spec.js-snapshots/stale${platformSuffix}.txt`]: `Stale`,
};

test('should delete unused snapshots in used snapshot directories only', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    ...snapshotFiles,
    [`b.spec.js-snapshots/old${platformSuffix}.txt`]: `Old`,
    'b.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('does not use snapshots', ({}) => {
        expect(1).toBe(1);
      });
    `,
  }, { 'delete-unused-snapshots': true });
  expect(result.exitCode).toBe(0);
  expect(result.output).toContain('Deleted unused snapshots:');
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `snapshot${platformSuffix}.txt`))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `stale${platformSuffix}.txt`))).toBe(false);
  // Directory not used by any snapshot in this run is left untouched.
  expect(fs.existsSync(testInfo.outputPath('b.spec.js-snapshots', `old${platformSuffix}.txt`))).toBe(true);
});

test('should keep snapshots for other platforms and projects', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    ...snapshotFiles,
    'a.spec.js-snapshots/snapshot-otherplatform.txt': `Hello world`,
    [`a.spec.js-snapshots/snapshot-otherproject${platformSuffix}.txt`]: `Hello world`,
  }, { 'delete-unused-snapshots': true });
  expect(result.exitCode).toBe(0);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `snapshot${platformSuffix}.txt`))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `snapshot-otherplatform.txt`))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `snapshot-otherproject${platformSuffix}.txt`))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `stale${platformSuffix}.txt`))).toBe(false);
});

test('should not delete snapshots without the flag', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    ...snapshotFiles,
  });
  expect(result.exitCode).toBe(0);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `stale${platformSuffix}.txt`))).toBe(true);
});

test('should not delete snapshots when a test fails', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...snapshotFiles,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
      test('fails', ({}) => {
        expect(1).toBe(2);
      });
    `,
  }, { 'delete-unused-snapshots': true });
  expect(result.exitCode).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `stale${platformSuffix}.txt`))).toBe(true);
});

test('should not delete snapshots in directories used by files with skipped tests', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...snapshotFiles,
    [`b.spec.js-snapshots/snapshot${platformSuffix}.txt`]: `Hello world`,
    [`b.spec.js-snapshots/stale${platformSuffix}.txt`]: `Stale`,
    'a.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
      test.fixme('skipped test', ({}) => {
        expect('Stale').toMatchSnapshot('stale.txt');
      });
    `,
    'b.spec.js': `
      const { test, expect } = require('@playwright/test');
      test('is a test', ({}) => {
        expect('Hello world').toMatchSnapshot('snapshot.txt');
      });
    `,
  }, { 'delete-unused-snapshots': true });
  expect(result.exitCode).toBe(0);
  // a.spec.js has a skipped test, so its snapshot directory is not cleaned up.
  expect(fs.existsSync(testInfo.outputPath('a.spec.js-snapshots', `stale${platformSuffix}.txt`))).toBe(true);
  // b.spec.js has no skipped tests, so its snapshot directory is cleaned up.
  expect(fs.existsSync(testInfo.outputPath('b.spec.js-snapshots', `stale${platformSuffix}.txt`))).toBe(false);
});

test('should work with custom snapshotPathTemplate', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...files,
    'playwright.config.js': `
      module.exports = { snapshotPathTemplate: '__snapshots__/{testFilePath}/{arg}{-snapshotSuffix}{ext}' };
    `,
    [`__snapshots__/a.spec.js/snapshot${platformSuffix}.txt`]: `Hello world`,
    '__snapshots__/a.spec.js/snapshot-otherplatform.txt': `Hello world`,
    [`__snapshots__/a.spec.js/stale${platformSuffix}.txt`]: `Stale`,
  }, { 'delete-unused-snapshots': true });
  expect(result.exitCode).toBe(0);
  expect(fs.existsSync(testInfo.outputPath('__snapshots__', 'a.spec.js', `snapshot${platformSuffix}.txt`))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('__snapshots__', 'a.spec.js', `snapshot-otherplatform.txt`))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('__snapshots__', 'a.spec.js', `stale${platformSuffix}.txt`))).toBe(false);
});

test('should require running without test filters', async ({ runInlineTest }) => {
  {
    const result = await runInlineTest(files, { 'delete-unused-snapshots': true, 'grep': 'test' });
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('--delete-unused-snapshots cannot be used with --grep');
  }
  {
    const result = await runInlineTest(files, { 'delete-unused-snapshots': true, 'shard': '1/2' });
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('--delete-unused-snapshots cannot be used with --shard');
  }
  {
    const result = await runInlineTest(files, { 'delete-unused-snapshots': true, 'last-failed': true });
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('--delete-unused-snapshots cannot be used with --last-failed');
  }
  {
    const result = await runInlineTest(files, { 'delete-unused-snapshots': true }, {}, { additionalArgs: ['a.spec.js:4'] });
    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain('--delete-unused-snapshots cannot be used with individual test locations');
  }
  {
    // Whole test files are allowed.
    const result = await runInlineTest(files, { 'delete-unused-snapshots': true, 'update-snapshots': 'all' }, {}, { additionalArgs: ['a.spec.js'] });
    expect(result.exitCode).toBe(0);
  }
});

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
import * as path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('should work and remove non-failures', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        name: 'chromium',
        preserveOutput: 'failures-only',
        testDir: 'dir',
      };
    `,
    'dir/my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({}, testInfo) => {
        if (testInfo.retry) {
          expect(testInfo.outputDir).toContain('my-test-test-1-chromium-retry' + testInfo.retry);
          expect(testInfo.outputPath('foo', 'bar')).toContain(require('path').join('my-test-test-1-chromium-retry' + testInfo.retry, 'foo', 'bar'));
          require('fs').writeFileSync(testInfo.outputPath('file.txt'), 'content', 'utf-8');
        } else {
          expect(testInfo.outputDir).toContain('my-test-test-1-chromium');
          expect(testInfo.outputPath()).toContain('my-test-test-1-chromium');
          expect(testInfo.outputPath('foo', 'bar')).toContain(require('path').join('my-test-test-1-chromium', 'foo', 'bar'));
          require('fs').writeFileSync(testInfo.outputPath('file.txt'), 'content', 'utf-8');
        }
        expect(require('fs').existsSync(testInfo.outputDir)).toBe(true);
        if (testInfo.retry < 2)
          throw new Error('Give me retries');
      });
    `,
  }, { retries: 2 });
  expect(result.exitCode).toBe(0);

  expect(result.results[0].status).toBe('failed');
  expect(result.results[0].retry).toBe(0);
  // Should only fail the last retry check.
  expect(result.results[0].error.message).toBe('Error: Give me retries');

  expect(result.results[1].status).toBe('failed');
  expect(result.results[1].retry).toBe(1);
  // Should only fail the last retry check.
  expect(result.results[1].error.message).toBe('Error: Give me retries');

  expect(result.results[2].status).toBe('passed');
  expect(result.results[2].retry).toBe(2);

  expect(fs.existsSync(testInfo.outputPath('test-results', 'my-test-test-1-chromium'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'my-test-test-1-chromium-retry1'))).toBe(true);
  // Last retry is successful, so output dir should be removed.
  expect(fs.existsSync(testInfo.outputPath('test-results', 'my-test-test-1-chromium-retry2'))).toBe(false);
});

test('should include repeat token', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        if (testInfo.repeatEachIndex)
          expect(testInfo.outputPath('')).toContain('repeat' + testInfo.repeatEachIndex);
        else
          expect(testInfo.outputPath('')).not.toContain('repeat' + testInfo.repeatEachIndex);
      });
    `
  }, { 'repeat-each': 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should default to package.json directory', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'foo/package.json': `{ "name": "foo" }`,
    'foo/bar/playwright.config.js': `
      module.exports = { reporters: [], projects: [ {} ] };
    `,
    'foo/bar/baz/tests/a.spec.js': `
      import { test, expect } from '@playwright/test';
      const fs = require('fs');
      test('pass', ({}, testInfo) => {
        expect(process.cwd()).toBe(__dirname);
        fs.writeFileSync(testInfo.outputPath('foo.ts'), 'foobar');
      });
    `
  }, {}, { PW_TEST_REPORTER: '' }, {
    cwd: 'foo/bar/baz/tests',
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('foo', 'test-results'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'test-results'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('foo', 'bar', 'baz', 'tests', 'test-results'))).toBe(false);
});

test('should be unique for beforeAll hook from different workers', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(({}, testInfo) => {
        console.log('\\n%%' + testInfo.outputDir);
      });
      test('fails', ({}, testInfo) => {
        expect(1).toBe(2);
      });
      test('passes', ({}, testInfo) => {
      });
    `
  }, { retries: '1' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.outputLines).toEqual([
    `${testInfo.outputPath('test-results', 'a-fails')}`,
    `${testInfo.outputPath('test-results', 'a-fails-retry1')}`,
    `${testInfo.outputPath('test-results', 'a-passes')}`,
  ]);
});

test('should include the project name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = '';
          await run();
        }, { auto: true } ]
      });
      export const test2 = base.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = 'suffix';
          await run();
        }, { auto: true } ]
      });
    `,
    'playwright.config.ts': `
      module.exports = { projects: [
        {},
        { name: 'foo' },
        { name: 'foo' },
        { name: 'Bar space!' },
      ] };
    `,
    'my-test.spec.js': `
      const { test, test2 } = require('./helper');
      test('test 1', async ({}, testInfo) => {
        console.log(testInfo.outputPath('bar.txt').replace(/\\\\/g, '/'));
        console.log(testInfo.snapshotPath('bar.txt').replace(/\\\\/g, '/'));
        if (testInfo.retry !== 1)
          throw new Error('Give me a retry');
      });
      test2('test 2', async ({}, testInfo) => {
        console.log(testInfo.outputPath('bar.txt').replace(/\\\\/g, '/'));
        console.log(testInfo.snapshotPath('bar.txt').replace(/\\\\/g, '/'));
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.results[0].status).toBe('failed');
  expect(result.results[1].status).toBe('passed');

  // test1, run with empty
  expect(result.output).toContain('test-results/my-test-test-1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar.txt');
  expect(result.output).toContain('test-results/my-test-test-1-retry1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar.txt');

  // test1, run with foo #1
  expect(result.output).toContain('test-results/my-test-test-1-foo/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-foo.txt');
  expect(result.output).toContain('test-results/my-test-test-1-foo-retry1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-foo.txt');

  // test1, run with foo #2
  expect(result.output).toContain('test-results/my-test-test-1-foo1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-foo.txt');
  expect(result.output).toContain('test-results/my-test-test-1-foo1-retry1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-foo.txt');

  // test1, run with bar
  expect(result.output).toContain('test-results/my-test-test-1-Bar-space-/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-Bar-space-.txt');
  expect(result.output).toContain('test-results/my-test-test-1-Bar-space--retry1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-Bar-space-.txt');

  // test2, run with empty
  expect(result.output).toContain('test-results/my-test-test-2/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-suffix.txt');

  // test2, run with foo #1
  expect(result.output).toContain('test-results/my-test-test-2-foo/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-foo-suffix.txt');

  // test2, run with foo #2
  expect(result.output).toContain('test-results/my-test-test-2-foo1/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-foo-suffix.txt');

  // test2, run with bar
  expect(result.output).toContain('test-results/my-test-test-2-Bar-space-/bar.txt');
  expect(result.output).toContain('my-test.spec.js-snapshots/bar-Bar-space--suffix.txt');
});

test('should include path option in snapshot', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = 'suffix';
          await run();
        }, { auto: true } ]
      });
    `,
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
      ] };
    `,
    'my-test.spec.js': `
      const { test } = require('./helper');
      test('test with path', async ({}, testInfo) => {
        console.log(testInfo.snapshotPath('test', 'path', 'bar.txt').replace(/\\\\/g, '/'));
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.results[0].status).toBe('passed');
  expect(result.output).toContain('my-test.spec.js-snapshots/test/path/bar-foo-suffix.txt');
});

test('should error if outputPath is resolved to outside of parent', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        auto: [ async ({}, run, testInfo) => {
          testInfo.snapshotSuffix = 'suffix';
          await run();
        }, { auto: true } ]
      });
    `,
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
      ] };
    `,
    'my-test.spec.js': `
      const { test } = require('./helper');
      test('test with parent path', async ({}, testInfo) => {
        console.log(testInfo.outputPath('..', 'test', 'path', 'bar-test').replace(/\\\\/g, '/'));
      });
    `,
  });

  expect(result.exitCode).toBe(1);
  expect(result.results[0].status).toBe('failed');
  expect(result.output).toContain('The outputPath is not allowed outside of the parent directory. Please fix the defined path.');
  const badPath = path.join('..', 'test', 'path', 'bar-test');
  expect(result.output).toContain(`outputPath: ${badPath}`);
});

test('should remove output dirs for projects run', async ({ runInlineTest }, testInfo) => {
  const paths: string[] = [];
  const files: string[] = [];

  for (let i = 0; i < 3; i++) {
    const p = testInfo.outputPath('path' + i);
    await fs.promises.mkdir(p, { recursive: true });
    const f = path.join(p, 'my-file.txt');
    await fs.promises.writeFile(f, 'contents', 'utf-8');
    paths.push(p);
    files.push(f);
  }

  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { projects: [
        { outputDir: ${JSON.stringify(paths[0])} },
        { outputDir: ${JSON.stringify(paths[2])} },
      ] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('my test', ({}, testInfo) => {});
    `
  }, { output: '' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);

  expect(fs.existsSync(files[0])).toBe(false);
  expect(fs.existsSync(files[1])).toBe(true);
  expect(fs.existsSync(files[2])).toBe(false);
});

test('should remove folders with preserveOutput=never', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { preserveOutput: 'never' };
    `,
    'dir/my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({}, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('file.txt'), 'content', 'utf-8');
        if (testInfo.retry < 2)
          throw new Error('Give me retries');
      });
    `,
  }, { retries: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.results.length).toBe(3);

  expect(fs.existsSync(testInfo.outputPath('test-results', 'dir-my-test-test-1'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'dir-my-test-test-1-retry1'))).toBe(false);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'dir-my-test-test-1-retry2'))).toBe(false);
});

test('should preserve failed results', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'dir/my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({}, testInfo) => {
        require('fs').writeFileSync(testInfo.outputPath('file.txt'), 'content', 'utf-8');
        if (testInfo.retry < 2)
          throw new Error('Give me retries');
      });
    `,
  }, { 'retries': 2 });
  expect(result.exitCode).toBe(0);
  expect(result.results.length).toBe(3);

  expect(fs.existsSync(testInfo.outputPath('test-results', 'dir-my-test-test-1'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'dir-my-test-test-1-retry1'))).toBe(true);
});


test('should accept a relative path for outputDir', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', async ({}, testInfo) => {
        expect(testInfo.outputDir).toBe(${JSON.stringify(path.join(testInfo.outputDir, './my-output-dir', 'my-test-test'))});
      });
    `,
    'playwright.config.js': `
    module.exports = { projects: [
      { outputDir: './my-output-dir' },
    ] };
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should have output dir based on rootDir (cwd)', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      const path = require('path');
      module.exports = {
        testDir: path.join(__dirname, 'e2e'),
        outputDir: 'test-results/',
      };`,
    'e2e/example.spec.js': `
      import { test, expect } from '@playwright/test';
      const fs = require('fs');
      test('hello world', async ({ }, testInfo) => {
        fs.writeFileSync(testInfo.outputPath('foo.txt'), 'hello');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'example-hello-world', 'foo.txt'))).toBe(true);
});


test('should allow nonAscii characters in the output dir', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test('こんにちは世界', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.outputDir);
      });
    `,
  });
  const outputDir = result.outputLines[0];
  expect(outputDir).toBe(path.join(testInfo.outputDir, 'test-results', 'my-test-こんにちは世界'));
});

test('should allow shorten long output dirs characters in the output dir', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'very/deep/and/long/file/name/that/i/want/to/be/trimmed/my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test.describe('this is a really long description that would be too long for a file path', () => {
        test('and this is an even longer test name that just keeps going and going and we should shorten it', async ({}, testInfo) => {
          console.log('\\n%%' + testInfo.outputDir);
        });
      });
    `,
  });
  const outputDir = result.outputLines[0];
  expect(outputDir).toBe(path.join(testInfo.outputDir, 'test-results', 'very-deep-and-long-file-na-99202-ng-and-we-should-shorten-it'));
});

test('should not mangle double dashes', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'my--file.spec.js': `
      import { test, expect } from '@playwright/test';
      test('my--test', async ({}, testInfo) => {
        console.log('\\n%%' + testInfo.outputDir);
      });
    `,
  });
  const outputDir = result.outputLines[0];
  expect(outputDir).toBe(path.join(testInfo.outputDir, 'test-results', 'my--file-my--test'));
});

test('should allow include the describe name the output dir', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'my-test.spec.js': `
      import { test, expect } from '@playwright/test';
      test.describe('hello', () => {
        test('world', async ({}, testInfo) => {
          console.log('\\n%%' + testInfo.outputDir);
        });
      });
    `,
  });
  const outputDir = result.outputLines[0];
  expect(outputDir).toBe(path.join(testInfo.outputDir, 'test-results', 'my-test-hello-world'));
});

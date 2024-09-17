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

import path from 'path';
import { test, expect } from './playwright-test-fixtures';

test('render text attachment', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
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
  const text = result.output;
  expect(text).toContain('    attachment #1: attachment (text/plain) ─────────────────────────────────────────────────────────');
  expect(text).toContain('    Hello world');
  expect(text).toContain('    ────────────────────────────────────────────────────────────────────────────────────────────────');
  expect(result.exitCode).toBe(1);
});

test('render screenshot attachment', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
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
  const text = result.output.replace(/\\/g, '/');
  expect(text).toContain('    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────');
  expect(text).toContain('    test-results/a-one/some/path.png');
  expect(text).toContain('    ────────────────────────────────────────────────────────────────────────────────────────────────');
  expect(result.exitCode).toBe(1);
});

test('render trace attachment', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({}, testInfo) => {
        testInfo.attachments.push({
          name: 'trace',
          path: testInfo.outputPath('my dir with space', 'trace.zip'),
          contentType: 'application/zip'
        });
        expect(1).toBe(0);
      });
    `,
  }, { reporter: 'line' });
  const text = result.output.replace(/\\/g, '/');
  expect(text).toContain('    attachment #1: trace (application/zip) ─────────────────────────────────────────────────────────');
  expect(text).toContain('    test-results/a-one/my dir with space/trace.zip');
  expect(text).toContain('npx playwright show-trace "test-results/a-one/my dir with space/trace.zip"');
  expect(text).toContain('    ────────────────────────────────────────────────────────────────────────────────────────────────');
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach errors`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
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
  const text = result.output.replace(/\\/g, '/');
  expect(text).toMatch(/Error: ENOENT: no such file or directory, copyfile '.*foo.txt.*'/);
  expect(text).toContain(`Exactly one of "path" and "body" must be specified`);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach errors with empty path`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({}, testInfo) => {
        await testInfo.attach('name', { path: '' });
      });
    `,
  }, { reporter: 'line', workers: 1 });
  expect(result.output).toMatch(/Error: ENOENT: no such file or directory, copyfile ''/);
  expect(result.exitCode).toBe(1);
});

test(`testInfo.attach error in fixture`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use, testInfo) => {
          await use();
          await testInfo.attach('name', { path: 'foo.txt' });
        },
      });
      test('fail1', async ({ fixture }) => {
      });
    `,
  }, { reporter: 'line', workers: 1 });
  const text = result.output.replace(/\\/g, '/');
  expect(text).toMatch(/Error: ENOENT: no such file or directory, copyfile '.*foo.txt.*'/);
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
});

test(`testInfo.attach success in fixture`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
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
  expect(result.output).toContain('attachment #1: name (text/plain)');
});

test(`testInfo.attach allow empty string body`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('success', async ({}, testInfo) => {
        await testInfo.attach('name', { body: '', contentType: 'text/plain' });
        expect(0).toBe(1);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toMatch(/^.*attachment #1: name \(text\/plain\).*\n.*\n.*──────/gm);
});

test(`testInfo.attach allow without options`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('success', async ({}, testInfo) => {
        await testInfo.attach('Full name');
        expect(0).toBe(1);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toMatch(/^.*attachment #1: Full name \(text\/plain\).*\n.*──────/gm);
});

test(`testInfo.attach allow empty buffer body`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('success', async ({}, testInfo) => {
        await testInfo.attach('name', { body: Buffer.from(''), contentType: 'text/plain' });
        expect(0).toBe(1);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toMatch(/^.*attachment #1: name \(text\/plain\).*\n.*\n.*──────/gm);
});

test(`testInfo.attach use name as prefix`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use, testInfo) => {
          const filePath = testInfo.outputPath('foo.txt');
          require('fs').writeFileSync(filePath, 'hello');
          await use();
          await testInfo.attach('some random string', { path: filePath });
        },
      });
      test('success', async ({ fixture }) => {
        expect(true).toBe(false);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  expect(result.output).toContain('attachment #1: some random string (text/plain)');
  expect(result.output).toContain('some-random-string-');
});

test(`testInfo.attach name should be sanitized`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use, testInfo) => {
          const filePath = testInfo.outputPath('foo.txt');
          require('fs').writeFileSync(filePath, 'hello');
          await use();
          await testInfo.attach('../../../test', { path: filePath });
        },
      });
      test('success', async ({ fixture }) => {
        expect(true).toBe(false);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  expect(result.output).toContain('attachment #1: ../../../test (text/plain)');
  expect(result.output).toContain(`attachments${path.sep}-test`);
});

test(`testInfo.attach name can be empty string`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use, testInfo) => {
          const filePath = testInfo.outputPath('foo.txt');
          require('fs').writeFileSync(filePath, 'hello');
          await use();
          await testInfo.attach('', { path: filePath });
        },
      });
      test('success', async ({ fixture }) => {
        expect(true).toBe(false);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  expect(result.output).toContain('attachment #1:  (text/plain)');
  expect(result.output).toContain(`attachments${path.sep}-`);
});

test(`testInfo.attach throw if name is not string`, async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        fixture: async ({}, use, testInfo) => {
          const filePath = testInfo.outputPath('foo.txt');
          require('fs').writeFileSync(filePath, 'hello');
          await use();
          await testInfo.attach(false, { path: filePath });
        },
      });
      test('success', async ({ fixture }) => {
        expect(true).toBe(true);
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);

  expect(result.output).toContain('"name" should be string.');
});

test('render text attachment with multiple lines', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test, expect } = require('@playwright/test');
      test('one', async ({}, testInfo) => {
        testInfo.attachments.push({
          name: 'attachment',
          body: Buffer.from('First line\\nSecond line\\nThird line'),
          contentType: 'text/plain'
        });
        expect(1).toBe(0);
      });
    `,
  }, { reporter: 'line' });
  const text = result.output;
  expect(text).toContain('    attachment #1: attachment (text/plain) ─────────────────────────────────────────────────────────');
  expect(text).toContain('    First line');
  expect(text).toContain('    Second line');
  expect(text).toContain('    Third line');
  expect(text).toContain('    ────────────────────────────────────────────────────────────────────────────────────────────────');
  expect(result.exitCode).toBe(1);
});

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
import { test as base, expect, stripAnsi } from './playwright-test-fixtures';
import path from 'path';
import type { Locator, TestInfo } from './stable-test-runner';

function relativeFilePath(file: string): string {
  if (!path.isAbsolute(file))
    return file;
  return path.relative(process.cwd(), file);
}

const test = base.extend<{ githubSummary: { path: string; contents: () => Promise<string>; report: () => Promise<Locator>; } }>(
    {
      githubSummary: async ({ page }, use, testInfo: TestInfo) => {
        const githubSummaryPath = testInfo.outputPath('github-summary.md');
        await fs.promises.writeFile(githubSummaryPath, '');
        const contents = () => fs.promises.readFile(githubSummaryPath, 'utf8');
        const report = async () => {
          await page.setContent(await contents());
          return page.locator(':scope');
        };

        await use({ report, contents, path: githubSummaryPath });
      }
    }
);


test.use({ channel: 'chrome' });

test('print GitHub annotations for success', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { reporter: 'github' });
  const text = stripAnsi(result.output);
  expect(text).not.toContain('::error');
  expect(text).toContain('::notice title=🎭 Playwright Run Summary::  1 passed');
  expect(result.exitCode).toBe(0);
});

test('print GitHub annotations for failed tests', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('example', async ({}) => {
        expect(1 + 1).toBe(3);
      });
    `
  }, { retries: 3, reporter: 'github' }, { GITHUB_WORKSPACE: process.cwd() });
  const text = stripAnsi(result.output);
  const testPath = relativeFilePath(testInfo.outputPath('a.test.js'));
  expect(text).toContain(`::error file=${testPath},title=a.test.js:6:7 › example,line=7,col=23::  1) a.test.js:6:7 › example =======================================================================%0A%0A    Retry #1`);
  expect(text).toContain(`::error file=${testPath},title=a.test.js:6:7 › example,line=7,col=23::  1) a.test.js:6:7 › example =======================================================================%0A%0A    Retry #2`);
  expect(text).toContain(`::error file=${testPath},title=a.test.js:6:7 › example,line=7,col=23::  1) a.test.js:6:7 › example =======================================================================%0A%0A    Retry #3`);
  expect(result.exitCode).toBe(1);
});

test('print GitHub annotations for slow tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reportSlowTests: { max: 0, threshold: 100 }
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('slow test', async ({}) => {
        await new Promise(f => setTimeout(f, 200));
      });
    `
  }, { retries: 3, reporter: 'github' }, { GITHUB_WORKSPACE: '' });
  const text = stripAnsi(result.output);
  expect(text).toContain('::warning title=Slow Test,file=a.test.js::a.test.js took');
  expect(text).toContain('::notice title=🎭 Playwright Run Summary::  1 passed');
  expect(result.exitCode).toBe(0);
});

test('print GitHub annotations for global error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test = pwt.test.extend({
        w: [async ({}, use) => {
          await use();
          throw new Error('Oh my!');
        }, { scope: 'worker' }],
      });
      test('passes but...', ({w}) => {
      });
    `,
  }, { reporter: 'github' });
  const text = stripAnsi(result.output);
  expect(text).toContain('::error ::Error: Oh my!%0A%0A');
  expect(result.exitCode).toBe(1);
});

test('summary works', async ({ runInlineTest, githubSummary, page }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;

      test('flaky', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      })

      test('passing', async ({}) => {
        expect(1 + 1).toBe(2);
      });

      test('timeout', async ({}) => {
        test.setTimeout(500);
        await new Promise(() => {});
      });

      test('failing', async ({}) => {
        expect(1).toBe(2);
      });

      test('skip', async ({}) => {
        test.skip();
      });
    `
  }, { reporter: 'github', retries: 2 }, { GITHUB_STEP_SUMMARY: githubSummary.path });
  expect(result.exitCode).toBe(1);
  const report = await githubSummary.report();
  await expect(report.locator('details > summary')).toHaveText([
    '❌ (unexpected) a.test.js > failing',
    '❌ (unexpected) a.test.js > timeout',
    '⁉️ (flaky) a.test.js > flaky',
  ]);

  await expect(report.locator('details')).toContainText([
    'expect(1).toBe(2);',
    'Timeout of 500ms exceeded.',
    'expect(testInfo.retry).toBe(1);',
  ]);
});

test('summary skips if no problematic test cases', async ({ runInlineTest, githubSummary, page }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;

      test('passing', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { reporter: 'github' }, { GITHUB_STEP_SUMMARY: githubSummary.path });
  expect(result.exitCode).toBe(0);
  await expect(githubSummary.contents()).resolves.toBe('');
});

test('summary off option works', async ({ runInlineTest, githubSummary }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['github', { summary: 'off' }],
        ]
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('example1', async ({}) => {
        expect(1).toBe(2);
      });
    `
  }, { reporter: '' }, { GITHUB_STEP_SUMMARY: githubSummary.path });
  const text = stripAnsi(result.output);
  expect(text).toContain('::error');
  expect(result.exitCode).toBe(1);

  await expect(githubSummary.contents()).resolves.toBe('');
});

test('annotations off option works', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [
          ['github', { annotations: 'off' }],
        ]
      };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('example1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { reporter: '' });
  const text = stripAnsi(result.output);
  expect(text).not.toContain('::error');
  expect(text).not.toContain('::notice title=🎭 Playwright Run Summary::  1 passed');
  expect(result.exitCode).toBe(0);
});

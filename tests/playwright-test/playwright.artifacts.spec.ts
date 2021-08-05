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

import { test, expect } from './playwright-test-fixtures';
import fs from 'fs';
import path from 'path';

function listFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isDirectory())
      result.push(...listFiles(path.join(dir, entry.name)).map(x => entry.name + '/' + x));
    else
      result.push(entry.name);
  }
  return result;
}

const testFiles = {
  'artifacts.spec.ts': `
    const { test } = pwt;

    test.describe('shared', () => {
      let page;
      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage({});
        await page.setContent('<button>Click me</button><button>And me</button>');
      });

      test.afterAll(async () => {
        await page.close();
      });

      test('shared passing', async ({ }) => {
        await page.click('text=Click me');
      });

      test('shared  failing', async ({ }) => {
        await page.click('text=And me');
        expect(1).toBe(2);
      });
    });

    test('passing', async ({ page }) => {
      await page.setContent('I am the page');
    });

    test('two contexts', async ({ page, createContext }) => {
      await page.setContent('I am the page');

      const context2 = await createContext();
      const page2 = await context2.newPage();
      await page2.setContent('I am the page');
    });

    test('failing', async ({ page }) => {
      await page.setContent('I am the page');
      expect(1).toBe(2);
    });

    test('two contexts failing', async ({ page, createContext }) => {
      await page.setContent('I am the page');

      const context2 = await createContext();
      const page2 = await context2.newPage();
      await page2.setContent('I am the page');

      expect(1).toBe(2);
    });

    test('own context passing', async ({ browser }) => {
      const page = await browser.newPage();
      await page.setContent('<button>Click me</button><button>And me</button>');
      await page.click('text=Click me');
      await page.close();
    });

    test('own context failing', async ({ browser }) => {
      const page = await browser.newPage();
      await page.setContent('<button>Click me</button><button>And me</button>');
      await page.click('text=Click me');
      await page.close();
      expect(1).toBe(2);
    });
  `,
};

test('should work with screenshot: on', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'on' } };
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(4);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    'artifacts-failing/test-failed-1.png',
    'artifacts-passing/test-finished-1.png',
    'artifacts-shared-failing/test-failed-1.png',
    'artifacts-shared-passing/test-finished-1.png',
    'artifacts-two-contexts/test-finished-1.png',
    'artifacts-two-contexts/test-finished-2.png',
    'artifacts-two-contexts-failing/test-failed-1.png',
    'artifacts-two-contexts-failing/test-failed-2.png',
    'report.json',
  ]);
});

test('should work with screenshot: only-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'only-on-failure' } };
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(4);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    'artifacts-failing/test-failed-1.png',
    'artifacts-shared-failing/test-failed-1.png',
    'artifacts-two-contexts-failing/test-failed-1.png',
    'artifacts-two-contexts-failing/test-failed-2.png',
    'report.json',
  ]);
});

test('should work with trace: on', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(4);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    'artifacts-failing/trace.zip',
    'artifacts-own-context-failing/trace.zip',
    'artifacts-own-context-passing/trace.zip',
    'artifacts-passing/trace.zip',
    'artifacts-shared-failing/trace.zip',
    'artifacts-shared-passing/trace.zip',
    'artifacts-two-contexts/trace-1.zip',
    'artifacts-two-contexts/trace.zip',
    'artifacts-two-contexts-failing/trace-1.zip',
    'artifacts-two-contexts-failing/trace.zip',
    'report.json',
  ]);
});

test('should work with trace: retain-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(4);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    'artifacts-failing/trace.zip',
    'artifacts-own-context-failing/trace.zip',
    'artifacts-shared-failing/trace.zip',
    'artifacts-two-contexts-failing/trace-1.zip',
    'artifacts-two-contexts-failing/trace.zip',
    'report.json',
  ]);
});

test('should work with trace: on-first-retry', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-first-retry' } };
    `,
  }, { workers: 1, retries: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(4);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    'artifacts-failing-retry1/trace.zip',
    'artifacts-own-context-failing-retry1/trace.zip',
    'artifacts-shared-failing-retry1/trace.zip',
    'artifacts-two-contexts-failing-retry1/trace-1.zip',
    'artifacts-two-contexts-failing-retry1/trace.zip',
    'report.json',
  ]);
});

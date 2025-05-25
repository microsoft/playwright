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
    result.push(entry.name);
    if (entry.isDirectory())
      result.push(...listFiles(path.join(dir, entry.name)).map(x => '  ' + x));
  }
  return result;
}

const testFiles = {
  'artifacts.spec.ts': `
    import fs from 'fs';
    import os from 'os';
    import path from 'path';

    import { test, expect } from '@playwright/test';

    test.describe('shared', () => {
      let page;
      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage({});
        await page.setContent('<button>Click me</button><button>And me</button>');
      });

      test.afterAll(async () => {
        await page.setContent('Reset!');
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

    test('two contexts', async ({ page, browser }) => {
      await page.setContent('I am the page');

      const page2 = await browser.newPage();
      await page2.setContent('I am the page');
      await page2.close();
    });

    test('failing', async ({ page }) => {
      await page.setContent('I am the page');
      expect(1).toBe(2);
    });

    test('two contexts failing', async ({ page, browser }) => {
      await page.setContent('I am the page');

      const page2 = await browser.newPage();
      await page2.setContent('I am the page');
      expect(1).toBe(2);
      await page2.close();
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

    const testPersistent = test.extend({
      page: async ({ playwright, browserName }, use) => {
        const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'user-data-dir-'));
        const context = await playwright[browserName].launchPersistentContext(dir);
        await use(context.pages()[0]);
        await context.close();
        fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
      },
    });

    testPersistent('persistent passing', async ({ page }) => {
      await page.setContent('<button>Click me</button><button>And me</button>');
    });

    testPersistent('persistent failing', async ({ page }) => {
      await page.setContent('<button>Click me</button><button>And me</button>');
      expect(1).toBe(2);
    });
  `,
};

test.slow(true, 'Multiple browser launches in each test');
test.describe.configure({ mode: 'parallel' });

test('should work with screenshot: on', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'on' } };
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing',
    '  test-failed-1.png',
    'artifacts-own-context-failing',
    '  test-failed-1.png',
    'artifacts-own-context-passing',
    '  test-finished-1.png',
    'artifacts-passing',
    '  test-finished-1.png',
    'artifacts-persistent-failing',
    '  test-failed-1.png',
    'artifacts-persistent-passing',
    '  test-finished-1.png',
    'artifacts-shared-shared-failing',
    '  test-failed-1.png',
    'artifacts-shared-shared-passing',
    '  test-finished-1.png',
    'artifacts-two-contexts',
    '  test-finished-1.png',
    '  test-finished-2.png',
    'artifacts-two-contexts-failing',
    '  test-failed-1.png',
    '  test-failed-2.png',
  ]);
});

test('should work with screenshot: only-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'only-on-failure' } };
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing',
    '  test-failed-1.png',
    'artifacts-own-context-failing',
    '  test-failed-1.png',
    'artifacts-persistent-failing',
    '  test-failed-1.png',
    'artifacts-shared-shared-failing',
    '  test-failed-1.png',
    'artifacts-two-contexts-failing',
    '  test-failed-1.png',
    '  test-failed-2.png',
  ]);
});

test('should work with screenshot: on-first-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({ page }) => {
        await page.setContent('I am the page');
        expect(1).toBe(2);
      });
    `,
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        use: { screenshot: 'on-first-failure' }
      };
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'a-fails',
    '  test-failed-1.png',
  ]);
});

test('should work with screenshot: only-on-failure & fullPage', async ({ runInlineTest, server }, testInfo) => {
  const result = await runInlineTest({
    'artifacts.spec.ts': `
    import { test, expect } from '@playwright/test';

    test('should fail and take fullPage screenshots', async ({ page }) => {
      await page.setViewportSize({ width: 500, height: 500 });
      await page.goto('${server.PREFIX}/grid.html');
      expect(1).toBe(2);
    });
    `,
    'playwright.config.ts': `
      module.exports = { use: { screenshot: { mode: 'only-on-failure', fullPage: true } } };
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-should-fail-and-take-fullPage-screenshots',
    '  test-failed-1.png',
  ]);
  const screenshotFailure = fs.readFileSync(
      testInfo.outputPath('test-results', 'artifacts-should-fail-and-take-fullPage-screenshots', 'test-failed-1.png')
  );
  expect.soft(screenshotFailure).toMatchSnapshot('screenshot-grid-fullpage.png');
});

test('should capture a single screenshot on failure when afterAll fails', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      let page;
      test.use({ screenshot: 'only-on-failure' });
      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
      });
      test.afterAll(async () => {
        await page.setContent('this is afterAll');
        expect(1).toBe(2);
        await page.close();
      });
      test('passes', async () => {
        await page.setContent('this is test');
      });
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'a-passes',
    '  test-failed-1.png',
  ]);
});


test('should work with trace: on', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing',
    '  trace.zip',
    'artifacts-own-context-failing',
    '  trace.zip',
    'artifacts-own-context-passing',
    '  trace.zip',
    'artifacts-passing',
    '  trace.zip',
    'artifacts-persistent-failing',
    '  trace.zip',
    'artifacts-persistent-passing',
    '  trace.zip',
    'artifacts-shared-shared-failing',
    '  trace.zip',
    'artifacts-shared-shared-passing',
    '  trace.zip',
    'artifacts-two-contexts',
    '  trace.zip',
    'artifacts-two-contexts-failing',
    '  trace.zip',
  ]);
});

test('should work with trace: retain-on-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-failure' } };
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing',
    '  trace.zip',
    'artifacts-own-context-failing',
    '  trace.zip',
    'artifacts-persistent-failing',
    '  trace.zip',
    'artifacts-shared-shared-failing',
    '  trace.zip',
    'artifacts-two-contexts-failing',
    '  trace.zip',
  ]);
});

test('should work with trace: on-first-retry', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-first-retry' } };
    `,
  }, { workers: 1, retries: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing-retry1',
    '  trace.zip',
    'artifacts-own-context-failing-retry1',
    '  trace.zip',
    'artifacts-persistent-failing-retry1',
    '  trace.zip',
    'artifacts-shared-shared-failing-retry1',
    '  trace.zip',
    'artifacts-two-contexts-failing-retry1',
    '  trace.zip',
  ]);
});

test('should work with trace: on-all-retries', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-all-retries' } };
    `,
  }, { workers: 1, retries: 2 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing-retry1',
    '  trace.zip',
    'artifacts-failing-retry2',
    '  trace.zip',
    'artifacts-own-context-failing-retry1',
    '  trace.zip',
    'artifacts-own-context-failing-retry2',
    '  trace.zip',
    'artifacts-persistent-failing-retry1',
    '  trace.zip',
    'artifacts-persistent-failing-retry2',
    '  trace.zip',
    'artifacts-shared-shared-failing-retry1',
    '  trace.zip',
    'artifacts-shared-shared-failing-retry2',
    '  trace.zip',
    'artifacts-two-contexts-failing-retry1',
    '  trace.zip',
    'artifacts-two-contexts-failing-retry2',
    '  trace.zip',
  ]);
});

test('should work with trace: retain-on-first-failure', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'retain-on-first-failure' } };
    `,
  }, { workers: 1, retries: 2 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(5);
  expect(result.failed).toBe(5);
  expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
    '.last-run.json',
    'artifacts-failing',
    '  trace.zip',
    'artifacts-own-context-failing',
    '  trace.zip',
    'artifacts-persistent-failing',
    '  trace.zip',
    'artifacts-shared-shared-failing',
    '  trace.zip',
    'artifacts-two-contexts-failing',
    '  trace.zip',
  ]);
});

test('should take screenshot when page is closed in afterEach', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { screenshot: 'on' } };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';

      test.afterEach(async ({ page }) => {
        await page.close();
      });

      test('fails', async ({ page }) => {
        expect(1).toBe(2);
      });
    `,
  }, { workers: 1 }, { PLAYWRIGHT_NO_COPY_PROMPT: 'true' });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-fails', 'test-failed-1.png'))).toBeTruthy();
});

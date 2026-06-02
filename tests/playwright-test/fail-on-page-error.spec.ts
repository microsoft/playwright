import { test, expect } from './playwright-test-fixtures';

test('should fail test on page error when configured via use option', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { failOnPageError: true } };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('page error', async ({ page }) => {
        // throw inside setTimeout to simulate an async page error
        await page.evaluate(() => setTimeout(() => { throw new Error('boom from page') }, 0));
        // give the page a moment to fire the event
        await new Promise(f => setTimeout(f, 50));
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test stopped due to page error');
  expect(result.output).toContain('boom from page');
});

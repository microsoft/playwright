import { test, expect } from '@playwright/test';

const fileToUpload = __filename; // '__filename' is the current test file.

/**
 * In this test we wait for an file chooser to appear while we click on an
 * input. Once the event was emitted we set the file and submit the form.
 * @see https://playwright.dev/docs/api/class-filechooser
 */
test('should be able to upload files', async ({ page, context }) => {
  await page.goto('/file-uploads.html');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input')
  ]);
  await fileChooser.setFiles(fileToUpload);
  await page.click('input[type=submit]');
  await expect(page.locator('text=4-file-uploads.spec.ts')).toBeVisible();
});

import { test } from '@playwright/test';

// '__filename' is the current test file.
const fileToUpload = __filename;

// In this test we wait for an file chooser to appear while we click on an
// input. Once the event was emitted we set the file and submit the form.
// More information: https://playwright.dev/docs/api/class-filechooser
test('should be able to upload files', async ({ page, context }) => {
  await page.goto('/file-uploads.html');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('input')
  ]);
  await fileChooser.setFiles(fileToUpload);
  await page.click('input[type=submit]');
  await page.waitForSelector('text=file-uploads.spec.ts');
});

// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    class FileSystemFileHandleMock {
      constructor(file) {
        this._file = file;
      }

      async getFile() {
        return this._file;
      }
    }
    window.showOpenFilePicker = async () => [new FileSystemFileHandleMock(new File(['Test content.'], "foo.txt"))];
  });
});

test('show file picker with mock class', async ({ page }) => {
  await page.goto('/file-picker.html');
  await page.locator('button', { hasText: 'Open File' }).click();
  // Check that the content of the mock file has been loaded.
  await expect(page.locator('textarea')).toHaveValue('Test content.');
});

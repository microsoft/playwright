// @ts-check
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => {
    class FileSystemHandleMock {
      constructor({name, children}) {
        this.name = name;
        children ??= [];
        this.kind = children.length ? 'directory' : 'file';
        this._children = children;
      }

      values() {
        // Wrap children data in the same mock.
        return this._children.map(c => new FileSystemHandleMock(c));
      }
    }
    // Create mock directory
    const mockDir = new FileSystemHandleMock({
      name: 'root',
      children: [
        {
          name: 'file1',
        },
        {
          name: 'dir1',
          children: [
            {
              name: 'file2',
            },
            {
              name: 'file3',
            }
          ]
        },
        {
          name: 'dir2',
          children: [
            {
              name: 'file4',
            },
            {
              name: 'file5',
            }
          ]
        }
      ]
    });
    // Make the picker return mock directory
    window.showDirectoryPicker = async () => mockDir;
  });
});

test('should display directory tree', async ({ page }) => {
  await page.goto('/ls-dir.html');
  await page.locator('button', { hasText: 'Open directory' }).click();
  // Check that the displayed entries match mock directory.
  await expect(page.locator('#dir')).toContainText([
    'file1',
    'dir1', 'file2', 'file3',
    'dir2', 'file4', 'file5'
  ]);
});

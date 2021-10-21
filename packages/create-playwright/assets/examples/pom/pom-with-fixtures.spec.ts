import { test, expect } from './fixtures';

/**
 * Fixtures are used here to create a TodoApp instance for every test. These are
 * defined inside the 'fixtures.ts' file. This will reduce the amount of
 * boilerplate created for each test and makes it more reusable.
 * @see https://playwright.dev/docs/test-fixtures
 */
test.beforeEach(async ({ todoPage }) => {
  await todoPage.goto();
});

test('should display zero initial items', async ({ todoPage }) => {
  await expect(todoPage.listItems).toHaveCount(0);
});

test('should be able to add new items', async ({ todoPage }) => {
  await todoPage.addItem('Example #1');
  await todoPage.addItem('Example #2');
  await expect(todoPage.listItems).toHaveText(['Example #1', 'Example #2']);
});

test('should be able to mark items as completed', async ({ todoPage }) => {
  await todoPage.addItem('Example #1');
  const firstListItem = todoPage.listItems.first();
  await expect(firstListItem).not.toHaveClass('completed');
  await firstListItem.locator('.toggle').check();
  await expect(firstListItem).toHaveClass('completed');
});

test('should still show the items after a page reload', async ({ page, todoPage }) => {
  await todoPage.addItem('Example #1');
  await expect(todoPage.listItems).toHaveText(['Example #1']);
  await page.reload();
  await expect(todoPage.listItems).toHaveText(['Example #1']);
});

test('should be able to filter by uncompleted items', async ({ todoPage }) => {
  await todoPage.addItem('Example #1');
  await todoPage.addItem('Example #2');
  await todoPage.addItem('Example #3');
  await todoPage.listItems.last().locator('.toggle').check();
  await todoPage.filterByActiveItemsButton.click();
  await expect(todoPage.listItems).toHaveCount(2);
  await expect(todoPage.listItems).toHaveText(['Example #1', 'Example #2']);
});

test('should be able to filter by completed items', async ({ todoPage }) => {
  await todoPage.addItem('Example #1');
  await todoPage.addItem('Example #2');
  await todoPage.addItem('Example #3');
  await todoPage.listItems.last().locator('.toggle').check();
  await todoPage.filterByCompletedItemsButton.click();
  await expect(todoPage.listItems).toHaveText(['Example #3']);
});

test('should be able to delete completed items', async ({ todoPage }) => {
  await todoPage.addItem('Example #1');
  await todoPage.listItems.last().locator('.toggle').check();
  await expect(todoPage.listItems).toHaveText(['Example #1']);
  await todoPage.listItems.first().locator('button.destroy').click();
  await expect(todoPage.listItems).toHaveText([]);
});

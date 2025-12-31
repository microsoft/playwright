// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Todo Creation', () => {
  test('Add multiple todos', async ({ page }) => {
    // 1. Navigate to the TodoMVC application
    // Expect: The page loads with an empty todo list
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();

    // 2. Add first todo 'Buy groceries' by typing and pressing Enter
    const newTodoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await newTodoInput.fill('Buy groceries');
    await newTodoInput.press('Enter');
    // Expect: The first todo appears in the list
    await expect(page.getByText('Buy groceries')).toBeVisible();

    // 3. Add second todo 'Walk the dog' by typing and pressing Enter
    await newTodoInput.fill('Walk the dog');
    await newTodoInput.press('Enter');
    // Expect: The second todo appears in the list below the first
    await expect(page.getByText('Walk the dog')).toBeVisible();

    // 4. Add third todo 'Read a book' by typing and pressing Enter
    await newTodoInput.fill('Read a book');
    await newTodoInput.press('Enter');
    // Expect: The third todo appears in the list below the second
    await expect(page.getByText('Read a book')).toBeVisible();

    // Post Conditions: All three todos are visible in the list
    await expect(page.getByText('Buy groceries')).toBeVisible();
    await expect(page.getByText('Walk the dog')).toBeVisible();
    await expect(page.getByText('Read a book')).toBeVisible();

    // Post Conditions: The todo counter shows '3 items left'
    await expect(page.getByText('3 items left')).toBeVisible();

    // Post Conditions: All todos are in active (unchecked) state
    await expect(page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByLabel('Toggle Todo')).not.toBeChecked();
  });
});

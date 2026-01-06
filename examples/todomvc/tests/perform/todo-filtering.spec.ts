import { test } from '../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test.describe('Todo Filtering', () => {

  test('View all todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`First todo is checked`);

    await page.agent.perform(`Click the 'All' filter link`);
    await page.agent.expect(`All three todos (both active and completed) are visible`);

    // Post Conditions
    await page.agent.expect(`All three todos are visible in the list`);
    await page.agent.expect(`The 'All' filter link is highlighted/active`);
    await page.agent.expect(`The URL hash is '#/' or empty`);
  });

  test('View active todos only', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`First todo is checked`);

    await page.agent.perform(`Click the 'Active' filter link`);
    await page.agent.expect(`Only 'Walk the dog' and 'Read a book' are visible`);

    // Post Conditions
    await page.agent.expect(`Only unchecked todos are visible`);
    await page.agent.expect(`The 'Active' filter link is highlighted/active`);
    await page.agent.expect(`The URL hash is '#/active'`);
    await page.agent.expect(`The todo counter still shows the correct count of active items`);
  });

  test('View completed todos only', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Mark 'Buy groceries' and 'Read a book' as complete`);
    await page.agent.expect(`Two todos are checked`);

    await page.agent.perform(`Click the 'Completed' filter link`);
    await page.agent.expect(`Only 'Buy groceries' and 'Read a book' are visible`);

    // Post Conditions
    await page.agent.expect(`Only checked todos are visible`);
    await page.agent.expect(`The 'Completed' filter link is highlighted/active`);
    await page.agent.expect(`The URL hash is '#/completed'`);
    await page.agent.expect(`The 'Clear completed' button is visible`);
  });

  test('Switch between filters', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`First todo is checked`);

    await page.agent.perform(`Click 'Active' filter`);
    await page.agent.expect(`Only active todos are shown (2 todos)`);

    await page.agent.perform(`Click 'Completed' filter`);
    await page.agent.expect(`Only completed todos are shown (1 todo)`);

    await page.agent.perform(`Click 'All' filter`);
    await page.agent.expect(`All todos are shown again (3 todos)`);

    // Post Conditions
    await page.agent.expect(`The filter switches correctly each time`);
    await page.agent.expect(`The appropriate filter link is highlighted`);
    await page.agent.expect(`The URL hash updates accordingly`);
  });

  test('Filter with no matching todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add two todos: 'Buy groceries', 'Walk the dog'`);
    await page.agent.expect(`Both todos appear in the list unchecked`);

    await page.agent.perform(`Click the 'Completed' filter link`);
    await page.agent.expect(`No todos are visible (empty list area)`);

    // Post Conditions
    await page.agent.expect(`The main todo list area is empty or shows no items`);
    await page.agent.expect(`The footer with filters is still visible`);
    await page.agent.expect(`The 'Completed' filter link is highlighted`);
  });

  test('Complete todo while viewing active filter', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add two todos: 'Buy groceries', 'Walk the dog'`);
    await page.agent.expect(`Both todos appear in the list`);

    await page.agent.perform(`Click the 'Active' filter link`);
    await page.agent.expect(`Both todos are visible`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`The 'Buy groceries' todo disappears from the active view`);

    // Post Conditions
    await page.agent.expect(`Only 'Walk the dog' is visible in the active view`);
    await page.agent.expect(`The todo counter shows '1 item left'`);
    await page.agent.expect(`Switching to 'All' or 'Completed' shows 'Buy groceries' is still there and checked`);
  });

});

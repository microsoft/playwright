import { test } from '../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test.describe('Todo Deletion', () => {

  test('Delete a single todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list`);

    await page.agent.perform(`Hover over the todo to reveal the delete button (×)`);
    await page.agent.expect(`The delete button becomes visible`);

    await page.agent.perform(`Click the delete button (×)`);
    await page.agent.expect(`The todo is removed from the list`);

    // Post Conditions
    await page.agent.expect(`The todo list is empty`);
    await page.agent.expect(`The footer and counter are hidden`);
  });

  test('Delete todo from multiple todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Hover over 'Walk the dog' to reveal the delete button`);
    await page.agent.expect(`The delete button becomes visible for 'Walk the dog'`);

    await page.agent.perform(`Click the delete button for 'Walk the dog'`);
    await page.agent.expect(`The 'Walk the dog' todo is removed`);

    // Post Conditions
    await page.agent.expect(`Only 'Buy groceries' and 'Read a book' remain in the list`);
    await page.agent.expect(`The todo counter shows '2 items left'`);
  });

  test('Clear all completed todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Mark 'Buy groceries' and 'Read a book' as complete`);
    await page.agent.expect(`Two todos are checked`);

    await page.agent.perform(`Click the 'Clear completed' button in the footer`);
    await page.agent.expect(`The completed todos are removed from the list`);

    // Post Conditions
    await page.agent.expect(`Only 'Walk the dog' remains in the list`);
    await page.agent.expect(`The todo counter shows '1 item left'`);
    await page.agent.expect(`The 'Clear completed' button is no longer visible`);
  });

  test('Clear completed when all are completed', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add two todos: 'Buy groceries', 'Walk the dog'`);
    await page.agent.expect(`Both todos appear in the list`);

    await page.agent.perform(`Mark both todos as complete`);
    await page.agent.expect(`Both todos are checked`);

    await page.agent.perform(`Click the 'Clear completed' button`);
    await page.agent.expect(`All todos are removed`);

    // Post Conditions
    await page.agent.expect(`The todo list is empty`);
    await page.agent.expect(`The footer and counter are hidden`);
    await page.agent.expect(`Only the input field remains visible`);
  });

  test('Delete completed todo individually', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list`);

    await page.agent.perform(`Mark the todo as complete`);
    await page.agent.expect(`The todo is checked`);

    await page.agent.perform(`Hover over the completed todo and click the delete button (×)`);
    await page.agent.expect(`The completed todo is removed`);

    // Post Conditions
    await page.agent.expect(`The todo list is empty`);
    await page.agent.expect(`The footer is hidden`);
  });

});

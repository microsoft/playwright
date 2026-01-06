import { test } from '../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test.describe('Todo Counter', () => {

  test('Counter updates when adding todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The counter shows '1 item left'`);

    await page.agent.perform(`Add a todo 'Walk the dog'`);
    await page.agent.expect(`The counter shows '2 items left'`);

    await page.agent.perform(`Add a todo 'Read a book'`);
    await page.agent.expect(`The counter shows '3 items left'`);

    // Post Conditions
    await page.agent.expect(`The counter accurately reflects the number of active todos`);
    await page.agent.expect(`The counter uses plural 'items' when count is not 1`);
  });

  test('Counter updates when completing todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`The counter shows '3 items left'`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`The counter shows '2 items left'`);

    await page.agent.perform(`Mark 'Walk the dog' as complete`);
    await page.agent.expect(`The counter shows '1 item left'`);

    await page.agent.perform(`Mark 'Read a book' as complete`);
    await page.agent.expect(`The counter shows '0 items left'`);

    // Post Conditions
    await page.agent.expect(`The counter decreases as todos are completed`);
    await page.agent.expect(`The counter uses singular 'item' when count is 1`);
  });

  test('Counter updates when deleting todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`The counter shows '3 items left'`);

    await page.agent.perform(`Delete 'Walk the dog' using the delete button (×)`);
    await page.agent.expect(`The counter shows '2 items left'`);

    // Post Conditions
    await page.agent.expect(`The counter decreases when an active todo is deleted`);
  });

  test('Counter unchanged when deleting completed todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add two todos: 'Buy groceries', 'Walk the dog'`);
    await page.agent.expect(`The counter shows '2 items left'`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`The counter shows '1 item left'`);

    await page.agent.perform(`Delete 'Buy groceries' using the delete button`);
    await page.agent.expect(`The counter still shows '1 item left'`);

    // Post Conditions
    await page.agent.expect(`The counter only counts active (uncompleted) todos`);
    await page.agent.expect(`Deleting completed todos doesn't affect the counter`);
  });

  test('Counter persists across filter views', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`The counter shows '3 items left'`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`The counter shows '2 items left'`);

    await page.agent.perform(`Click 'Active' filter`);
    await page.agent.expect(`The counter still shows '2 items left'`);

    await page.agent.perform(`Click 'Completed' filter`);
    await page.agent.expect(`The counter still shows '2 items left'`);

    // Post Conditions
    await page.agent.expect(`The counter always shows the count of active todos regardless of the current filter view`);
  });

});

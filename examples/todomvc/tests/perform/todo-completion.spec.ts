import { test } from '../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test.describe('Todo Completion', () => {

  test('Mark a single todo as complete', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list unchecked`);

    await page.agent.perform(`Click the checkbox next to 'Buy groceries'`);
    await page.agent.expect(`The checkbox becomes checked and the todo text may show visual indication of completion (strikethrough or style change)`);

    // Post Conditions
    await page.agent.expect(`The todo counter shows '0 items left'`);
    await page.agent.expect(`The 'Clear completed' button appears in the footer`);
  });

  test('Unmark a completed todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list unchecked`);

    await page.agent.perform(`Click the checkbox to mark it as complete`);
    await page.agent.expect(`The checkbox becomes checked`);

    await page.agent.perform(`Click the checkbox again to unmark it`);
    await page.agent.expect(`The checkbox becomes unchecked and the todo returns to active state`);

    // Post Conditions
    await page.agent.expect(`The todo counter shows '1 item left'`);
    await page.agent.expect(`The 'Clear completed' button is no longer visible`);
  });

  test('Mark all todos as complete', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list unchecked`);

    await page.agent.perform(`Click the '❯Mark all as complete' checkbox at the top of the list`);
    await page.agent.expect(`All three todos become checked`);

    // Post Conditions
    await page.agent.expect(`The todo counter shows '0 items left'`);
    await page.agent.expect(`The 'Clear completed' button appears`);
    await page.agent.expect(`The '❯Mark all as complete' checkbox is checked`);
  });

  test('Unmark all completed todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Click the '❯Mark all as complete' checkbox to mark all as complete`);
    await page.agent.expect(`All todos become checked`);

    await page.agent.perform(`Click the '❯Mark all as complete' checkbox again`);
    await page.agent.expect(`All todos become unchecked`);

    // Post Conditions
    await page.agent.expect(`The todo counter shows '3 items left'`);
    await page.agent.expect(`The 'Clear completed' button is no longer visible`);
    await page.agent.expect(`The '❯Mark all as complete' checkbox is unchecked`);
  });

  test('Mixed completion state', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add three todos: 'Buy groceries', 'Walk the dog', 'Read a book'`);
    await page.agent.expect(`All three todos appear in the list`);

    await page.agent.perform(`Mark 'Buy groceries' as complete`);
    await page.agent.expect(`First todo is checked`);

    await page.agent.perform(`Mark 'Read a book' as complete`);
    await page.agent.expect(`Third todo is checked`);

    // Post Conditions
    await page.agent.expect(`The todo counter shows '1 item left'`);
    await page.agent.expect(`The 'Clear completed' button is visible`);
    await page.agent.expect(`'Walk the dog' remains unchecked`);
    await page.agent.expect(`The '❯Mark all as complete' checkbox is unchecked (since not all are complete)`);
  });

});

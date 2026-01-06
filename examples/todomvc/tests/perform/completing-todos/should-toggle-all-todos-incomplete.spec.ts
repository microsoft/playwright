import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should toggle all todos incomplete', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3' and mark all as complete using the toggle all checkbox`);
  await page.agent.expect(`All todos are marked as complete`);
  await page.agent.expect(`Counter shows '0 items left'`);

  await page.agent.perform(`Click the 'Mark all as complete' checkbox again`);
  await page.agent.expect(`All todos are marked as active`);
  await page.agent.expect(`All checkboxes are unchecked`);
  await page.agent.expect(`Counter shows '3 items left'`);
  await page.agent.expect(`The 'Clear completed' button disappears`);
});

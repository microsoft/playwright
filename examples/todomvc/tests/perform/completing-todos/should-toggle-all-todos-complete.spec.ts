import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should toggle all todos complete', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3'`);
  await page.agent.expect(`All three todos are visible and active`);
  await page.agent.expect(`Counter shows '3 items left'`);

  await page.agent.perform(`Click the 'Mark all as complete' checkbox`);
  await page.agent.expect(`All three todos are marked as complete`);
  await page.agent.expect(`All checkboxes are checked`);
  await page.agent.expect(`Counter shows '0 items left'`);
  await page.agent.expect(`The 'Clear completed' button appears`);
});

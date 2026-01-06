import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should clear all completed todos', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3'`);
  await page.agent.expect(`All three todos are visible`);

  await page.agent.perform(`Mark 'Task 1' and 'Task 3' as complete by clicking their checkboxes`);
  await page.agent.expect(`Two todos are marked as complete`);
  await page.agent.expect(`Counter shows '1 item left'`);
  await page.agent.expect(`The 'Clear completed' button appears`);

  await page.agent.perform(`Click the 'Clear completed' button`);
  await page.agent.expect(`'Task 1' and 'Task 3' are removed from the list`);
  await page.agent.expect(`Only 'Task 2' remains visible`);
  await page.agent.expect(`Counter shows '1 item left'`);
  await page.agent.expect(`The 'Clear completed' button disappears`);
});

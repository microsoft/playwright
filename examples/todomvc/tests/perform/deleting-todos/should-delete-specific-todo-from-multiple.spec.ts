import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should delete specific todo from multiple', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Task 1', 'Task 2', 'Task 3'`);
  await page.agent.expect(`All three todos appear in the list`);
  await page.agent.expect(`Counter shows '3 items left'`);

  await page.agent.perform(`Hover over 'Task 2' and click its delete button`);
  await page.agent.expect(`'Task 2' is removed from the list`);
  await page.agent.expect(`'Task 1' and 'Task 3' remain visible`);
  await page.agent.expect(`Counter shows '2 items left'`);
});

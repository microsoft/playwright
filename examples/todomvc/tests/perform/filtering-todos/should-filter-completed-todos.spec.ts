import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should filter completed todos', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Active task', 'Completed 1', 'Completed 2'`);
  await page.agent.expect(`All three todos are visible`);

  await page.agent.perform(`Mark 'Completed 1' and 'Completed 2' as completed by clicking their checkboxes`);
  await page.agent.expect(`Two todos are marked as complete`);

  await page.agent.perform(`Click on the 'Completed' filter link`);
  await page.agent.expect(`The URL changes to #/completed`);
  await page.agent.expect(`Only 'Completed 1' and 'Completed 2' are displayed`);
  await page.agent.expect(`'Active task' is not visible`);
  await page.agent.expect(`The 'Completed' filter link is highlighted`);
});

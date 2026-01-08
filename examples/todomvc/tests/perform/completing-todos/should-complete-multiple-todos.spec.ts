import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should complete multiple todos', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Buy milk', 'Walk dog', 'Finish report'`);
  await page.agent.expect(`All three todos are visible`);
  await page.agent.expect(`Counter shows '3 items left'`);

  await page.agent.perform(`Complete the first todo by clicking its checkbox`);
  await page.agent.expect(`First todo is marked as complete`);
  await page.agent.expect(`Counter shows '2 items left'`);

  await page.agent.perform(`Complete the third todo by clicking its checkbox`);
  await page.agent.expect(`Third todo is marked as complete`);
  await page.agent.expect(`Counter shows '1 item left'`);
  await page.agent.expect(`The 'Clear completed' button appears`);
});

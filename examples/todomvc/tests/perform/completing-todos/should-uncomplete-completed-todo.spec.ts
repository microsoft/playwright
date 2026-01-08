import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should uncomplete completed todo', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Buy groceries' and mark it as complete by clicking its checkbox`);
  await page.agent.expect(`The todo is marked as complete`);
  await page.agent.expect(`Counter shows '0 items left'`);

  await page.agent.perform(`Click the checkbox again to uncomplete it`);
  await page.agent.expect(`The checkbox is unchecked`);
  await page.agent.expect(`Counter shows '1 item left'`);
  await page.agent.expect(`The 'Clear completed' button disappears`);
});

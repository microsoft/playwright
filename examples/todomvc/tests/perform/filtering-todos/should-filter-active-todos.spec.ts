import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should filter active todos', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Active 1', 'Active 2', 'Will complete'`);
  await page.agent.expect(`All three todos are visible`);

  await page.agent.perform(`Mark 'Will complete' as completed by clicking its checkbox`);
  await page.agent.expect(`One todo is marked as complete`);
  await page.agent.expect(`Counter shows '2 items left'`);

  await page.agent.perform(`Click on the 'Active' filter link`);
  await page.agent.expect(`The URL changes to #/active`);
  await page.agent.expect(`Only 'Active 1' and 'Active 2' are displayed`);
  await page.agent.expect(`'Will complete' is not visible`);
  await page.agent.expect(`The 'Active' filter link is highlighted`);
});

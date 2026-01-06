import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should persist todos after page reload', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos: 'Persistent 1', 'Persistent 2', 'Persistent 3'`);
  await page.agent.expect(`All three todos appear in the list`);

  await page.agent.perform(`Mark 'Persistent 2' as completed by clicking its checkbox`);
  await page.agent.expect(`'Persistent 2' is marked as complete`);

  await page.agent.perform(`Reload the page`);
  await page.agent.expect(`All three todos are still present after reload`);
  await page.agent.expect(`'Persistent 2' is still marked as complete`);
  await page.agent.expect(`The counter shows '2 items left'`);
});

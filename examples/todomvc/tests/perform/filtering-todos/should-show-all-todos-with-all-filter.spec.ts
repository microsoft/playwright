import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should show all todos with all filter', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add three todos and mark one as complete`);
  await page.agent.expect(`Three todos exist, one completed and two active`);

  await page.agent.perform(`Navigate to the 'Active' filter by clicking on it`);
  await page.agent.expect(`Only active todos are visible`);

  await page.agent.perform(`Click on the 'All' filter link`);
  await page.agent.expect(`The URL changes to #/`);
  await page.agent.expect(`All todos (both completed and active) are displayed`);
  await page.agent.expect(`The 'All' filter link is highlighted`);
});

import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should hide footer when no todos', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);
  await page.agent.expect(`The footer with counter and filters is not visible`);
  await page.agent.expect(`Only the input field and heading are visible`);

  await page.agent.perform(`Add a todo 'First task'`);
  await page.agent.expect(`The footer appears with counter '1 item left' and filter links`);

  await page.agent.perform(`Delete the todo by hovering over it and clicking the delete button`);
  await page.agent.expect(`The footer is hidden again`);
});

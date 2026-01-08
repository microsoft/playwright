import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should trim whitespace when editing', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Original task'`);
  await page.agent.expect(`The todo appears in the list`);

  await page.agent.perform(`Double-click to edit and change text to '   Edited task   ' (with leading and trailing spaces)`);
  await page.agent.expect(`Edit textbox shows the text with spaces`);

  await page.agent.perform(`Press Enter to save`);
  await page.agent.expect(`The todo is saved as 'Edited task' without leading or trailing whitespace`);
});

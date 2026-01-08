import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should edit todo by double clicking', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Buy milk'`);
  await page.agent.expect(`The todo appears in the list`);

  await page.agent.perform(`Double-click on the todo text`);
  await page.agent.expect(`The todo enters edit mode`);
  await page.agent.expect(`An edit textbox appears with the current text 'Buy milk'`);
  await page.agent.expect(`The textbox is focused`);

  await page.agent.perform(`Change the text to 'Buy organic milk' and press Enter`);
  await page.agent.expect(`The todo is updated to 'Buy organic milk'`);
  await page.agent.expect(`Edit mode is exited`);
  await page.agent.expect(`The updated text is displayed in the list`);
});

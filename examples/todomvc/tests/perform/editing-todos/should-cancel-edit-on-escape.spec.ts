import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should cancel edit on escape', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Original text'`);
  await page.agent.expect(`The todo appears in the list`);

  await page.agent.perform(`Double-click on the todo to enter edit mode`);
  await page.agent.expect(`Edit textbox appears with 'Original text'`);

  await page.agent.perform(`Change the text to 'Modified text' but press Escape instead of Enter`);
  await page.agent.expect(`Edit mode is cancelled`);
  await page.agent.expect(`The todo text reverts to 'Original text'`);
  await page.agent.expect(`Changes are not saved`);
});

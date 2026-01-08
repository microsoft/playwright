import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should delete todo when edited to empty', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Temporary task'`);
  await page.agent.expect(`The todo appears in the list`);
  await page.agent.expect(`Counter shows '1 item left'`);

  await page.agent.perform(`Double-click on the todo to enter edit mode`);
  await page.agent.expect(`Edit textbox appears`);

  await page.agent.perform(`Clear all the text and press Enter`);
  await page.agent.expect(`The todo is deleted from the list`);
  await page.agent.expect(`The list is empty`);
  await page.agent.expect(`Counter shows '0 items left' or the footer is hidden`);
});

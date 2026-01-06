import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should complete single todo', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Buy groceries'`);
  await page.agent.expect(`The todo appears as active`);
  await page.agent.expect(`Counter shows '1 item left'`);

  await page.agent.perform(`Click the checkbox next to the todo`);
  await page.agent.expect(`The checkbox is checked`);
  await page.agent.expect(`Counter shows '0 items left'`);
  await page.agent.expect(`The 'Clear completed' button appears in the footer`);
});

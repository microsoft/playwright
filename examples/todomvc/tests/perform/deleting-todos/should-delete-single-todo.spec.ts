import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should delete single todo', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Task to delete'`);
  await page.agent.expect(`The todo appears in the list`);
  await page.agent.expect(`Counter shows '1 item left'`);

  await page.agent.perform(`Hover over the todo item`);
  await page.agent.expect(`A delete button (x) appears on the right side of the todo`);

  await page.agent.perform(`Click the delete button`);
  await page.agent.expect(`The todo is removed from the list`);
  await page.agent.expect(`The list is empty`);
  await page.agent.expect(`The footer is hidden or shows '0 items left'`);
});

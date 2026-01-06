import { test } from '../../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test('should save edit on blur', async ({ page }) => {
  await page.agent.expect(`The page loads with an empty todo list`);

  await page.agent.perform(`Add a todo 'Call dentist'`);
  await page.agent.expect(`The todo appears in the list`);

  await page.agent.perform(`Double-click on the todo to enter edit mode`);
  await page.agent.expect(`Edit textbox appears`);

  await page.agent.perform(`Change the text to 'Schedule dentist appointment' and click elsewhere to blur the input`);
  await page.agent.expect(`The changes are saved`);
  await page.agent.expect(`The todo text is updated to 'Schedule dentist appointment'`);
  await page.agent.expect(`Edit mode is exited`);
});

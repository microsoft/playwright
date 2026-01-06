import { test } from '../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test.describe('Todo Editing', () => {

  test('Edit todo text', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list`);

    await page.agent.perform(`Double-click on the todo text 'Buy groceries'`);
    await page.agent.expect(`The todo enters edit mode with a text input showing 'Buy groceries'`);

    await page.agent.perform(`Clear the text and type 'Buy groceries and milk'`);
    await page.agent.expect(`The new text appears in the edit field`);

    await page.agent.perform(`Press Enter to save the changes`);
    await page.agent.expect(`The todo exits edit mode and displays 'Buy groceries and milk'`);

    // Post Conditions
    await page.agent.expect(`The todo shows the updated text`);
    await page.agent.expect(`The todo remains in its original completion state`);
  });

  test('Cancel editing with Escape', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list`);

    await page.agent.perform(`Double-click on the todo text to enter edit mode`);
    await page.agent.expect(`The edit input appears with 'Buy groceries'`);

    await page.agent.perform(`Change the text to 'Something else'`);
    await page.agent.expect(`The new text appears in the edit field`);

    await page.agent.perform(`Press Escape key`);
    await page.agent.expect(`The edit is cancelled and the original text 'Buy groceries' is preserved`);

    // Post Conditions
    await page.agent.expect(`The todo shows the original text 'Buy groceries'`);
    await page.agent.expect(`The todo is no longer in edit mode`);
  });

  test('Delete todo by clearing text', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list`);

    await page.agent.perform(`Double-click on the todo text to enter edit mode`);
    await page.agent.expect(`The edit input appears`);

    await page.agent.perform(`Clear all the text in the edit field`);
    await page.agent.expect(`The edit field is empty`);

    await page.agent.perform(`Press Enter to save`);
    await page.agent.expect(`The todo is removed from the list`);

    // Post Conditions
    await page.agent.expect(`The todo list is empty`);
    await page.agent.expect(`The todo counter and footer controls are hidden`);
  });

  test('Edit completed todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add a todo 'Buy groceries'`);
    await page.agent.expect(`The todo appears in the list`);

    await page.agent.perform(`Mark the todo as complete by clicking its checkbox`);
    await page.agent.expect(`The todo is marked as complete`);

    await page.agent.perform(`Double-click on the completed todo text`);
    await page.agent.expect(`The todo enters edit mode`);

    await page.agent.perform(`Change the text to 'Buy groceries and milk' and press Enter`);
    await page.agent.expect(`The todo text is updated`);

    // Post Conditions
    await page.agent.expect(`The todo shows the updated text 'Buy groceries and milk'`);
    await page.agent.expect(`The todo remains in completed state (checked)`);
  });

});

import { test } from '../fixtures';

test.use({
  agent: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  }
});

test.describe('Todo Creation', () => {

  test('Add a single todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list and input field 'What needs to be done?' is visible`);

    await page.agent.perform(`Type 'Buy groceries' into the input field`);
    await page.agent.expect(`The text appears in the input field`);

    await page.agent.perform(`Press Enter to submit the todo`);
    await page.agent.expect(`The todo 'Buy groceries' appears in the list and the input field is cleared`);

    // Post Conditions
    await page.agent.expect(`The todo counter shows '1 item left'`);
    await page.agent.expect(`The new todo is unchecked (active state)`);
  });

  test('Add multiple todos', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Add first todo 'Buy groceries' by typing and pressing Enter`);
    await page.agent.expect(`The first todo appears in the list`);

    await page.agent.perform(`Add second todo 'Walk the dog' by typing and pressing Enter`);
    await page.agent.expect(`The second todo appears in the list below the first`);

    await page.agent.perform(`Add third todo 'Read a book' by typing and pressing Enter`);
    await page.agent.expect(`The third todo appears in the list below the second`);

    // Post Conditions
    await page.agent.expect(`All three todos are visible in the list`);
    await page.agent.expect(`The todo counter shows '3 items left'`);
    await page.agent.expect(`All todos are in active (unchecked) state`);
  });

  test('Prevent adding empty todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Click into the input field without typing anything and press Enter`);
    await page.agent.expect(`No todo is added to the list`);

    // Post Conditions
    await page.agent.expect(`The todo list remains empty`);
    await page.agent.expect(`The input field is still focused and empty`);
  });

  test('Prevent adding whitespace-only todo', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Type only spaces '   ' into the input field and press Enter`);
    await page.agent.expect(`No todo is added to the list`);

    // Post Conditions
    await page.agent.expect(`The todo list remains empty`);
    await page.agent.expect(`The input field is cleared or shows the spaces`);
  });

  test('Add todo with special characters', async ({ page }) => {
    await page.agent.expect(`The page loads with an empty todo list`);

    await page.agent.perform(`Type 'Buy @groceries & supplies (urgent!)' into the input field and press Enter`);
    await page.agent.expect(`The todo appears in the list with all special characters preserved`);

    // Post Conditions
    await page.agent.expect(`The todo displays exactly as entered with special characters`);
    await page.agent.expect(`The todo counter shows '1 item left'`);
  });

});

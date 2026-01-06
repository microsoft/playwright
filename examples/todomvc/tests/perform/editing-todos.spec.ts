import { test } from '../fixtures';

test.use({
  agent: {
    provider: 'github',
    model: 'gpt-4.1',
  }
});

test.describe('Editing Todos', () => {

  test('should edit todo successfully', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Double-click on the todo text "Buy groceries"`);
    await page.agent.perform(`Clear the existing text`);
    await page.agent.perform(`Type "Buy groceries and milk"`);
    await page.agent.perform(`Press Enter`);

    await page.agent.expect(`Todo enters edit mode (input field appears)`);
    await page.agent.expect(`Original text is pre-populated in the edit field`);
    await page.agent.expect(`After pressing Enter, todo text updates to "Buy groceries and milk"`);
    await page.agent.expect(`Todo exits edit mode`);
    await page.agent.expect(`Todo remains in the same state (active/completed)`);
  });

  test('should cancel edit with escape', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Double-click on the todo text`);
    await page.agent.perform(`Type "Changed text"`);
    await page.agent.perform(`Press Escape key`);

    await page.agent.expect(`Todo exits edit mode`);
    await page.agent.expect(`Original text "Buy groceries" is preserved`);
    await page.agent.expect(`Changes are discarded`);
    await page.agent.expect(`Todo remains in the same state`);
  });

  test('should delete todo by clearing text', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Double-click on the todo text`);
    await page.agent.perform(`Clear all text (delete all characters)`);
    await page.agent.perform(`Press Enter`);

    await page.agent.expect(`Todo is removed from the list`);
    await page.agent.expect(`Counter decrements appropriately`);
    await page.agent.expect(`If no todos remain, counter and controls disappear`);
  });

  test('should edit completed todo', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Click the checkbox to complete it`);
    await page.agent.perform(`Double-click on the todo text`);
    await page.agent.perform(`Type "Buy groceries and milk"`);
    await page.agent.perform(`Press Enter`);

    await page.agent.expect(`Todo enters edit mode`);
    await page.agent.expect(`Todo text is successfully updated`);
    await page.agent.expect(`Todo remains in completed state after editing`);
    await page.agent.expect(`Checkbox remains checked`);
  });

});


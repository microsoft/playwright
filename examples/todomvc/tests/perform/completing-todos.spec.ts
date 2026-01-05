import { test } from '../fixtures';

test.use({
  agent: {
    provider: 'github',
    model: 'gpt-4.1',
  }
});

test.describe('Completing Todos', () => {

  test('should complete single todo', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Click the checkbox next to "Buy groceries"`);

    await page.agent.expect(`Checkbox becomes checked`);
    await page.agent.expect(`Todo text may show visual indication of completion (strikethrough or style change)`);
    await page.agent.expect(`Counter shows "0 items left"`);
    await page.agent.expect(`"Clear completed" button appears`);
    await page.agent.expect(`Delete button becomes visible on hover`);
  });

  test('should complete multiple todos', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Add "Walk the dog" todo item`);
    await page.agent.perform(`Add "Read a book" todo item`);
    await page.agent.perform(`Click the checkbox next to "Buy groceries"`, { key: 'click buy groceries with multiple todos'});
    await page.agent.perform(`Click the checkbox next to "Read a book"`);

    await page.agent.expect(`Both selected todos show as completed`);
    await page.agent.expect(`Counter shows "1 item left" (only "Walk the dog" remaining)`);
    await page.agent.expect(`"Clear completed" button appears`);
    await page.agent.expect(`One todo remains active`);
  });

  test('should uncomplete todo', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Click the checkbox to complete it`);
    await page.agent.perform(`Click the checkbox again to uncomplete it`);

    await page.agent.expect(`Checkbox becomes unchecked`);
    await page.agent.expect(`Todo returns to active state`);
    await page.agent.expect(`Counter shows "1 item left"`);
    await page.agent.expect(`"Clear completed" button disappears`);
  });

  test('should mark all as complete', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Add "Walk the dog" todo item`);
    await page.agent.perform(`Add "Read a book" todo item`);
    await page.agent.perform(`Click the "Mark all as complete" checkbox (chevron icon)`);

    await page.agent.expect(`All todos show as completed`);
    await page.agent.expect(`All individual checkboxes are checked`);
    await page.agent.expect(`"Mark all as complete" checkbox is checked`);
    await page.agent.expect(`Counter shows "0 items left"`);
    await page.agent.expect(`"Clear completed" button appears`);
  });

  test('should unmark all as complete', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries" todo item`);
    await page.agent.perform(`Add "Walk the dog" todo item`);
    await page.agent.perform(`Add "Read a book" todo item`);
    await page.agent.perform(`Click the "Mark all as complete" checkbox to complete all`);
    await page.agent.perform(`Click the "Mark all as complete" checkbox again`);

    await page.agent.expect(`All todos return to active state`);
    await page.agent.expect(`All individual checkboxes are unchecked`);
    await page.agent.expect(`"Mark all as complete" checkbox is unchecked`);
    await page.agent.expect(`Counter shows "3 items left"`);
    await page.agent.expect(`"Clear completed" button disappears`);
  });

});


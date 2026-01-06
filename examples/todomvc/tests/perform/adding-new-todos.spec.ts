import { test } from '../fixtures';

test.use({
  agent: {
    provider: 'github',
    model: 'gpt-4.1',
  }
});

test.describe('Adding New Todos', () => {

  test('should add single valid todo', async ({ page }) => {
    await page.agent.perform(`Click in the "What needs to be done?" input field`);
    await page.agent.perform(`Add "Buy groceries" todo item`);

    await page.agent.expect(`Todo item "Buy groceries" appears in the list`);
    await page.agent.expect(`Counter shows "1 item left"`);
    await page.agent.expect(`Input field is cleared and ready for next entry`);
    await page.agent.expect(`"Mark all as complete" checkbox becomes visible`);
  });

  test('should add multiple todos', async ({ page }) => {
    await page.agent.perform(`Add "Buy groceries", todo item`);
    await page.agent.perform(`Add "Walk the dog" todo item`);
    await page.agent.perform(`Add "Read a book" todo item`);

    await page.agent.expect('All three todos appear in the list in order of creation');
    await page.agent.expect(`Each todo has an unchecked checkbox`);
    await page.agent.expect(`Counter shows "3 items left" (plural)`);
    await page.agent.expect(`Input field is cleared`);
  });


  test('should reject empty todo', async ({ page }) => {
    await page.agent.perform(`Click in the "What needs to be done?" input field`);
    await page.agent.perform(`Press Enter without typing any text`);

    await page.agent.expect(`No todo is added to the list`);
    await page.agent.expect(`Todo list remains empty`);
    await page.agent.expect(`Counter is not displayed`);
    await page.agent.expect(`Input field remains focused`);
  });

  test('should add todo with special characters', async ({ page }) => {
    await page.agent.perform(`Add "Test with special chars: @#$%^&*()" todo item`);
    await page.agent.expect(`Todo item "Test with special chars: @#$%^&*()" appears in the list`);
  });

  test('should add todo with long text', async ({ page }) => {
    await page.agent.perform(`Add "This is a very long todo item to test the character limit and see how the application handles extremely long text inputs that might break the layout or cause other issues" todo item`);
    await page.agent.expect(`Todo item "This is a very long todo item to test the character limit and see how the application handles extremely long text inputs that might break the layout or cause other issues" appears in the list`);
  });

});

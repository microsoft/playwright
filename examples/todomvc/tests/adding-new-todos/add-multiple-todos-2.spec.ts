import { test } from '../fixtures';

test.use({
  agent: {
    provider: 'github',
    model: 'gpt-4.1',
  }
});

test.describe('Adding New Todos', () => {
  test('should add multiple todos', async ({ page }) => {
    page.on('agentturn', turn => {
      console.log('agentturn', turn.role, turn.message);
    })
    await page.perform(`Add "Buy groceries", todo item`);
    await page.perform(`Add "Walk the dog" todo item`);
    await page.perform(`Add "Read a book" todo item`);

    await page.perform(`Ensure each todo has an unchecked checkbox`);
    await page.perform(`Ensure counter shows "3 items left" (plural)`);
    await page.perform(`Ensure input field is cleared`);
  });
});

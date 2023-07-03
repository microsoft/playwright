import { Page } from "playwright-core";

export async function createTodos(page: Page) {

  const TODO_ITEMS = [
    'buy some cheese',
    'feed the cat',
    'book a doctors appointment'
  ];

  await page.goto('https://demo.playwright.dev/todomvc');

  // delete all todos
  await page.evaluate(() => {
    if (localStorage?.length) {
      localStorage.clear();
      location.reload();
    }
  });

  // create a new todo locator
  const newTodo = page.getByPlaceholder('What needs to be done?');

  for (const item of TODO_ITEMS) {
    await newTodo.fill(item);
    await newTodo.press('Enter');
  }
}

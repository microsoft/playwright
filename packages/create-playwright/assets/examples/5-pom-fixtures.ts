import { test as base } from '@playwright/test';
import { TodoPage } from './4-todo.pom';

// This adds a todoPage fixture which has access to the page instance.
// More information: https://playwright.dev/docs/test-fixtures
export const test = base.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    await use(new TodoPage(page));
  },
});

export const expect = test.expect;

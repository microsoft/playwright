import { Page } from '@playwright/test';

export class TodoPage {
  // Locators are used to reflect a element on the page with a selector.
  // See here: https://playwright.dev/docs/api/class-locator
  listItems = this.page.locator('.todo-list li');
  inputBox = this.page.locator('input.new-todo');
  filterByActiveItemsButton = this.page.locator('.filters >> text=Active');
  filterByCompletedItemsButton = this.page.locator('.filters >> text=Completed');

  constructor(private readonly page: Page) { }

  async addItem(text: string) {
    await this.inputBox.fill(text);
    await this.inputBox.press('Enter');
  }

  async goto() {
    await this.page.goto('https://todomvc.com/examples/vanilla-es6/');
  }
}
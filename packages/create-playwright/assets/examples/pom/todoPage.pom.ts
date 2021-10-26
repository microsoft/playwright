import { Page } from '@playwright/test';

/**
 * This is a Page Object Model (POM) class for the application's Todo page. It
 * provides locators and common operations that make writing tests easier.
 * @see https://playwright.dev/docs/test-pom
 */
export class TodoPage {
  /**
   * Locators are used to reflect a element on the page with a selector.
   * @see https://playwright.dev/docs/api/class-locator
   */
  listItems = this.page.locator('.todo-list li');
  inputBox = this.page.locator('input.new-todo');
  filterByActiveItemsButton = this.page.locator('.filters >> text=Active');
  filterByCompletedItemsButton = this.page.locator('.filters >> text=Completed');

  constructor(public readonly page: Page) { }

  async addItem(text: string) {
    await this.inputBox.fill(text);
    await this.inputBox.press('Enter');
  }

  async goto() {
    await this.page.goto('https://todomvc.com/examples/vanilla-es6/');
  }
}

import { Page } from "@playwright/test";

export class BasePage {
  readonly page: Page;
  constructor(page: Page) {
    this.page = page;
  }
}

export { expect, Page } from "@playwright/test";

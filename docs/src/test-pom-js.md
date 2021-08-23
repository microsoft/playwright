---
id: test-pom
title: "Page Object Model"
---

Page Object Model is a common pattern that introduces abstractions over web app pages to simplify interactions with them in multiple tests. It is best explained by an example.

We will create a `PlaywrightDevPage` helper class to encapsulate common operations on the `playwright.dev` page. Internally, it will use the `page` object.

```js js-flavor=js
// playwright-dev-page.js
const { expect } = require('@playwright/test');

exports.PlaywrightDevPage = class PlaywrightDevPage {

  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.getStartedLink = page.locator('text=Get started');
    this.coreConceptsLink = page.locator('text=Core concepts');
    this.tocList = page.locator('article ul > li > a');
  }

  async goto() {
    await this.page.goto('https://playwright.dev');
  }

  async getStarted() {
    await this.getStartedLink.first().click();
    await expect(this.coreConceptsLink).toBeVisible();
  }

  async coreConcepts() {
    await this.getStarted();
    await this.page.click('text=Guides');
    await this.coreConceptsLink.click();
    await expect(this.page.locator('h1').locator("text=Core concepts")).toBeVisible();
  }
}
```

```js js-flavor=ts
// playwright-dev-page.ts
import { expect, Locator, Page } from '@playwright/test';

export class PlaywrightDevPage {
  readonly page: Page;
  readonly getStartedLink: Locator;
  readonly coreConceptsLink: Locator;
  readonly tocList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.getStartedLink = page.locator('text=Get started');
    this.coreConceptsLink = page.locator('text=Core concepts');
    this.tocList = page.locator('article ul > li > a');
  }

  async goto() {
    await this.page.goto('https://playwright.dev');
  }

  async getStarted() {
    await this.getStartedLink.first().click();
    await expect(this.coreConceptsLink).toBeVisible();
  }

  async coreConcepts() {
    await this.getStarted();
    await this.page.click('text=Guides');
    await this.coreConceptsLink.click();
    await expect(this.page.locator('h1').locator("text=Core concepts")).toBeVisible();
  }
}
```

Now we can use the `PlaywrightDevPage` class in our tests.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');
const { PlaywrightDevPage } = require('./playwright-dev-page');

test('Get Started table of contents', async ({ page }) => {
  const playwrightDev = new PlaywrightDevPage(page);
  await playwrightDev.goto();
  await playwrightDev.getStarted();
  await expect(playwrightDev.tocList).toHaveText([
    'Installation',
    'First test',
    'Writing assertions',
    'Using test fixtures',
    'Using test hooks',
    'Learning the command line',
    'Creating a configuration file',
    'Release notes',
  ]);
});

test('Core Concepts table of contents', async ({ page }) => {
  const playwrightDev = new PlaywrightDevPage(page);
  await playwrightDev.goto();
  await playwrightDev.coreConcepts();
  await expect(playwrightDev.tocList.first()).toHaveText('Browser');
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';
import { PlaywrightDevPage } from './playwright-dev-page';

test('Get Started table of contents', async ({ page }) => {
  const playwrightDev = new PlaywrightDevPage(page);
  await playwrightDev.goto();
  await playwrightDev.getStarted();
  await expect(playwrightDev.tocList).toHaveText([
    'Installation',
    'First test',
    'Writing assertions',
    'Using test fixtures',
    'Using test hooks',
    'Learning the command line',
    'Creating a configuration file',
    'Release notes',
  ]);
});

test('Core Concepts table of contents', async ({ page }) => {
  const playwrightDev = new PlaywrightDevPage(page);
  await playwrightDev.goto();
  await playwrightDev.coreConcepts();
  await expect(playwrightDev.tocList.first()).toHaveText('Browser');
});
```

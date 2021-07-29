---
id: test-pom
title: "Page Object Model"
---

Page Object Model is a common pattern that introduces abstractions over web app pages to simplify interactions with them in multiple tests. It is best explained by an example.

We will create a `PlaywrightDevPage` helper class to encapsulate common operations on the `playwright.dev` page. Internally, it will use the `page` object.

```js js-flavor=js
// playwright-dev-page.js
exports.PlaywrightDevPage = class PlaywrightDevPage {
  /**
   * @param {import('playwright').Page} page 
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('https://playwright.dev');
  }

  async toc() {
    const text = await this.page.innerText('article ul');
    return text.split('\n').filter(line => !!line);
  }

  async getStarted() {
    await this.page.click('text=Get started');
    await this.page.waitForSelector(`text=Core concepts`);
  }

  async coreConcepts() {
    await this.getStarted();
    await this.page.click('text=Core concepts');
    await this.page.waitForSelector(`h1:has-text("Core concepts")`);
  }
}
```

```js js-flavor=ts
// playwright-dev-page.ts
import type { Page } from 'playwright';

export class PlaywrightDevPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('https://playwright.dev');
  }

  async toc() {
    const text = await this.page.innerText('article ul');
    return text.split('\n').filter(line => !!line);
  }

  async getStarted() {
    await this.page.click('text=Get started');
    await this.page.waitForSelector(`text=Core concepts`);
  }

  async coreConcepts() {
    await this.getStarted();
    await this.page.click('text=Core concepts');
    await this.page.waitForSelector(`h1:has-text("Core concepts")`);
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
  expect(await playwrightDev.toc()).toEqual([
    'Installation',
    'Usage',
    'First script',
    'Record scripts',
    'TypeScript support',
    'System requirements',
    'Release notes'
  ]);
});

test('Core Concepts table of contents', async ({ page }) => {
  const playwrightDev = new PlaywrightDevPage(page);
  await playwrightDev.goto();
  await playwrightDev.coreConcepts();
  expect(await playwrightDev.toc()).toEqual([
    'Browser',
    'Browser contexts',
    'Pages and frames',
    'Selectors',
    'Auto-waiting',
    'Execution contexts: Playwright and Browser',
    'Evaluation Argument'
  ]);
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
  expect(await playwrightDev.toc()).toEqual([
    'Installation',
    'Usage',
    'First script',
    'Record scripts',
    'TypeScript support',
    'System requirements',
    'Release notes'
  ]);
});

test('Core Concepts table of contents', async ({ page }) => {
  const playwrightDev = new PlaywrightDevPage(page);
  await playwrightDev.goto();
  await playwrightDev.coreConcepts();
  expect(await playwrightDev.toc()).toEqual([
    'Browser',
    'Browser contexts',
    'Pages and frames',
    'Selectors',
    'Auto-waiting',
    'Execution contexts: Playwright and Browser',
    'Evaluation Argument'
  ]);
});
```

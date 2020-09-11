# Page Object Models
Large test suites can be structured to optimize ease of authoring and maintenance.
Page object models are one such approach to structure your test suite.

<!-- GEN:toc-top-level -->
- [Introduction](#introduction)
- [Implementation](#implementation)
<!-- GEN:stop -->

## Introduction
A page object represents a part of your web application. An e-commerce web
application might have a home page, a listings page and a checkout page. Each of
them can be represented by page object models.

Page objects **simplify authoring**. They create a higher-level API which suits
your application.

Page objects **simplify maintenance**. They capture element selectors in one place
and create reusable code to avoid repetition.

## Implementation
Page object models wrap over a Playwright [`page`](./api.md#class-page).

```js
// models/Search.js
class SearchPage {
  constructor(page) {
    this.page = page;
  }
  async navigate() {
    await this.page.goto('https://bing.com');
  }
  async search(text) {
    await this.page.fill('[aria-label="Enter your search term"]', text);
    await this.page.keyboard.press('Enter');
  }
}
module.exports = { SearchPage };
```

Page objects can then be used inside a test.

```js
// search.spec.js
const { SearchPage } = require('./models/Search');

// In the test
const page = await browser.newPage();
const searchPage = new SearchPage(page);
await searchPage.navigate();
await searchPage.search('search query');
```

### API reference
- [class `Page`](./api.md#class-page)

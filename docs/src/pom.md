---
id: pom
title: "Page Object Models"
---

Large test suites can be structured to optimize ease of authoring and maintenance. Page object models are one such
approach to structure your test suite.

<!-- TOC -->

## Introduction

A page object represents a part of your web application. An e-commerce web application might have a home page, a
listings page and a checkout page. Each of them can be represented by page object models.

Page objects **simplify authoring**. They create a higher-level API which suits your application.

Page objects **simplify maintenance**. They capture element selectors in one place and create reusable code to avoid
repetition.

## Implementation

Page object models wrap over a Playwright [Page].

```js
// models/Search.js
class SearchPage {
  /**
   * @param {import('playwright').Page} page 
   */
  constructor(page) {
    this.page = page;
  }
  async navigate() {
    await this.page.goto('https://bing.com');
  }
  async search(text) {
    await this.page.fill('[aria-label="Enter your search term"]', text);
    await this.page.press('[aria-label="Enter your search term"]', 'Enter');
  }
}
module.exports = { SearchPage };
```

```java
// models/SearchPage.java
package models;

import com.microsoft.playwright;

public class SearchPage {
  private final Page page;

  public SearchPage(Page page) {
    this.page = page;
  }

  public void navigate() {
    page.navigate("https://bing.com");
  }

  public void search(String text) {
    page.fill("[aria-label='Enter your search term']", text);
    page.press("[aria-label='Enter your search term']", "Enter");
  }
}
```

```python async
# models/search.py
class SearchPage:
    def __init__(self, page):
        self.page = page

    async def navigate(self):
        await self.page.goto("https://bing.com")

    async def search(self, text):
        await self.page.fill('[aria-label="Enter your search term"]', text)
        await self.page.press('[aria-label="Enter your search term"]', "Enter")
```

```python sync
# models/search.py
class SearchPage:
    def __init__(self, page):
        self.page = page

    def navigate(self):
        self.page.goto("https://bing.com")

    def search(self, text):
        self.page.fill('[aria-label="Enter your search term"]', text)
        self.page.press('[aria-label="Enter your search term"]', "Enter")
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

```java
import models.SearchPage;
import com.microsoft.playwright.*;
...

// In the test
Page page = browser.newPage();
SearchPage searchPage = new SearchPage(page);
searchPage.navigate();
searchPage.search("search query");
```

```python async
# test_search.py
from models.search import SearchPage

# in the test
page = await browser.new_page()
search_page = SearchPage(page)
await search_page.navigate()
await search_page.search("search query")
```

```python sync
# test_search.py
from models.search import SearchPage

# in the test
page = browser.new_page()
search_page = SearchPage(page)
search_page.navigate()
search_page.search("search query")
```

### API reference
- [Page]
---
id: browser-contexts
title: "Isolation"
---

Tests written with Playwright execute in isolated clean-slate environments called browser contexts. This isolation model improves reproducibility and prevents cascading test failures. 

[BrowserContext]s are equivalent to incognito-like profiles, they are fast and cheap to create and completely isolated, even when running in a single browser. Playwright creates a context for each test, and provides a default [Page] in that context.

When using Playwright as a Test Runner, this happens out of the box for each test. Otherwise, you can create browser contexts manually.

```js tab=js-ts
const { test } = require('@playwright/test');

test('example test', async ({ page, context }) => {
  // "context" is an isolated BrowserContext, created for this specific test.
  // "page" belongs to this context.
});

test('another test', async ({ page, context }) => {
  // "context" and "page" in this second test are completely
  // isolated from the first test.
});
```

```js tab=js-js
import { test } from '@playwright/test';

test('example test', async ({ page, context }) => {
  // "context" is an isolated BrowserContext, created for this specific test.
  // "page" belongs to this context.
});

test('another test', async ({ page, context }) => {
  // "context" and "page" in this second test are completely
  // isolated from the first test.
});
```

```js tab=js-library
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
```

```java
Browser browser = chromium.launch();
BrowserContext context = browser.newContext();
Page page = context.newPage();
```

```python async
browser = await playwright.chromium.launch()
context = await browser.new_context()
page = await context.new_page()
```

```python sync
browser = playwright.chromium.launch()
context = browser.new_context()
page = context.new_page()
```

```csharp
await using var browser = playwright.Chromium.LaunchAsync();
var context = await browser.NewContextAsync();
var page = await context.NewPageAsync();
```

Browser contexts can also be used to emulate multi-page scenarios involving mobile devices, permissions, locale and color scheme. Check out our [Emulation](./emulation.md) guide for more details.

## Multiple contexts in a single test

Playwright can create multiple browser contexts within a single scenario. This is useful when you want to test for multi-user functionality, like a chat.

```js tab=js-js
import { test } from '@playwright/test';

test('admin and user', async ({ browser }) => {
  // Create two isolated browser contexts
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();
  
  // Create pages and interact with contexts independently
  const adminPage = await adminContext.newPage();
  const userPage = await userContext.newPage();
});
```

```js tab=js-ts
const { test } = require('@playwright/test');

test('admin and user', async ({ browser }) => {
  // Create two isolated browser contexts
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();
  
  // Create pages and interact with contexts independently
  const adminPage = await adminContext.newPage();
  const userPage = await userContext.newPage();
});
```

```js tab=js-library
const { chromium } = require('playwright');

// Create a Chromium browser instance
const browser = await chromium.launch();

// Create two isolated browser contexts
const userContext = await browser.newContext();
const adminContext = await browser.newContext();

// Create pages and interact with contexts independently
const adminPage = await adminContext.newPage();
const userPage = await userContext.newPage();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      // Create a Chromium browser instance
      Browser browser = chromium.launch();
      // Create two isolated browser contexts
      BrowserContext userContext = browser.newContext();
      BrowserContext adminContext = browser.newContext();
      // Create pages and interact with contexts independently
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    # create a chromium browser instance
    chromium = playwright.chromium
    browser = await chromium.launch()

    # create two isolated browser contexts
    user_context = await browser.new_context()
    admin_context = await browser.new_context()

    # create pages and interact with contexts independently

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    # create a chromium browser instance
    chromium = playwright.chromium
    browser = chromium.launch()

    # create two isolated browser contexts
    user_context = browser.new_context()
    admin_context = browser.new_context()

    # create pages and interact with contexts independently

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        // Create a Chromium browser instance
        await using var browser = await playwright.Chromium.LaunchAsync();
        await using var userContext = await browser.NewContextAsync();
        await using var adminContext = await browser.NewContextAsync();
        // Create pages and interact with contexts independently.
    }
}
```

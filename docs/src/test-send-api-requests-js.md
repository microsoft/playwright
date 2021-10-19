---
id: test-send-api-requests
title: "Send API requests"
---

While running tests inside browsers you may want to make calls to the HTTP API of your application. It may be helpful if you need to prepare server state before running a test or to check some postconditions on the server after performing some actions in the browser. All of that could be achieved via [APIRequestContext] methods.

<!-- TOC -->

## Establishing preconditions

The following test creates a new issue via API and then navigates to the list of all issues in the
project to check that it appears at the top of the list.

```js js-flavor=ts
import { test, expect } from '@playwright/test';

const REPO = 'test-repo-1';
const USER = 'github-username';

// Request context is reused by all tests in the file.
let apiContext;

test.beforeAll(async ({ playwright }) => {
  apiContext = await playwright.request.newContext({
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  });
})

test.afterAll(async ({ }) => {
  // Dispose all responses.
  await apiContext.dispose();
});

test('last created issue should be first in the list', async ({ page }) => {
  const newIssue = await apiContext.post(`/repos/${USER}/${REPO}/issues`, {
    data: {
      title: '[Feature] request 1',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  await page.goto(`https://github.com/${USER}/${REPO}/issues`);
  const firstIssue = page.locator(`a[data-hovercard-type='issue']`).first();
  await expect(firstIssue).toHaveText('[Feature] request 1');
});
```

```js js-flavor=js
// @ts-check
const { test, expect } = require('@playwright/test');

const REPO = 'test-repo-1';
const USER = 'github-username';

// Request context is reused by all tests in the file.
let apiContext;

test.beforeAll(async ({ playwright }) => {
  apiContext = await playwright.request.newContext({
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  });
})

test.afterAll(async ({ }) => {
  // Dispose all responses.
  await apiContext.dispose();
});

test('last created issue should be first in the list', async ({ page }) => {
  const newIssue = await apiContext.post(`/repos/${USER}/${REPO}/issues`, {
    data: {
      title: '[Feature] request 1',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  await page.goto(`https://github.com/${USER}/${REPO}/issues`);
  const firstIssue = page.locator(`a[data-hovercard-type='issue']`).first();
  await expect(firstIssue).toHaveText('[Feature] request 1');
});
```

## Validating postconditions

The following test creates a new issue via user interface in the browser and then uses checks if
it was created via API:

```js js-flavor=ts
import { test, expect } from '@playwright/test';

const REPO = 'test-repo-1';
const USER = 'github-username';

// Request context is reused by all tests in the file.
let apiContext;

test.beforeAll(async ({ playwright }) => {
  apiContext = await playwright.request.newContext({
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  });
})

test.afterAll(async ({ }) => {
  // Dispose all responses.
  await apiContext.dispose();
});

test('last created issue should be on the server', async ({ page, request }) => {
  await page.goto(`https://github.com/${USER}/${REPO}/issues`);
  await page.click('text=New Issue');
  await page.fill('[aria-label="Title"]', 'Bug report 1');
  await page.fill('[aria-label="Comment body"]', 'Bug description');
  await page.click('text=Submit new issue');
  const issueId = page.url().substr(page.url().lastIndexOf('/'));

  const newIssue = await request.get(`https://api.github.com/repos/${USER}/${REPO}/issues/${issueId}`);
  expect(newIssue.ok()).toBeTruthy();
  expect(newIssue).toEqual(expect.objectContaining({
    title: 'Bug report 1'
  }));
});
```

```js js-flavor=js
// @ts-check
const { test, expect } = require('@playwright/test');

const REPO = 'test-repo-1';
const USER = 'github-username';

// Request context is reused by all tests in the file.
let apiContext;

test.beforeAll(async ({ playwright }) => {
  apiContext = await playwright.request.newContext({
    // All requests we send go to this API endpoint.
    baseURL: 'https://api.github.com',
    extraHTTPHeaders: {
      // We set this header per GitHub guidelines.
      'Accept': 'application/vnd.github.v3+json',
      // Add authorization token to all requests.
      // Assuming personal access token available in the environment.
      'Authorization': `token ${process.env.API_TOKEN}`,
    },
  });
})

test.afterAll(async ({ }) => {
  // Dispose all responses.
  await apiContext.dispose();
});

test('last created issue should be on the server', async ({ page, request }) => {
  await page.goto(`https://github.com/${USER}/${REPO}/issues`);
  await page.click('text=New Issue');
  await page.fill('[aria-label="Title"]', 'Bug report 1');
  await page.fill('[aria-label="Comment body"]', 'Bug description');
  await page.click('text=Submit new issue');
  const issueId = page.url().substr(page.url().lastIndexOf('/'));

  const newIssue = await request.get(`https://api.github.com/repos/${USER}/${REPO}/issues/${issueId}`);
  expect(newIssue.ok()).toBeTruthy();
  expect(newIssue).toEqual(expect.objectContaining({
    title: 'Bug report 1'
  }));
});
```

### API reference
- [`request` fixture](./api/class-fixtures#fixtures-request)
- [`property: Playwright.request`]
- [`property: BrowserContext.request`]
- [`property: Page.request`]
- [`method: APIRequest.newContext`]
- [`method: APIRequestContext.delete`]
- [`method: APIRequestContext.fetch`]
- [`method: APIRequestContext.get`]
- [`method: APIRequestContext.post`]

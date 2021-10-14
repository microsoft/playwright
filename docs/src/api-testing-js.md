---
id: api-testing
title: "API testing"
---

Playwright can be used to get access to the [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) API of
your application.

Sometimes you may want to send requests to the server directly from Node.js without loading a page and running js code in it.
A few example where it may come in handy:
- Test your server API.
- Prepare server side state before visting the web application in a test.
- Validate server side post-conditions after running some actions in the browser
All of that could be achived via [ApiRequestContext] methods.

<!-- TOC -->

## Writing API Test

The Playwright [ApiRequestContext] can send all kinds of HTTP(S) requests over network.

The following example demonstrates how to use Plawright to test programmatic creation of
issues via [GitHub API](https://docs.github.com/en/rest). The test suite will do the following:
- create a new repo before all tests
- create a few issues and validate the server state
- after all tests finish delete the repo

Creating and deleting a repo:
```js
const { request } = require('@playwright/test');
...
const context = await request.newContext();
await context.post('https://api.github.com/user/repos', {
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    // Add GitHub personal access token.
    'Authorization': `token ${process.env.API_TOKEN}`,
  },
  data: {
    name: 'test-repo-1'
  }
});
const response = await request.delete(`https://api.github.com/repos/${user}/test-repo-1`{
  headers: {
    'Accept': 'application/vnd.github.v3+json',
    // Add GitHub personal access token.
    'Authorization': `token ${process.env.API_TOKEN}`,
  }
});
```

Playwright Test comes with a built in request fixture that can be used to simplify the code. Also since
the authorizaztion token is going to be reused between tests it makes sense to configure it once for
all tests:

```js
test.use({
  baseURL: 'https://api.github.com',
  extraHTTPHeaders: {
    'Accept': 'application/vnd.github.v3+json',
    // Add authorization token to all requests.
    'Authorization': 'token ' + token,
  }
});

const repo = 'test-repo-1';

// The request object will use the context parameters above.
test.beforeAll(async ({ request }) => {
  // Create new repository
  const response = await request.post('/user/repos', {
    data: {
      name: repo
    }
  });
  expect(response.ok()).toBeTruthy();
});

test.afterAll(async ({ request }) => {
  // Delete the repository
  const response = await request.delete(`/repos/${user}/${repo}`);
  expect(response.ok()).toBeTruthy();
});
```

Now we can add a couple tests that would create new issues in the repository:
```js
test('should create bug report', async ({ request }) => {
  const newIssue = await request.post(`/repos/${user}/${repo}/issues`, {
    data: {
      title: '[Bug] report 1',
      body: 'Bug description',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  const issues = await request.get(`/repos/${user}/${repo}/issues`);
  expect(issues.ok()).toBeTruthy();
  expect(await issues.json()).toContainEqual(expect.objectContaining({
    title: '[Bug] report 1',
    body: 'Bug description'
  }));
});

test('should create feature request', async ({ request }) => {
  const newIssue = await request.post(`/repos/${user}/${repo}/issues`, {
    data: {
      title: '[Feature] request 1',
      body: 'Feature description',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  const issues = await request.get(`/repos/${user}/${repo}/issues`);
  expect(issues.ok()).toBeTruthy();
  expect(await issues.json()).toContainEqual(expect.objectContaining({
    title: '[Feature] request 1',
    body: 'Feature description'
  }));
});
```

## Preparing server state via API calls

The following test creates a new issue via API and then navigates to the list of all issues in the
project to check that it appears at the top of the list.

```js
test('last created issue should be first in the list', async ({ page, request }) => {
  const newIssue = await request.post(`/repos/${user}/${repo}/issues`, {
    data: {
      title: '[Feature] request 1',
    }
  });
  expect(newIssue.ok()).toBeTruthy();

  await page.goto(`https://github.com/${user}/${repo}/issues`);
  const text = await page.locator(`a[data-hovercard-type='issue']`).first().textContent()
  expect('[Feature] request 1');
});
```

## Checking server state after running user actions

The following test creates a new issue via user interface in the browser and then uses checks if
it was created by means of the server API:

```js
test('last created issue should be on server', async ({ page, request }) => {
  await page.goto(`https://github.com/${user}/${repo}/issues`);
  await page.click('text=New Issue');
  await page.fill('[aria-label="Title"]', 'Bug report 1');
  await page.fill('[aria-label="Comment body"]', 'Bug description');
  await page.click('text=Submit new issue');
  const issueId = page.url().substr(page.url().lastIndexOf('/'));

  const newIssue = await request.get(`https://api.github.com/repos/${user}/${repo}/issues/${issueId}`);
  expect(newIssue.ok()).toBeTruthy();
  expect(newIssue).toEqual(expect.objectContaining({
    title: 'Bug report 1'
  }));
});
```

### API reference
- [`property: Playwright.request`]
- [`property: BrowserContext.request`]
- [`property: Page.request`]
- [`method: ApiRequest.newContext`]
- [`method: ApiRequestContext.delete`]
- [`method: ApiRequestContext.fetch`]
- [`method: ApiRequestContext.get`]
- [`method: ApiRequestContext.post`]

## Reuse authentication state

Web apps use cookie-based or token-based authentication, where authenticated
state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
Playwright provides [`method: ApiRequestContext.storageState`] method that can be used to
retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

Storage state is interchangable between [BrowserContext] and [ApiRequestContext]. You can
use it e.g. to log in via API calls and then create a new context with retrived cookies.
The following code snippet retrieves state from an authenticated [ApiRequestContext] and
creates a new [BrowserContext] with that state.

```js
const requestContext = await request.newContext({
  httpCredentials: {
    username: 'user',
    password: 'passwd'
  }
});
await requestContext.get(`https://api.example.com/login`);
// Save storage state into the file.
await requestContext.storageState({ path: 'state.json' });

// Create a new context with the saved storage state.
const context = await browser.newContext({ storageState: 'state.json' });
```

### API reference
- [`method: Browser.newContext`]
- [`method: ApiRequestContext.storageState`]
- [`method: ApiRequest.newContext`]


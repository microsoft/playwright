---
id: auth
title: "Authentication"
---

Playwright can be used to automate scenarios that require authentication.

Tests written with Playwright execute in isolated clean-slate environments called [browser contexts](./browser-contexts.md). This isolation model improves reproducibility and prevents cascading test failures. New browser contexts can load existing authentication state. This eliminates the need to login in every context and speeds up test execution.

> Note: This guide covers cookie/token-based authentication (logging in via the app UI). For [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) use [`method: Browser.newContext`].

## Automate logging in

The Playwright API can [automate interaction](./input.md) from a login form.

The following example automates logging into GitHub. Once these steps are executed,
the browser context will be authenticated.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test('sign in', async ({ page, context, browserName }) => {
  await page.goto('https://outlook.com');
  await page.getByRole('navigation', { name: 'Quick links' }).getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('textbox', { name: 'Enter your email, phone, or Skype.' }).fill(process.env.OUTLOOK_USER!);
  await page.getByRole('button', { name: 'Next' }).click();

  if (browserName === 'webkit') {
    await page.getByRole('textbox', { name: `Enter the password for ${process.env.OUTLOOK_USER!}` }).fill(process.env.OUTLOOK_PASSWORD!);
  } else {
    await page.getByPlaceholder('Password').fill(process.env.OUTLOOK_PASSWORD!);
  }
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Don\'t show this again').check();
  await page.getByRole('button', { name: 'Yes' }).click();
  expect((await context.cookies()).length).toBeTruthy();

  const contextState = await context.storageState();
  const storage = test.info().storage();
  await storage.set('outlook-test-user', contextState)
});
```

Redoing login for every test can slow down test execution. To mitigate that, reuse
existing authentication state instead.

## Authenticatin in project setup

Playwright provides a way to save the context state into the project [`method: TestInfo.storage`]
and then reuse authenticated state in every test of the project. This way the
login steps can be run once per project.

Web apps use cookie-based or token-based authentication, where authenticated state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage). Playwright provides [browserContext.storageState([options])](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state) method that can be used to retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

Cookies and local storage state can be used across different browsers. They depend on your application's authentication model: some apps might require both cookies and local storage.

Save the context state into project storage:

```js tab=js-ts
// outlook-login.setup.ts
import { test, expect } from '@playwright/test';

test('sign in', async ({ page, context, browserName }) => {
  await page.goto('https://outlook.com');
  // perform login steps ...

  // Save the state.
  const contextState = await context.storageState();
  const storage = test.info().storage();
  await storage.set('outlook-test-user', contextState)
});
```

Configure project setup script in the Playwright configuration file:

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    {
      name: 'chromium',
      setup: /.*login.setup.ts$/,
    },
};
export default config;
```

In the tests that require authentication specify name of the storage entry
that contains state of the authenticated context, Playwright will automatically
load it when creating new contexts for the tests:

```js tab=js-ts
import { test, expect } from '@playwright/test';

// Name of the storage state entry. The entry is saved in the project setup.
test.use({
  storageStateName: 'outlook-test-user'
})

const timestamp = Date.now();
const emailSubject = `Welcome - ${timestamp}`;
const emailBody = `Hi there! ${timestamp}`;

test('send message to self', async ({ page, browserName }) => {
  await page.goto('https://outlook.com');
  await page.getByRole('button', { name: 'New message' }).click();
  await page.getByRole('textbox', { name: 'To' }).first().click();
  await page.getByRole('textbox', { name: 'To' }).first().fill(process.env.OUTLOOK_USER!);
  await page.getByRole('textbox', { name: 'To' }).filter({ hasText: process.env.OUTLOOK_USER! }).press('Enter');
  await page.getByPlaceholder('Add a subject').click();
  await page.getByPlaceholder('Add a subject').fill(emailSubject);
  await page.getByRole('textbox', { name: 'Message body, press Alt+F10 to exit' }).click();
  await page.getByRole('textbox', { name: 'Message body, press Alt+F10 to exit' }).fill(emailBody);
  await page.getByTestId('ComposeSendButton').getByTitle('Send (Ctrl+Enter)').click();
  // Wait for the message to be sent for realz.
  await expect(page.getByRole('option').getByText(emailSubject)).toBeVisible();
});
```

:::note
If you can log in once and commit the `.playwright-storage/` into the repository, you won't need the global setup at all, just specify the `.playwright-storage/` in Playwright Config as above and it'll be picked up.

However, periodically, you may need to update files under `.playwright-storage/` directory if your app requires you to re-authenticate after some amount of time. For example, if your app prompts you to sign in every week even if you're on the same computer/browser, you'll need to update `.playwright-storage/` at least this often.
:::

### Sign in via API request

If your web application supports signing in via API, you can use [APIRequestContext] to simplify sign in flow. Global setup script from the example above would change like this:

```js tab=js-ts
// github-login.setup.js
import { test } from '@playwright/test';

test('test', async ({ request }) => {
  await request.post('https://github.com/login', {
    form: {
      'user': 'user',
      'password': 'password'
    }
  });
  // Save signed-in state to the storage.
  const contextState = await request.storageState();
  const storage = test.info().storage();
  await storage.set('github-test-user', contextState)
});
```

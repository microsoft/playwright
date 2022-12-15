---
id: best-practices
title: "Best Practices"
---

## Use the test generator to generate locators

Playwright has a [test generator](./codegen.md) that can generate locators for you. It will look at your page and figure out the best locator, prioritizing role, text and test id locators. If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators. 



```bash
npx playwright codegen
```

## Don't use xpath or css selectors

Your DOM can easily change so having your tests depend on your DOM structure can lead to failing tests. For example consider selecting this button by its CSS classes. Should the designer change something then the class my change breaking your test.

```js
page.locator('button.buttonIcon.episode-actions-later')
```
Use role locators instead. You know the role of the button won't change and most likely neither will the text content or if it does you might want to know about it.

```js
page.getByRole('button', { name: 'submit' })
```

## Never use element handles - use locators instead

Web first assertions only work with locators that means you get auto waiting and retry ability which you wont get with handlers.


## Never check manually for `isVisible()`

Use `toBeVisible()` instead. Web assertions such as `toBeVisible()` will wait and retry whereas `isVisible()` wont wait a single second, it will just check the locator is there and return immediately.

For Example when testing a toast message, if you click a button that makes a toast message appear you can test the toast message is there. The test might pass but if the toast takes half a second to appear it won’t wait when using `isVisible()` and your test will fail.

## Never use wait.for Timeout

With Playwright retries are by default when using web assertions. Never use manual assertions 
that are not awaiting the expect such as `expect(await page.locator(“text=me”).innerText()).toBe(“me”)`.



`toBe` is a jest assertion not a web assertion (Playwright assertion)

## Use Playwright test runner

Dont use the library

## Don't use videos and screenshots for debugging
Use playwright trace viewer for post mortem debugging instead of videos and screenshots ….

## Use TypeScript

works out of the box, better ide integrations, refactoring tools,

## Testing external links

Don't try to test links to external sites or third party servers that you do not control. Not only is it time consuming and can slow down your tests but also you can not control the content of the page you are linking to, if there are cookie banners or overlay pages or anything else that might cause your test to fail.

Instead you have two options:

1. Test the link contains the correct url by checking the attribute it contains.
   
```js
await expect(getByRole('link', { name: 'Playwright' })).toHaveAttribute('href', 'https://www.playwright.dev');
```

1. Intercept the route with a mock response. This ensures the link is visible and clickable rather than just checking the attribute is correct. Before hitting the link the route gets intercepted and a mock response is returned. Clicking the link results in a new page being opened containing the mock response rather than the actual page. We can then check this has the URL we expect.

```js
test('github link works', async ({ page }) => {
    await page.context().route('https://www.github.com/**', route => route.fulfill({
      body: '<html><body><h1>Github - Playwright</h1></body></html>'
    }));

    const [page1] = await Promise.all([
      page.waitForEvent('popup'),
      await page.getByRole('link', { name: 'linkedIn' }).click()
    ]);
    await expect(page1).toHaveURL('https://www.github.com/microsoft/playwright');
  });
```


## Use test isolation

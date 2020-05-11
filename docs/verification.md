# Scraping and verification

<!-- GEN:toc-top-level -->
- [Evaluating JavaScript](#evaluating-javascript)
- [Capturing screenshot](#capturing-screenshot)
- [Page events](#page-events)
- [Handling exceptions](#handling-exceptions)
<!-- GEN:stop -->

<br/>

## Evaluating JavaScript

Execute JavaScript function in the page:
```js
const href = await page.evaluate(() => document.location.href);
```

If the result is a Promise or if the function is asynchronous evaluate will automatically wait until it's resolved:
```js
const status = await page.evaluate(async () => {
  const response = await fetch(location.href);
  return response.status;
});
```

Get object handle and use it in multiple evaluations:
```js
// Create a new array in the page, write a reference to it in
// window.myArray and get a handle to it.
const myArrayHandle = await page.evaluateHandle(() => {
  window.myArray = [1];
  return myArray;
});

// Get current length of the array using the handle.
const length = await page.evaluate(
  (arg) => arg.myArray.length,
  { myArray: myArrayHandle }
);

// Add one more element to the array using the handle
await page.evaluate((arg) => arg.myArray.push(arg.newElement), {
  myArray: myArrayHandle,
  newElement: 2
});

// Get current length of the array using window.myArray reference.
const newLength = await page.evaluate(() => window.myArray.length);

// Release the object when it's no longer needed.
await myArrayHandle.dispose();
```

#### API reference

- [page.$(selector)](./api.md#pageselector)
- [page.$$(selector)](./api.md#pageselector-1)
- [page.$eval(selector, pageFunction[, arg])](./api.md#pageevalselector-pagefunction-arg)
- [page.$$eval(selector, pageFunction[, arg])](./api.md#pageevalselector-pagefunction-arg-1)
- [page.evaluate(pageFunction[, arg])](./api.md#pageevaluatepagefunction-arg)
- [page.evaluateHandle(pageFunction[, arg])](./api.md#pageevaluatehandlepagefunction-arg)

<br/>

## Capturing screenshot

```js
// Save to file
await page.screenshot({path: 'screenshot.png'});

// Capture full page
await page.screenshot({path: 'screenshot.png', fullPage: true});

// Capture into buffer
const buffer = await page.screenshot();
console.log(buffer.toString('base64'));

// Capture given element
const elementHandle = await page.$('.header');
await elementHandle.screenshot({ path: 'screenshot.png' });
```

#### API reference

- [page.screenshot([options])](./api.md#pagescreenshotoptions)
- [elementHandle.screenshot([options])](./api.md#elementhandlescreenshotoptions)

<br/>

## Page events

You can listen for various events on the `page` object. Following are just some of the examples of the events you can assert and handle:

#### `"console"` - get all console messages from the page

```js
page.on('console', msg => {
  // Handle only errors.
  if (msg.type() !== 'error')
    return;
  console.log(`text: "${msg.text()}"`);
});
```

#### `"dialog"` - handle alert, confirm, prompt

```js
page.on('dialog', dialog => {
  dialog.accept();
});
```

#### `"popup"` - handle popup windows

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#open')
]);
```

#### API reference

- [class: ConsoleMessage](./api.md#class-consolemessage)
- [class: Page](./api.md#class-page)
- [event: 'console'](./api.md#event-console)
- [event: 'dialog'](./api.md#event-dialog)
- [event: 'popup'](./api.md#event-popup)

<br/>


## Handling exceptions

Listen uncaught exceptions in the page:
```js
// Log all uncaught errors to the terminal
page.on('pageerror', exception => {
  console.log(`Uncaught exception: "${exception}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

#### API reference

- [event: 'pageerror'](./api.md#event-pageerror)

<br/>

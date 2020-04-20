# Scraping and verification

Playwright allows verifiying state of the page and catching abnormal behavior by:
  - evaluating JavaScript code snippets in the page
  - capturing screenshots (png or jpeg)
  - listening console messages
  - observing uncaghut exceptions in the page
  - observing page crashes
  - etc

#### Contents
- [Evaluating JavaScript](#evaluating-javascript)
- [Capturing screenshot](#capturing-screenshot)
- [Listening console messages](#listening-console-messages)
- [Uncaghut exceptions](#uncaghut-exceptions)
- [Page crashes](#page-crashes)

<br/>

## Evaluating JavaScript

Execute JavaScript function in the page:
```js
  const href = await page.evaluate(() => document.location.href);
```

If the result is a Promise or if the function is asynchronouse eveluate will automatically wait until it's resolved:
```js
  const status = await page.evaluate(async () => {
    const response = await fetch(location.href);
    return response.status;
  });
```

Get object handle and use it in multiple evaluations:
```js
  // Create a new array in the page, wriate a reference to it in
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
    myArray:myArrayHandle,
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

Take screenshot of the page's viewport and save it in a png file:
```js
  await page.screenshot({path: 'screenshot.png'});
```
Capture entire scrollable area of the page:
```js
  await page.screenshot({path: 'screenshot.png', fullPage: true});
```
Save screenshot in an in-memory buffer (the content is base64-encoded image bytes):
```js
  const buffer = await page.screenshot();
  // Log the length.
  console.log(buffer.length);
```


#### API reference

- [page.screenshot([options])](./api.md#pagescreenshotoptions)
- [Node.js Buffer](https://nodejs.org/api/buffer.html)

<br/>

## Listening console messages

Listen all console messages in a page and dump _errors_ in to the terminal:

```js
  // Get all console messages from the page.
  page.on('console', msg => {
    // Handle only errors.
    if (msg.type() !== 'error')
      return;
    console.log(`text: "${msg.text()}"`);
  });

  await page.evaluate(() => console.error('Page error message'));
```
Get access to the console message arguments:
```js
  page.on('console', msg => {
    for (let i = 0; i < msg.args().length; ++i)
      console.log(`${i}: ${msg.args()[i]}`);
  });
```

#### API reference

- [class: ConsoleMessage](./api.md#class-consolemessage)
- [class `JSHandle`](./api.md#class-jshandle)
- [event: 'console'](./api.md#event-console)

<br/>


## Uncaghut exceptions

Listen uncaghut exceptions in the page:
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

## Page crashes

Listen to page crashes:
```js
  page.on('crash', exception => {
    console.log(`Page crashed`);
  });
```
It's very unusual for page to crash but might happen if a page allocates too much memory or due to a bug in a browser.

#### API reference

- [event: 'crash'](./api.md#event-crash)

<br/>

# Verification

<!-- GEN:toc-top-level -->
- [Screenshots](#screenshots)
- [Console logs](#console-logs)
- [Page errors](#page-errors)
- [Page events](#page-events)
<!-- GEN:stop -->

<br/>

## Screenshots

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

## Console logs

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

#### API reference

- [class: ConsoleMessage](./api.md#class-consolemessage)
- [class: Page](./api.md#class-page)
- [event: 'console'](./api.md#event-console)

<br/>

## Page errors

Listen for uncaught exceptions in the page with the `pagerror` event.

```js
// Log all uncaught errors to the terminal
page.on('pageerror', exception => {
  console.log(`Uncaught exception: "${exception}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

#### API reference

- [class: Page](./api.md#class-page)
- [event: 'pageerror'](./api.md#event-pageerror)

<br/>

## Page events

#### `"requestfailed"`

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
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

- [class: Page](./api.md#class-page)
- [event: 'requestfailed'](./api.md#event-requestfailed)
- [event: 'dialog'](./api.md#event-dialog)
- [event: 'popup'](./api.md#event-popup)

# class: Dialog

[Dialog] objects are dispatched by page via the [`event: Page.dialog`] event.

An example of using `Dialog` class:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('dialog', async dialog => {
    console.log(dialog.message());
    await dialog.dismiss();
    await browser.close();
  });
  page.evaluate(() => alert('1'));
})();
```

## async method: Dialog.accept

Returns when the dialog has been accepted.

### param: Dialog.accept.promptText
- `promptText` <[string]>

A text to enter in prompt. Does not cause any effects if the dialog's `type` is not prompt. Optional.

## method: Dialog.defaultValue
- returns: <[string]>

If dialog is prompt, returns default prompt value. Otherwise, returns empty string.

## async method: Dialog.dismiss

Returns when the dialog has been dismissed.

## method: Dialog.message
- returns: <[string]>

A message displayed in the dialog.

## method: Dialog.type
- returns: <[string]>

Returns dialog's type, can be one of `alert`, `beforeunload`, `confirm` or `prompt`.

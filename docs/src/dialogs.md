---
id: dialogs
title: "Dialogs"
---

## Introduction

Playwright can interact with the web page dialogs such as [`alert`](https://developer.mozilla.org/en-US/docs/Web/API/Window/alert), [`confirm`](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm), [`prompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt) as well as [`beforeunload`](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) confirmation. For print dialogs, see [Print](#print-dialogs).

## alert(), confirm(), prompt() dialogs

By default, dialogs are auto-dismissed by Playwright, so you don't have to handle them. However, you can register a dialog handler before the action that triggers the dialog to either [`method: Dialog.accept`] or [`method: Dialog.dismiss`] it.

```js
page.on('dialog', dialog => dialog.accept());
await page.getByRole('button').click();
```

```java
page.onDialog(dialog -> dialog.accept());
page.getByRole(AriaRole.BUTTON).click();
```

```python async
page.on("dialog", lambda dialog: dialog.accept())
await page.get_by_role("button".click())
```

```python sync
page.on("dialog", lambda dialog: dialog.accept())
page.get_by_role("button").click()
```

```csharp
Page.Dialog += async (_, dialog) =>
{
    await dialog.AcceptAsync();
};
await Page.GetByRole(AriaRole.Button).ClickAsync();
```

:::note
[`event: Page.dialog`] listener **must handle** the dialog. Otherwise your action will stall, be it [`method: Locator.click`] or something else. That's because dialogs in Web are modals and therefore block further page execution until they are handled.
:::

As a result, the following snippet will never resolve:

:::warning
WRONG!
:::

```js
page.on('dialog', dialog => console.log(dialog.message()));
await page.getByRole('button').click(); // Will hang here
```

```java
page.onDialog(dialog -> System.out.println(dialog.message()));
page.getByRole(AriaRole.BUTTON).click(); // Will hang here
```

```python async
page.on("dialog", lambda dialog: print(dialog.message))
await page.get_by_role("button").click() # Will hang here
```

```python sync
page.on("dialog", lambda dialog: print(dialog.message))
page.get_by_role("button").click() # Will hang here
```

```csharp
page.Dialog += (_, dialog) => Console.WriteLine(dialog.Message);
await page.GetByRole(AriaRole.Button).ClickAsync(); // Will hang here
```

:::note
If there is no listener for [`event: Page.dialog`], all dialogs are automatically dismissed.
:::

## beforeunload dialog

When [`method: Page.close`] is invoked with the truthy [`option: Page.close.runBeforeUnload`] value, the page runs its unload handlers. This is the only case when [`method: Page.close`] does not wait for the page to actually close, because it might be that the page stays open in the end of the operation.

You can register a dialog handler to handle the `beforeunload` dialog yourself:

```js
page.on('dialog', async dialog => {
  assert(dialog.type() === 'beforeunload');
  await dialog.dismiss();
});
await page.close({ runBeforeUnload: true });
```

```java
page.onDialog(dialog -> {
  assertEquals("beforeunload", dialog.type());
  dialog.dismiss();
});
page.close(new Page.CloseOptions().setRunBeforeUnload(true));
```

```python async
async def handle_dialog(dialog):
    assert dialog.type == 'beforeunload'
    await dialog.dismiss()

page.on('dialog', lambda: handle_dialog)
await page.close(run_before_unload=True)
```

```python sync
def handle_dialog(dialog):
    assert dialog.type == 'beforeunload'
    dialog.dismiss()

page.on('dialog', lambda: handle_dialog)
page.close(run_before_unload=True)
```

```csharp
Page.Dialog += async (_, dialog) =>
{
    Assert.AreEqual("beforeunload", dialog.Type);
    await dialog.DismissAsync();
};
await Page.CloseAsync(new() { RunBeforeUnload = true });
```

## Print dialogs

In order to assert that a print dialog via [`window.print`](https://developer.mozilla.org/en-US/docs/Web/API/Window/print) was triggered, you can use the following snippet:

```js
await page.goto('<url>');

await page.evaluate('(() => {window.waitForPrintDialog = new Promise(f => window.print = f);})()');
await page.getByText('Print it!').click();

await page.waitForFunction('window.waitForPrintDialog');
```

```java
page.navigate("<url>");

page.evaluate("(() => {window.waitForPrintDialog = new Promise(f => window.print = f);})()");
page.getByText("Print it!").click();

page.waitForFunction("window.waitForPrintDialog");
```

```python async
await page.goto("<url>")

await page.evaluate("(() => {window.waitForPrintDialog = new Promise(f => window.print = f);})()")
await page.get_by_text("Print it!").click()

await page.wait_for_function("window.waitForPrintDialog")
```

```python sync
page.goto("<url>")

page.evaluate("(() => {window.waitForPrintDialog = new Promise(f => window.print = f);})()")
page.get_by_text("Print it!").click()

page.wait_for_function("window.waitForPrintDialog")
```

```csharp
await Page.GotoAsync("<url>");

await Page.EvaluateAsync("(() => {window.waitForPrintDialog = new Promise(f => window.print = f);})()");
await Page.GetByText("Print it!").ClickAsync();

await Page.WaitForFunctionAsync("window.waitForPrintDialog");
```

This will wait for the print dialog to be opened after the button is clicked.
Make sure to evaluate the script before clicking the button / after the page is loaded.

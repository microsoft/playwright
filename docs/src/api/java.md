## method: Page.onceDialog
* langs: java

Adds one-off [Dialog] handler. The handler will be removed immediately after next [Dialog] is created.
```java
page.onceDialog(dialog -> {
  dialog.accept("foo");
});

// prints 'foo'
System.out.println(page.evaluate("prompt('Enter string:')"));

// prints 'null' as the dialog will be auto-dismissed because there are no handlers.
System.out.println(page.evaluate("prompt('Enter string:')"));
```

This code above is equivalent to:
```java
Consumer<Dialog> handler = new Consumer<Dialog>() {
  @Override
  public void accept(Dialog dialog) {
    dialog.accept("foo");
    page.offDialog(this);
  }
};
page.onDialog(handler);

// prints 'foo'
System.out.println(page.evaluate("prompt('Enter string:')"));

// prints 'null' as the dialog will be auto-dismissed because there are no handlers.
System.out.println(page.evaluate("prompt('Enter string:')"));
```

### param: Page.onceDialog.handler
- `handler` <[function]\([Dialog]\)>

Receives the [Dialog] object, it **must** either [`method: Dialog.accept`] or [`method: Dialog.dismiss`] the dialog - otherwise
the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog,
and actions like click will never finish.

## method: Playwright.close
* langs: java

Terminates this instance of Playwright, will also close all created browsers if they are still running.

## method: Playwright.create
* langs: java
- returns: <[Playwright]>

Launches new Playwright driver process and connects to it. [`method: Playwright.close`] should be called when the instance is no longer needed.

```java
Playwright playwright = Playwright.create()) {
Browser browser = playwright.webkit().launch();
Page page = browser.newPage();
page.navigate("https://www.w3.org/");
playwright.close();
```

### option: Playwright.create.env
* langs: java
- `env` <[Object]<[string], [string]>>

Additional environment variables that will be passed to the driver process. By default driver
process inherits environment variables of the Playwright process.

### param: BrowserContext.waitForPage.callback = %%-java-wait-for-event-callback-%%

### param: Frame.waitForNavigation.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForClose.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForConsoleMessage.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForDownload.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForFileChooser.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForPopup.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForRequest.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForRequestFinished.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForResponse.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForNavigation.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForWebSocket.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForWorker.callback = %%-java-wait-for-event-callback-%%

### param: WebSocket.waitForFrameReceived.callback = %%-java-wait-for-event-callback-%%

### param: WebSocket.waitForFrameSent.callback = %%-java-wait-for-event-callback-%%

### param: Worker.waitForClose.callback = %%-java-wait-for-event-callback-%%

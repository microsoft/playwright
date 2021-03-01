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

### param: BrowserContext.waitForPage.callback = %%-java-wait-for-event-callback-%%

### param: Frame.waitForNavigation.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForClose.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForConsoleMessage.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForDownload.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForFileChooser.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForPopup.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForRequest.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForResponse.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForNavigation.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForWebSocket.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForWorker.callback = %%-java-wait-for-event-callback-%%

### param: WebSocket.waitForFrameReceived.callback = %%-java-wait-for-event-callback-%%

### param: WebSocket.waitForFrameSent.callback = %%-java-wait-for-event-callback-%%

### param: Worker.waitForClose.callback = %%-java-wait-for-event-callback-%%

### option: BrowserType.launch.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launch.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%

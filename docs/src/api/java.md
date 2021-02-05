## method: Playwright.close
* langs: java

Terminates this instance of Playwright, will also close all created browsers if they are still running.

### param: BrowserContext.waitForPage.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForClose.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForConsoleMessage.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForDownload.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForFileChooser.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForPopup.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForRequest.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForResponse.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForWebSocket.callback = %%-java-wait-for-event-callback-%%

### param: Page.waitForWorker.callback = %%-java-wait-for-event-callback-%%

## method: WebSocket.waitForFrameReceived
* langs: java
- returns: <[FrameData]>

Performs action and waits for a received frame.

### option: WebSocket.waitForFrameReceived.timeout = %%-wait-for-event-timeout-%%

### param: WebSocket.waitForFrameReceived.callback = %%-java-wait-for-event-callback-%%

## method: WebSocket.waitForFrameSent
* langs: java
- returns: <[FrameData]>

Performs action and waits for a sent frame.

### option: WebSocket.waitForFrameSent.timeout = %%-wait-for-event-timeout-%%

### param: WebSocket.waitForFrameSent.callback = %%-java-wait-for-event-callback-%%

### param: Worker.waitForClose.callback = %%-java-wait-for-event-callback-%%

### option: BrowserType.launch.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launch.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%

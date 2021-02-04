## method: Playwright.close
* langs: java

Terminates this instance of Playwright, will also close all created browsers if they are still running.

## method: BrowserContext.waitForPage
* langs: java
- returns: <[Page]>

Runs callback and waits for a new Page.

### option: BrowserContext.waitForPage.timeout = %%-java-wait-for-event-timeout-%%

### param: BrowserContext.waitForPage.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForClose
* langs: java
- returns: <[Page]>

Runs callback and waits until the Page is closed.

### option: Page.waitForClose.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForClose.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForConsole
* langs: java
- returns: <[ConsoleMessage]>

Runs callback and waits for a console message.

### option: Page.waitForConsole.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForConsole.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForDownload
* langs: java
- returns: <[Download]>

Runs callback and waits for a download.

### option: Page.waitForDownload.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForDownload.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForFileChooser
* langs: java
- returns: <[FileChooser]>

Runs callback and waits for a file chooser.

### option: Page.waitForFileChooser.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForFileChooser.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForFrameAttached
* langs: java
- returns: <[Frame]>

Runs callback and waits for a [`event: Page.frameAttached`] event.

### option: Page.waitForFrameAttached.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForFrameAttached.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForFrameDetached
* langs: java
- returns: <[Frame]>

Runs callback and waits for a [`event: Page.frameDetached`] event.

### option: Page.waitForFrameDetached.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForFrameDetached.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForFrameNavigated
* langs: java
- returns: <[Frame]>

Runs callback and waits for navigation in one of the frames in the page.

### option: Page.waitForFrameNavigated.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForFrameNavigated.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForPageError
* langs: java
- returns: <[Error]>

Runs callback and waits for an error.

### option: Page.waitForPageError.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForPageError.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForPopup
* langs: java
- returns: <[Page]>

Runs callback and waits for a popup.

### option: Page.waitForPopup.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForPopup.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForRequest
* langs: java
- returns: <[Request]>

Runs callback and waits for a new Request.

### option: Page.waitForRequest.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForRequest.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForRequestFailed
* langs: java
- returns: <[Request]>

Runs callback and waits for a request failure.

### option: Page.waitForRequestFailed.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForRequestFailed.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForRequestFinished
* langs: java
- returns: <[Request]>

Runs callback and waits until one of the Requests finishes.

### option: Page.waitForRequestFinished.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForRequestFinished.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForResponse
* langs: java
- returns: <[Response]>

Runs callback and waits for a new Response.

### option: Page.waitForResponse.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForResponse.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForWebSocket
* langs: java
- returns: <[WebSocket]>

Runs callback and waits for a new WebSocket.

### option: Page.waitForWebSocket.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForWebSocket.callback = %%-java-wait-for-event-callback-%%

## method: Page.waitForWorker
* langs: java
- returns: <[Worker]>

Runs callback and waits for a new Worker.

### option: Page.waitForWorker.timeout = %%-java-wait-for-event-timeout-%%

### param: Page.waitForWorker.callback = %%-java-wait-for-event-callback-%%

## method: WebSocket.waitForFrameReceived
* langs: java
- returns: <[FrameData]>

Runs callback and waits for a received frame.

### option: WebSocket.waitForFrameReceived.timeout = %%-java-wait-for-event-timeout-%%

### param: WebSocket.waitForFrameReceived.callback = %%-java-wait-for-event-callback-%%

## method: WebSocket.waitForFrameSent
* langs: java
- returns: <[FrameData]>

Runs callback and waits for a sent frame.

### option: WebSocket.waitForFrameSent.timeout = %%-java-wait-for-event-timeout-%%

### param: WebSocket.waitForFrameSent.callback = %%-java-wait-for-event-callback-%%

## method: WebSocket.waitForSocketError
* langs: java
- returns: <[string]>

Runs callback and waits for an error.

### option: WebSocket.waitForSocketError.timeout = %%-java-wait-for-event-timeout-%%

### param: WebSocket.waitForSocketError.callback = %%-java-wait-for-event-callback-%%

## method: Worker.waitForClose
* langs: java
- returns: <[Worker]>

Runs callback and waits until the Worker is closed.

### option: Worker.waitForClose.timeout = %%-java-wait-for-event-timeout-%%

### param: Worker.waitForClose.callback = %%-java-wait-for-event-callback-%%

### option: BrowserType.launch.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreDefaultArgs = %%-csharp-java-browser-option-ignoredefaultargs-%%
### option: BrowserType.launch.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%
### option: BrowserType.launchPersistentContext.ignoreAllDefaultArgs = %%-csharp-java-browser-option-ignorealldefaultargs-%%

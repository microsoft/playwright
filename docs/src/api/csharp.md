## method: Request.PostDataJSON
* langs: csharp
- returns: <[JsonElement?]>

Returns parsed request's body for `form-urlencoded` and JSON as a fallback if any.

When the response is `application/x-www-form-urlencoded` then a key/value object of the values will be returned.
Otherwise it will be parsed as JSON.

### param: BrowserContext.waitForPage.action = %%-csharp-wait-for-event-action-%%
### param: Frame.waitForNavigation.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForConsoleMessage.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForDownload.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForFileChooser.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForPopup.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForRequestFinished.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForNavigation.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForWebSocket.action = %%-csharp-wait-for-event-action-%%
### param: Page.waitForWorker.action = %%-csharp-wait-for-event-action-%%

## method: Request.getPayloadAsJson
* langs: csharp
- returns: <[JsonDocument]>

Returns a [JsonDocument] representation of [`method: Request.postDataBuffer`].

### option: Request.getPayloadAsJson.serializerOptions
- `documentOptions` <[null]|[JsonDocumentOptions]>

The options that control custom behaviour when parsing the JSON.

## method: Response.statusCode
* langs: csharp
- returns: <[System.Net.HttpStatusCode]>

Gets the [System.Net.HttpStatusCode] code of the response.

### param: ElementHandle.selectOption.values = %%-csharp-select-options-values-%%
### param: ElementHandle.setInputFiles.files = %%-csharp-input-files-%%

### param: Frame.selectOption.values = %%-csharp-select-options-values-%%
### param: Frame.setInputFiles.files = %%-csharp-input-files-%%

### param: Page.selectOption.values = %%-csharp-select-options-values-%%
### param: Page.setInputFiles.files = %%-csharp-input-files-%%

## async method: Page.waitForEvent
* langs: csharp
- returns: <[T]>

### param: Page.waitForEvent.event
* langs: csharp
- `event` <[PlaywrightEvent<T>]>

Page event.

### option: Page.waitForEvent.predicate = %%-csharp-wait-for-event-predicate-%%

## async method: BrowserContext.waitForEvent
* langs: csharp
- returns: <[T]>

### param: BrowserContext.waitForEvent.event
* langs: csharp
- `event` <[PlaywrightEvent<T>]>

Browser context event.

### option: BrowserContext.waitForEvent.predicate = %%-csharp-wait-for-event-predicate-%%

## async method: WebSocket.waitForEvent
* langs: csharp
- returns: <[T]>

### param: WebSocket.waitForEvent.event
* langs: csharp
- `event` <[PlaywrightEvent<T>]>

WebSocket context event.

### option: WebSocket.waitForEvent.predicate = %%-csharp-wait-for-event-predicate-%%

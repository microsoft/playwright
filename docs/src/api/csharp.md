## method: Request.PostDataJSON
* langs: csharp
- returns: <[JsonDocument]>

Returns parsed request's body for `form-urlencoded` and JSON as a fallback if any.

When the response is `application/x-www-form-urlencoded` then a key/value object of the values will be returned.
Otherwise it will be parsed as JSON.

### param: Request.PostDataJSON.serializerOptions
* langs: csharp
- `documentOptions` <[null]|[JsonDocumentOptions]>

Optional Json options that control custom behaviour when parsing the JSON.

### param: ElementHandle.selectOption.values = %%-csharp-select-options-values-%%
### param: ElementHandle.setInputFiles.files = %%-csharp-input-files-%%

### param: Frame.selectOption.values = %%-csharp-select-options-values-%%
### param: Frame.setInputFiles.files = %%-csharp-input-files-%%

### param: Page.selectOption.values = %%-csharp-select-options-values-%%
### param: Page.setInputFiles.files = %%-csharp-input-files-%%

## method: Page.opener
* langs: csharp
- returns: <[null]|[Page]>

Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

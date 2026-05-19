# class: WebStorage
* since: v1.61

WebStorage exposes the page's `localStorage` or `sessionStorage` for the current origin via an async,
[browser-consistent](https://developer.mozilla.org/en-US/docs/Web/API/Storage) API.

Instances are accessed through [`property: Page.localStorage`] and [`property: Page.sessionStorage`].

```js
await page.goto('https://example.com');
await page.localStorage.setItem('token', 'abc');
const token = await page.localStorage.getItem('token');
const all = await page.localStorage.items();
await page.localStorage.removeItem('token');
await page.localStorage.clear();
```

```python async
await page.goto("https://example.com")
await page.local_storage.set_item("token", "abc")
token = await page.local_storage.get_item("token")
all = await page.local_storage.items()
await page.local_storage.remove_item("token")
await page.local_storage.clear()
```

```python sync
page.goto("https://example.com")
page.local_storage.set_item("token", "abc")
token = page.local_storage.get_item("token")
all = page.local_storage.items()
page.local_storage.remove_item("token")
page.local_storage.clear()
```

```java
page.navigate("https://example.com");
page.localStorage().setItem("token", "abc");
String token = page.localStorage().getItem("token");
List<NameValue> all = page.localStorage().items();
page.localStorage().removeItem("token");
page.localStorage().clear();
```

```csharp
await page.GotoAsync("https://example.com");
await page.LocalStorage.SetItemAsync("token", "abc");
var token = await page.LocalStorage.GetItemAsync("token");
var all = await page.LocalStorage.ItemsAsync();
await page.LocalStorage.RemoveItemAsync("token");
await page.LocalStorage.ClearAsync();
```

## async method: WebStorage.items
* since: v1.61
- returns: <[Array]<[Object]>>
  - `name` <[string]>
  - `value` <[string]>

Returns all items in the storage as `name`/`value` pairs.

## async method: WebStorage.getItem
* since: v1.61
- returns: <[null]|[string]>

Returns the value for the given `name`, or `null` if the key is not present.

### param: WebStorage.getItem.name
* since: v1.61
- `name` <[string]>

Name of the item to retrieve.

## async method: WebStorage.setItem
* since: v1.61

Sets the value for the given `name`. Overwrites any existing value for that name.

### param: WebStorage.setItem.name
* since: v1.61
- `name` <[string]>

Name of the item to set.

### param: WebStorage.setItem.value
* since: v1.61
- `value` <[string]>

New value for the item.

## async method: WebStorage.removeItem
* since: v1.61

Removes the item with the given `name`. No-op if the item is absent.

### param: WebStorage.removeItem.name
* since: v1.61
- `name` <[string]>

Name of the item to remove.

## async method: WebStorage.clear
* since: v1.61

Removes all items from the storage.

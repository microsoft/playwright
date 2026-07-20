# class: JSHandle
* since: v1.8

JSHandle represents an in-page JavaScript object. JSHandles can be created with the [`method: Page.evaluateHandle`]
method.

```js
const windowHandle = await page.evaluateHandle(() => window);
// ...
```

```java
JSHandle windowHandle = page.evaluateHandle("() => window");
// ...
```

```python async
window_handle = await page.evaluate_handle("window")
# ...
```

```python sync
window_handle = page.evaluate_handle("window")
# ...
```

```csharp
var windowHandle = await page.EvaluateHandleAsync("() => window");
```

JSHandle prevents the referenced JavaScript object being garbage collected unless the handle is exposed with
[`method: JSHandle.dispose`]. JSHandles are auto-disposed when their origin frame gets navigated or the parent context
gets destroyed.

JSHandle instances can be used as an argument in [`method: Page.evalOnSelector`], [`method: Page.evaluate`] and
[`method: Page.evaluateHandle`] methods.

## method: JSHandle.asElement
* since: v1.8
- returns: <[null]|[ElementHandle]>

Returns either `null` or the object handle itself, if the object handle is an instance of [ElementHandle].

## async method: JSHandle.dispose
* since: v1.8

The `jsHandle.dispose` method stops referencing the element handle.

## async method: JSHandle.evaluate
* since: v1.8
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

This method passes this handle as the first argument to [`param: expression`].

If [`param: expression`] returns a [Promise], then `handle.evaluate` would wait for the promise to resolve and return
its value.

**Usage**

```js
const tweetHandle = await page.$('.tweet .retweets');
expect(await tweetHandle.evaluate(node => node.innerText)).toBe('10 retweets');
```

```java
ElementHandle tweetHandle = page.querySelector(".tweet .retweets");
assertEquals("10 retweets", tweetHandle.evaluate("node => node.innerText"));
```

```python async
tweet_handle = await page.query_selector(".tweet .retweets")
assert await tweet_handle.evaluate("node => node.innerText") == "10 retweets"
```

```python sync
tweet_handle = page.query_selector(".tweet .retweets")
assert tweet_handle.evaluate("node => node.innerText") == "10 retweets"
```

```csharp
var tweetHandle = await page.QuerySelectorAsync(".tweet .retweets");
Assert.AreEqual("10 retweets", await tweetHandle.EvaluateAsync("node => node.innerText"));
```

### param: JSHandle.evaluate.expression = %%-evaluate-expression-%%
* since: v1.8

### param: JSHandle.evaluate.expression = %%-js-evaluate-pagefunction-%%
* since: v1.8

### param: JSHandle.evaluate.arg
* since: v1.8
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: JSHandle.evaluateHandle
* since: v1.8
- returns: <[JSHandle]>

Returns the return value of [`param: expression`] as a [JSHandle].

This method passes this handle as the first argument to [`param: expression`].

The only difference between `jsHandle.evaluate` and `jsHandle.evaluateHandle` is that `jsHandle.evaluateHandle` returns [JSHandle].

If the function passed to the `jsHandle.evaluateHandle` returns a [Promise], then `jsHandle.evaluateHandle` would wait
for the promise to resolve and return its value.

See [`method: Page.evaluateHandle`] for more details.

### param: JSHandle.evaluateHandle.expression = %%-evaluate-expression-%%
* since: v1.8

### param: JSHandle.evaluateHandle.expression = %%-js-evaluate-pagefunction-%%
* since: v1.8

### param: JSHandle.evaluateHandle.arg
* since: v1.8
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: JSHandle.getProperties
* since: v1.8
- returns: <[Map]<[string], [JSHandle]>>

The method returns a map with **own property names** as keys and JSHandle instances for the property values.

**Usage**

```js
const handle = await page.evaluateHandle(() => ({ window, document }));
const properties = await handle.getProperties();
const windowHandle = properties.get('window');
const documentHandle = properties.get('document');
await handle.dispose();
```

```java
JSHandle handle = page.evaluateHandle("() => ({ window, document })");
Map<String, JSHandle> properties = handle.getProperties();
JSHandle windowHandle = properties.get("window");
JSHandle documentHandle = properties.get("document");
handle.dispose();
```

```python async
handle = await page.evaluate_handle("({ window, document })")
properties = await handle.get_properties()
window_handle = properties.get("window")
document_handle = properties.get("document")
await handle.dispose()
```

```python sync
handle = page.evaluate_handle("({ window, document })")
properties = handle.get_properties()
window_handle = properties.get("window")
document_handle = properties.get("document")
handle.dispose()
```

```csharp
var handle = await page.EvaluateHandleAsync("() => ({ window, document }");
var properties = await handle.GetPropertiesAsync();
var windowHandle = properties["window"];
var documentHandle = properties["document"];
await handle.DisposeAsync();
```

## async method: JSHandle.getProperty
* since: v1.8
- returns: <[JSHandle]>

Fetches a single property from the referenced object.

### param: JSHandle.getProperty.propertyName
* since: v1.8
- `propertyName` <[string]>

property to get

## async method: JSHandle.jsonValue
* since: v1.8
- returns: <[Serializable]>

Returns a JSON representation of the object. If the object has a `toJSON` function, it **will not be called**.

:::note
The method will return an empty JSON object if the referenced object is not stringifiable. It will throw an error if the
object has circular references.
:::

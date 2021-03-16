---
id: events
title: "Events"
---

Playwright allows to listen to various types of events happening in the browser such
as network requests, creation of child pages, dedicated workers etc. There are several
ways to subscribe to such events:

<!-- TOC -->

## Waiting for event

There is a number of methods which wait for a particular condition or an event happening
in the page. They are usually preferred choice. Here is a few examples:

Waiting for request with specified url:

```js
const [request] = await Promise.all([
  page.waitForRequest('**/*logo*.png'),
  page.goto('https://wikipedia.org')
]);
console.log(request.url());
```

```java
// The callback lambda defines scope of the code that is expected to
// trigger request.
Request request = page.waitForRequest("**/*logo*.png", () -> {
  page.navigate("https://wikipedia.org");
});
System.out.println(request.url());
```

```python async
async with page.expect_request("**/*logo*.png") as first:
  await page.goto("https://wikipedia.org")
first_request = await first.value
print(first_request.url)
```

```python sync
with page.expect_request("**/*logo*.png") as first:
  page.goto("https://wikipedia.org")
print(first.value.url)
```

Waiting for popup window:

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.evaluate('window.open()')
]);
await popup.goto('https://wikipedia.org');
```

```java
// The callback lambda defines scope of the code that is expected to
// create popup window.
Page popup = page.waitForPopup(() -> {
  page.evaluate("window.open()");
});
popup.navigate("https://wikipedia.org");
```

```python async
async with page.expect_popup() as popup:
  await page.evaluate("window.open()")
child_page = await popup.value
await child_page.goto("https://wikipedia.org")
```

```python sync
with page.expect_popup() as popup:
  page.evaluate("window.open()")
popup.value.goto("https://wikipedia.org")
```

## Adding event listener

```js
page.on('requestfinished', request => console.log(`Request finished: ${request.url()}`));
await page.goto('https://wikipedia.org');
```

```java
page.onRequestFinished(request -> System.out.println("Request finished: " + request.url()));
page.navigate("https://wikipedia.org");
```

```python async
def print_request(request):
  print("Request finished: " + request.url)
page.on("requestfinished", print_request)
await page.goto("https://wikipedia.org")
```

```python sync
def print_request(request):
  print("Request finished: " + request.url)
page.on("requestfinished", print_request)
page.goto("https://wikipedia.org")
```

## Removing event listener

```js
const listener = request => console.log(`Request finished: ${request.url()}`)
page.on('requestfinished', listener);
await page.goto('https://wikipedia.org');
page.off('requestfinished', listener);
```

```java
Consumer<Request> listener = request -> System.out.println("Request finished: " + request.url());
page.onRequestFinished(listener);
page.navigate("https://wikipedia.org");
page.offRequestFinished(listener);
```

```python async
def print_request(request):
  print("Request finished: " + request.url)
page.on("requestfinished", print_request)
await page.goto("https://wikipedia.org")
page.remove_listener("requestfinished", print_request)
```

```python sync
def print_request(request):
  print("Request finished: " + request.url)
page.on("requestfinished", print_request)
page.goto("https://wikipedia.org")
page.remove_listener("requestfinished", print_request)
```

## Adding one-off listeners

If only next event needs to be handled there is convinience API for some of the events:

```js
page.once('dialog', dialog => dialog.accept("2021"));
await page.evaluate("prompt('Enter a number:')");
```

```java
page.onceDialog(dialog -> dialog.accept("2021"));
page.evaluate("prompt('Enter a number:')");
```

```python async
page.once("dialog", lambda dialog: dialog.accept("2021"))
await page.evaluate("prompt('Enter a number:')")
```

```python sync
page.once("dialog", lambda dialog: dialog.accept("2021"))
page.evaluate("prompt('Enter a number:')")
```

### API reference

- [Browser]
- [BrowserContext]
- [Page]
- [Worker]

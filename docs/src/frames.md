---
id: frames
title: "Frames"
---

## Introduction

A [Page] can have one or more [Frame] objects attached to it. Each page has a main frame and page-level interactions
(like `click`) are assumed to operate in the main frame.

A page can have additional frames attached with the `iframe` HTML tag. These frames can be accessed for interactions
inside the frame.

```js
// Locate element inside frame
const username = await page.frameLocator('.frame-class').getByLabel('User Name');
await username.fill('John');
```

```java
// Locate element inside frame
Locator username = page.frameLocator(".frame-class").getByLabel("User Name");
username.fill("John");
```

```python async
# Locate element inside frame
username = await page.frame_locator('.frame-class').get_by_label('User Name')
await username.fill('John')
```

```python sync
# Locate element inside frame
# Get frame using any other selector
username = page.frame_locator('.frame-class').get_by_label('User Name')
username.fill('John')
```

```csharp
// Locate element inside frame
var username = await page.FrameLocator(".frame-class").GetByLabel("User Name");
await username.FillAsync("John");
```

## Frame objects

One can access frame objects using the [`method: Page.frame`] API:

```js
// Get frame using the frame's name attribute
const frame = page.frame('frame-login');

// Get frame using frame's URL
const frame = page.frame({ url: /.*domain.*/ });

// Interact with the frame
await frame.fill('#username-input', 'John');
```

```java
// Get frame using the frame"s name attribute
Frame frame = page.frame("frame-login");

// Get frame using frame"s URL
Frame frame = page.frameByUrl(Pattern.compile(".*domain.*"));

// Interact with the frame
frame.fill("#username-input", "John");
```

```python async
# Get frame using the frame's name attribute
frame = page.frame('frame-login')

# Get frame using frame's URL
frame = page.frame(url=r'.*domain.*')

# Interact with the frame
await frame.fill('#username-input', 'John')
```

```python sync
# Get frame using the frame's name attribute
frame = page.frame('frame-login')

# Get frame using frame's URL
frame = page.frame(url=r'.*domain.*')

# Interact with the frame
frame.fill('#username-input', 'John')
```

```csharp
// Create a page.
var page = await context.NewPageAsync();

// Get frame using the frame's name attribute
var frame = page.Frame("frame-login");

// Get frame using frame's URL
var frame = page.FrameByUrl("*domain.");

// Get frame using any other selector
var frameElementHandle = await page.EvaluateAsync("window.frames[1]");
var frame = await frameElementHandle.ContentFrameAsync();

// Interact with the frame
await frame.FillAsync("#username-input", "John");
```

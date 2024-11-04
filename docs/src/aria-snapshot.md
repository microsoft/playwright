---
id: aria-snapshot
title: "Accessibility snapshots"
---

## Overview

Accessibility snapshots in Playwright are a YAML representation of elements on the page.
These snapshots can be stored and later compared to check if the page structure remains consistent or meets specified
expectations.

The YAML format for accessibility trees is used to describe the hierarchical structure of the elements on a web page,
including their roles, attributes, values and text content. The YAML structure follows a tree-like syntax where each node
represents an accessible element, and indentation reflects nesting within the hierarchy.

## Matching snapshots

The [`method: LocatorAssertions.toMatchAriaSnapshot`] assertion is a method used in Playwright to match the accessible
structure of a page against a defined accessibility snapshot template. This helps in verifying that the page's state
meets testing expectations.

**Example**: Match a heading element

```js
await page.setContent(`<h1>title</h1>`);
await expect(page.locator('body')).toMatchAriaSnapshot(`
  - heading "title"
`);
```

```python sync
page.set_content("<h1>title</h1>")
page.locator("body").to_match_aria_snapshot("""
  - heading "title"
""")
```

```python async
await page.set_content("<h1>title</h1>")
await page.locator("body").to_match_aria_snapshot("""
  - heading "title"
""")
```

```java
page.setContent("<h1>title</h1>");
page.locator("body").expect().toMatchAriaSnapshot("""
  - heading "title"
""");
```

```csharp
await page.SetContentAsync("<h1>title</h1>");
await Expect(page.Locator("body")).ToMatchAriaSnapshotAsync(@"
  - heading ""title""
");
```

**Example**: Match list

Lists can be matched partially.

```js
await page.setContent(`
  <ul aria-label="my list">
    <li>one</li>
    <li>two</li>
    <li>three</li>
    <li>four</li>
    <li>five</li>
  </ul>
`);
await expect(page.locator('body')).toMatchAriaSnapshot(`
  - list "my list":
    - listitem: one
    - listitem: three
    - listitem: five
`);
```

```python sync
page.set_content("""
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
      <li>three</li>
      <li>four</li>
      <li>five</li>
    </ul>
""")
page.locator("body").to_match_aria_snapshot("""
  - list "my list":
    - listitem: one
    - listitem: two
""")
```

```python async
await page.set_content("""
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
      <li>three</li>
      <li>four</li>
      <li>five</li>
    </ul>
""")
await page.locator("body").to_match_aria_snapshot("""
  - list "my list":
    - listitem: one
    - listitem: three
    - listitem: five
""")
```

```java
page.setContent("""
    <ul aria-label="my list">
      <li>one</li>
      <li>two</li>
      <li>three</li>
      <li>four</li>
      <li>five</li>
    </ul>
""");
page.locator("body").expect().toMatchAriaSnapshot("""
  - list "my list":
    - listitem: one
    - listitem: three
    - listitem: five
""");
```

```csharp
await page.SetContentAsync(@"
    <ul aria-label=""my list"">
      <li>one</li>
      <li>two</li>
      <li>three</li>
      <li>four</li>
      <li>five</li>
    </ul>
");
await Expect(page.Locator("body")).ToMatchAriaSnapshotAsync(@"
  - list ""my list"":
    - listitem: one
    - listitem: three
    - listitem: five
");
```

**Example**: Matching Elements with Attributes

Test elements with ARIA attributes, such as `checked`, `disabled`, `expanded`, `level`, `pressed` and `selected`, by specifying the attribute within square brackets.

```js
await page.setContent(`
  <input type='checkbox' checked />
`);

await expect(page.locator('body')).toMatchAriaSnapshot(`
  - checkbox [checked=true]
`);
```

```python sync
page.set_content("<input type='checkbox' checked />")
page.locator("body").to_match_aria_snapshot("""
  - checkbox [checked=true]
""")
```

```python async
await page.set_content("<input type='checkbox' checked />")
await page.locator("body").to_match_aria_snapshot("""
  - checkbox [checked=true]
""")
```

```java
page.setContent("<input type='checkbox' checked />");
page.locator("body").expect().toMatchAriaSnapshot("""
  - checkbox [checked=true]
""");
```

```csharp
await page.SetContentAsync("<input type='checkbox' checked />");
await Expect(page.Locator("body")).ToMatchAriaSnapshotAsync(@"
  - checkbox [checked=true]
");
```

**Example**: Matching with Regular Expressions

Use regular expressions to match elements with dynamic or varying text content.

```js
await page.setContent(`<h1>Issues 12</h1>`);
await expect(page.locator('body')).toMatchAriaSnapshot(`
  - heading /Issues \\d+/
`);
```

```python sync
page.set_content("<h1>Issues 12</h1>")
page.locator("body").to_match_aria_snapshot("""
  - heading /Issues \\d+/
""")
```

```python async
await page.set_content("<h1>Issues 12</h1>")
await page.locator("body").to_match_aria_snapshot("""
  - heading /Issues \\d+/
""")
```

```java
page.setContent("<h1>Issues 12</h1>");
page.locator("body").expect().toMatchAriaSnapshot("""
  - heading /Issues \\d+/
""");
```

```csharp
await page.SetContentAsync("<h1>Issues 12</h1>");
await Expect(page.Locator("body")).ToMatchAriaSnapshotAsync(@"
  - heading /Issues \\d+/
");
```

## Accessibility Tree

### Syntax Overview

Each accessible element in the accessibility tree is represented as a YAML node with the following structure:

```yaml
- role "name" [attribute=value]
```

- **role**: Specifies the ARIA or HTML role of the element, such as `heading`, `list`, `listitem`, `button`, etc.
- **"name"** (optional): Accessible name of the element. Quoted strings represent exact value, while regex patterns (e.g., `/pattern/`) match values dynamically.
- **[attribute=value]** (optional): Attributes and their values, enclosed in square brackets. Attributes include `checked`, `disabled`, `expanded`, `level`, `pressed` and `selected`, as specified by ARIA or HTML semantics.

When capturing the accessibility tree, these values are either extracted from the ARIA attributes, or are computed from the HTML semantics.

You can use [Chrome DevTools Accessibility Pane](https://developer.chrome.com/docs/devtools/accessibility/reference#pane) to inspect the
accessibility tree of a page and identify the roles, name, attributes, and text content of accessible elements.

**Example**: Headings with `level` attributes indicate heading levels

```html
<h1>Title</h1>
<h2>Subtitle</h2>
```

*accessibility tree*

```yaml
- heading "Title" [level=1]
- heading "Subtitle" [level=2]
```

**Example**: Text Nodes capture standalone or descriptive text elements

```html
<div>Sample accessible name</div>
```

*accessibility tree*

```yaml
- text: Sample accessible name
```

**Example**: Flattening of the multiline text

```html
<p>Line 1<br>Line 2</p>
```

*accessibility tree*

```yaml
- paragraph: Line 1 Line 2
```

**Example**: Links represent hyperlinks with text or composed text from pseudo-elements

```html
<a href="#more-info">Read more about Accessibility</a>
```

*accessibility tree*

```yaml
- link "Read more about Accessibility"
```


**Example**: Buttons represent interactive button elements, supporting states like `pressed` or `disabled`

```html
<button disabled>Submit</button>
```

*accessibility tree*

```yaml
- button "Submit" [disabled=true]
```

**Example**: Textboxes capture input elements, with the `value` attribute reflecting the content

```html
<input type="text" value="Enter your name">
```

*accessibility tree*

```yaml
- textbox: Enter your name
```

### Composite Structures

Accessibility tree follows DOM hierarchy. It does not include **presentation** and **none** roles and inlines text content
from the generic nodes.

**Example**: Lists capture ordered and unordered lists with list items

```html
<ul aria-label="Main Features">
  <li>Feature 1</li>
  <li>Feature 2</li>
</ul>
```

*accessibility tree*

```yaml
- list "Main Features":
  - listitem: Feature 1
  - listitem: Feature 2
```

**Example**: Groups capture grouped elements, such as `details` elements with `summary` text.

```html
<details>
  <summary>Summary</summary>
  <p>Detail content here</p>
</details>
```

*accessibility tree*

```yaml
- group: Summary
```

### Attributes and States

Attributes such as `checked`, `disabled`, `expanded`, `level`, `pressed`, and `selected` represent control states.

**Example**: Checkbox with `checked` attribute

```html
<input type="checkbox" checked>
```

*accessibility tree*

```yaml
- checkbox [checked=true]
```

or

```yaml
- checkbox [checked]
```

**Example**: Button with `pressed` attribute

```html
<button aria-pressed="true">Toggle</button>
```

```yaml
- button "Toggle" [pressed=true]
```

or

```yaml
- button "Toggle" [pressed]
```

### Full Document Examples

**Example**: Heading and Paragraph

```html
<h1>Welcome</h1>
<p>This is a sample paragraph</p>
```

*accessibility tree*

```yaml
- heading "Welcome" [level=1]
- paragraph: This is a sample paragraph
```

**Example**: Interactive List with Nested Elements

```html
<h2>Features</h2>
<ul aria-label="Main Features">
  <li><a href="#feature1">Feature 1</a></li>
  <li><a href="#feature2">Feature 2</a></li>
</ul>
```

*accessibility tree*


```yaml
- heading "Features" [level=2]
- list "Main Features":
  - listitem:
    - link "Feature 1"
  - listitem:
    - link "Feature 2"
```

**Example**: Complex Document with Pseudo-Elements and Attributes

```html
<style>
  p:before { content: 'hello '; }
</style>
<h1>Title</h1>
<p>Introductory text</p>
<a href="#more-info">Read more</a>
```

*accessibility tree*

```yaml
- heading "Title" [level=1]
- text: hello Introductory text
- link "Read more"
```

**Example**: Button with State Attributes

```html
<button aria-expanded="true">Toggle</button>
```

*accessibility tree*


```yaml
- button "Toggle" [expanded=true]
```

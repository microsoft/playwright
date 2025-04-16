---
id: aria-snapshots
title: "Snapshot testing"
---
import LiteYouTube from '@site/src/components/LiteYouTube';

## Overview

With Playwright's Snapshot testing you can assert the accessibility tree of a page against a predefined snapshot template.

```js
await page.goto('https://playwright.dev/');
await expect(page.getByRole('banner')).toMatchAriaSnapshot(`
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started"
    - link "Star microsoft/playwright on GitHub"
    - link /[\\d]+k\\+ stargazers on GitHub/
`);
```

```python sync
page.goto('https://playwright.dev/')
expect(page.query_selector('banner')).to_match_aria_snapshot("""
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started"
    - link "Star microsoft/playwright on GitHub"
    - link /[\\d]+k\\+ stargazers on GitHub/
""")
```

```python async
await page.goto('https://playwright.dev/')
await expect(page.query_selector('banner')).to_match_aria_snapshot("""
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started"
    - link "Star microsoft/playwright on GitHub"
    - link /[\\d]+k\\+ stargazers on GitHub/
""")
```

```java
page.navigate("https://playwright.dev/");
assertThat(page.locator("banner")).matchesAriaSnapshot("""
  - banner:
    - heading /Playwright enables reliable end-to-end/ [level=1]
    - link "Get started"
    - link "Star microsoft/playwright on GitHub"
    - link /[\\d]+k\\+ stargazers on GitHub/
""");
```

```csharp
await page.GotoAsync("https://playwright.dev/");
await Expect(page.Locator("banner")).ToMatchAriaSnapshotAsync(@"
  - banner:
    - heading ""Playwright enables reliable end-to-end testing for modern web apps."" [level=1]
    - link ""Get started""
    - link ""Star microsoft/playwright on GitHub""
    - link /[\\d]+k\\+ stargazers on GitHub/
");
```

<LiteYouTube
    id="P4R6hnsE0UY"
    title="Getting started with ARIA Snapshots"
/>

## Assertion testing vs Snapshot testing

Snapshot testing and assertion testing serve different purposes in test automation:

### Assertion testing
Assertion testing is a targeted approach where you assert specific values or conditions about elements or components. For instance, with Playwright, [`method: LocatorAssertions.toHaveText`]
verifies that an element contains the expected text, and [`method: LocatorAssertions.toHaveValue`]
confirms that an input field has the expected value.
Assertion tests are specific and generally check the current state of an element or property
against an expected, predefined state.
They work well for predictable, single-value checks but are limited in scope when testing the
broader structure or variations.

**Advantages**
- **Clarity**: The intent of the test is explicit and easy to understand.
- **Specificity**: Tests focus on particular aspects of functionality, making them more robust
  against unrelated changes.
- **Debugging**: Failures provide targeted feedback, pointing directly to the problematic aspect.

**Disadvantages**
- **Verbose for complex outputs**: Writing assertions for complex data structures or large outputs
  can be cumbersome and error-prone.
- **Maintenance overhead**: As code evolves, manually updating assertions can be time-consuming.

### Snapshot testing
Snapshot testing captures a “snapshot” or representation of the entire
state of an element, component, or data at a given moment, which is then saved for future
comparisons. When re-running tests, the current state is compared to the snapshot, and if there
are differences, the test fails. This approach is especially useful for complex or dynamic
structures, where manually asserting each detail would be too time-consuming. Snapshot testing
is broader and more holistic than assertion testing, allowing you to track more complex changes over time.

**Advantages**
- **Simplifies complex outputs**: For example, testing a UI component's rendered output can be tedious with traditional assertions. Snapshots capture the entire output for easy comparison.
- **Quick Feedback loop**: Developers can easily spot unintended changes in the output.
- **Encourages consistency**: Helps maintain consistent output as code evolves.

**Disadvantages**
- **Over-Reliance**: It can be tempting to accept changes to snapshots without fully understanding
  them, potentially hiding bugs.
- **Granularity**: Large snapshots may be hard to interpret when differences arise, especially
  if minor changes affect large portions of the output.
- **Suitability**: Not ideal for highly dynamic content where outputs change frequently or
  unpredictably.

### When to use

- **Snapshot testing** is ideal for:
  - UI testing of whole pages and components.
  - Broad structural checks for complex UI components.
  - Regression testing for outputs that rarely change structure.

- **Assertion testing** is ideal for:
  - Core logic validation.
  - Computed value testing.
  - Fine-grained tests requiring precise conditions.

By combining snapshot testing for broad, structural checks and assertion testing for specific functionality, you can achieve a well-rounded testing strategy.

## Aria snapshots

In Playwright, aria snapshots provide a YAML representation of the accessibility tree of a page.
These snapshots can be stored and compared later to verify if the page structure remains consistent or meets defined
expectations.

The YAML format describes the hierarchical structure of accessible elements on the page, detailing **roles**, **attributes**, **values**, and **text content**.
The structure follows a tree-like syntax, where each node represents an accessible element, and indentation indicates
nested elements.

Each accessible element in the tree is represented as a YAML node:

```yaml
- role "name" [attribute=value]
```

- **role**: Specifies the ARIA or HTML role of the element (e.g., `heading`, `list`, `listitem`, `button`).
- **"name"**: Accessible name of the element. Quoted strings indicate exact values, `/patterns/` are used for regular expression.
- **[attribute=value]**: Attributes and values, in square brackets, represent specific ARIA attributes, such
  as `checked`, `disabled`, `expanded`, `level`, `pressed`, or `selected`.

These values are derived from ARIA attributes or calculated based on HTML semantics. To inspect the accessibility tree
structure of a page, use the [Chrome DevTools Accessibility Tab](https://developer.chrome.com/docs/devtools/accessibility/reference#tab).


## Snapshot matching

The [`method: LocatorAssertions.toMatchAriaSnapshot`] assertion method in Playwright compares the accessible
structure of the locator scope with a predefined aria snapshot template, helping validate the page's state against
testing requirements.

For the following DOM:

```html
<h1>title</h1>
```

You can match it using the following snapshot template:

```js
await expect(page.locator('body')).toMatchAriaSnapshot(`
  - heading "title"
`);
```

```python sync
expect(page.locator("body")).to_match_aria_snapshot("""
  - heading "title"
""")
```

```python async
await expect(page.locator("body")).to_match_aria_snapshot("""
  - heading "title"
""")
```

```java
assertThat(page.locator("body")).matchesAriaSnapshot("""
  - heading "title"
""");
```

```csharp
await Expect(page.Locator("body")).ToMatchAriaSnapshotAsync(@"
  - heading ""title""
");
```

When matching, the snapshot template is compared to the current accessibility tree of the page:

* If the tree structure matches the template, the test passes; otherwise, it fails, indicating a mismatch between
  expected and actual accessibility states.
* The comparison is case-sensitive and collapses whitespace, so indentation and line breaks are ignored.
* The comparison is order-sensitive, meaning the order of elements in the snapshot template must match the order in the
  page's accessibility tree.


### Partial matching

You can perform partial matches on nodes by omitting attributes or accessible names, enabling verification of specific
parts of the accessibility tree without requiring exact matches. This flexibility is helpful for dynamic or irrelevant
attributes.

```html
<button>Submit</button>
```

*aria snapshot*

```yaml
- button
```

In this example, the button role is matched, but the accessible name ("Submit") is not specified, allowing the test to
pass regardless of the button's label.

<hr/>

For elements with ARIA attributes like `checked` or `disabled`, omitting these attributes allows partial matching,
focusing solely on role and hierarchy.

```html
<input type="checkbox" checked>
```

*aria snapshot for partial match*

```yaml
- checkbox
```

In this partial match, the `checked` attribute is ignored, so the test will pass regardless of the checkbox state.

<hr/>

Similarly, you can partially match children in lists or groups by omitting specific list items or nested elements.

```html
<ul>
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

*aria snapshot for partial match*

```yaml
- list
  - listitem: Feature B
```

Partial matches let you create flexible snapshot tests that verify essential page structure without enforcing
specific content or attributes.

### Strict matching

By default, a template containing the subset of children will be matched:

```html
<ul>
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

*aria snapshot for partial match*

```yaml
- list
  - listitem: Feature B
```


The `/children` property can be used to control how child elements are matched:
- `contain` (default): Matches if all specified children are present in order
- `equal`: Matches if the children exactly match the specified list in order
- `deep-equal`: Matches if the children exactly match the specified list in order, including nested children

```html
<ul>
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

*aria snapshot will fail due to Feature C not being in the template*

```yaml
- list
  - /children: equal
  - listitem: Feature A
  - listitem: Feature B
```

### Matching with regular expressions

Regular expressions allow flexible matching for elements with dynamic or variable text. Accessible names and text can
support regex patterns.

```html
<h1>Issues 12</h1>
```

*aria snapshot with regular expression*

```yaml
- heading /Issues \d+/
```

## Generating snapshots

Creating aria snapshots in Playwright helps ensure and maintain your application's structure.
You can generate snapshots in various ways depending on your testing setup and workflow.

### Generating snapshots with the Playwright code generator

If you're using Playwright's [Code Generator](./codegen.md), generating aria snapshots is streamlined with its
interactive interface:

- **"Assert snapshot" Action**: In the code generator, you can use the "Assert snapshot" action to automatically create
a snapshot assertion for the selected elements. This is a quick way to capture the aria snapshot as part of your
recorded test flow.

- **"Aria snapshot" Tab**: The "Aria snapshot" tab within the code generator interface visually represents the
aria snapshot for a selected locator, letting you explore, inspect, and verify element roles, attributes, and
accessible names to aid snapshot creation and review.

### Updating snapshots with `@playwright/test` and the `--update-snapshots` flag
* langs: js

When using the Playwright test runner (`@playwright/test`), you can automatically update snapshots with the `--update-snapshots` flag, `-u` for short.

Running tests with the `--update-snapshots` flag will update snapshots that did not match. Matching snapshots will not be updated.

```bash
npx playwright test --update-snapshots
```

Updating snapshots is useful when application structure changes require new snapshots as a baseline. Note that Playwright will wait for the maximum expect timeout specified in the test runner configuration to ensure the page is settled before taking the snapshot. It might be necessary to adjust the `--timeout` if the test hits the timeout while generating snapshots.

#### Empty template for snapshot generation

Passing an empty string as the template in an assertion generates a snapshot on-the-fly:

```js
await expect(locator).toMatchAriaSnapshot('');
```

Note that Playwright will wait for the maximum expect timeout specified in the test runner configuration to ensure the
page is settled before taking the snapshot. It might be necessary to adjust the `--timeout` if the test hits the timeout
while generating snapshots.

#### Snapshot patch files

When updating snapshots, Playwright creates patch files that capture differences. These patch files can be reviewed,
applied, and committed to source control, allowing teams to track structural changes over time and ensure updates are
consistent with application requirements.

The way source code is updated can be changed using the `--update-source-method` flag. There are several options available:

- **"patch"** (default): Generates a unified diff file that can be applied to the source code using `git apply`.
- **"3way"**: Generates merge conflict markers in your source code, allowing you to choose whether to accept changes.
- **"overwrite"**: Overwrites the source code with the new snapshot values.

```bash
npx playwright test --update-snapshots --update-source-method=3way
```

#### Snapshots as separate files

To store your snapshots in a separate file, use the `toMatchAriaSnapshot` method with the `name` option, specifying a `.aria.yml` file extension.

```js
await expect(page.getByRole('main')).toMatchAriaSnapshot({ name: 'main.aria.yml' });
```

By default, snapshots from a test file `example.spec.ts` are placed in the `example.spec.ts-snapshots` directory. As snapshots should be the same across browsers, only one snapshot is saved even if testing with multiple browsers. Should you wish, you can customize the [snapshot path template](./api/class-testconfig#test-config-snapshot-path-template) using the following configuration:

```js
export default defineConfig({
  expect: {
    toMatchAriaSnapshot: {
      pathTemplate: '__snapshots__/{testFilePath}/{arg}{ext}',
    },
  },
});
```

### Using the `Locator.ariaSnapshot` method

The [`method: Locator.ariaSnapshot`] method allows you to programmatically create a YAML representation of accessible
elements within a locator's scope, especially helpful for generating snapshots dynamically during test execution.

**Example**:

```js
const snapshot = await page.locator('body').ariaSnapshot();
console.log(snapshot);
```

```python sync
snapshot = page.locator("body").aria_snapshot()
print(snapshot)
```

```python async
snapshot = await page.locator("body").aria_snapshot()
print(snapshot)
```

```java
String snapshot = page.locator("body").ariaSnapshot();
System.out.println(snapshot);
```

```csharp
var snapshot = await page.Locator("body").AriaSnapshotAsync();
Console.WriteLine(snapshot);
```

This command outputs the aria snapshot within the specified locator's scope in YAML format, which you can validate
or store as needed.

## Accessibility tree examples

### Headings with level attributes

Headings can include a `level` attribute indicating their heading level.

```html
<h1>Title</h1>
<h2>Subtitle</h2>
```

*aria snapshot*

```yaml
- heading "Title" [level=1]
- heading "Subtitle" [level=2]
```

### Text nodes

Standalone or descriptive text elements appear as text nodes.

```html
<div>Sample accessible name</div>
```

*aria snapshot*

```yaml
- text: Sample accessible name
```

### Inline multiline text

Multiline text, such as paragraphs, is normalized in the aria snapshot.

```html
<p>Line 1<br>Line 2</p>
```

*aria snapshot*

```yaml
- paragraph: Line 1 Line 2
```

### Links

Links display their text or composed content from pseudo-elements.

```html
<a href="#more-info">Read more about Accessibility</a>
```

*aria snapshot*

```yaml
- link "Read more about Accessibility"
```

### Text boxes

Input elements of type `text` show their `value` attribute content.

```html
<input type="text" value="Enter your name">
```

*aria snapshot*

```yaml
- textbox: Enter your name
```

### Lists with items

Ordered and unordered lists include their list items.

```html
<ul aria-label="Main Features">
  <li>Feature 1</li>
  <li>Feature 2</li>
</ul>
```

*aria snapshot*

```yaml
- list "Main Features":
  - listitem: Feature 1
  - listitem: Feature 2
```

### Grouped elements

Groups capture nested elements, such as `<details>` elements with summary content.

```html
<details>
  <summary>Summary</summary>
  <p>Detail content here</p>
</details>
```

*aria snapshot*

```yaml
- group: Summary
```

### Attributes and states

Commonly used ARIA attributes, like `checked`, `disabled`, `expanded`, `level`, `pressed`, and `selected`, represent
control states.

#### Checkbox with `checked` attribute

```html
<input type="checkbox" checked>
```

*aria snapshot*

```yaml
- checkbox [checked]
```

#### Button with `pressed` attribute

```html
<button aria-pressed="true">Toggle</button>
```

*aria snapshot*

```yaml
- button "Toggle" [pressed=true]
```

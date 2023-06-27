# class: Accessibility
* since: v1.8
* langs: csharp, js, python
* deprecated: This class is deprecated. Please use other libraries such as [Axe](https://www.deque.com/axe/) if you need to test page accessibility. See our Node.js [guide](https://playwright.dev/docs/accessibility-testing) for integration with Axe.

The Accessibility class provides methods for inspecting Chromium's accessibility tree. The accessibility tree is used by
assistive technology such as [screen readers](https://en.wikipedia.org/wiki/Screen_reader) or
[switches](https://en.wikipedia.org/wiki/Switch_access).

Accessibility is a very platform-specific thing. On different platforms, there are different screen readers that might
have wildly different output.

Rendering engines of Chromium, Firefox and WebKit have a concept of "accessibility tree", which is then translated into different
platform-specific APIs. Accessibility namespace gives access to this Accessibility Tree.

Most of the accessibility tree gets filtered out when converting from internal browser AX Tree to Platform-specific AX-Tree or by
assistive technologies themselves. By default, Playwright tries to approximate this filtering, exposing only the
"interesting" nodes of the tree.

## async method: Accessibility.snapshot
* since: v1.8
* deprecated: This method is deprecated. Please use other libraries such as [Axe](https://www.deque.com/axe/) if you need to test page accessibility. See our Node.js [guide](https://playwright.dev/docs/accessibility-testing) for integration with Axe.

- returns: <[null]|[Object]>
  - `role` <[string]> The [role](https://www.w3.org/TR/wai-aria/#usage_intro).
  - `name` <[string]> A human readable name for the node.
  - `value` <[string]|[float]> The current value of the node, if applicable.
  - `description` <[string]> An additional human readable description of the node, if applicable.
  - `keyshortcuts` <[string]> Keyboard shortcuts associated with this node, if applicable.
  - `roledescription` <[string]> A human readable alternative to the role, if applicable.
  - `valuetext` <[string]> A description of the current value, if applicable.
  - `disabled` <[boolean]> Whether the node is disabled, if applicable.
  - `expanded` <[boolean]> Whether the node is expanded or collapsed, if applicable.
  - `focused` <[boolean]> Whether the node is focused, if applicable.
  - `modal` <[boolean]> Whether the node is [modal](https://en.wikipedia.org/wiki/Modal_window), if applicable.
  - `multiline` <[boolean]> Whether the node text input supports multiline, if applicable.
  - `multiselectable` <[boolean]> Whether more than one child can be selected, if applicable.
  - `readonly` <[boolean]> Whether the node is read only, if applicable.
  - `required` <[boolean]> Whether the node is required, if applicable.
  - `selected` <[boolean]> Whether the node is selected in its parent node, if applicable.
  - `checked` <[boolean]|"mixed"> Whether the checkbox is checked, or "mixed", if applicable.
  - `pressed` <[boolean]|"mixed"> Whether the toggle button is checked, or "mixed", if applicable.
  - `level` <[int]> The level of a heading, if applicable.
  - `valuemin` <[float]> The minimum value in a node, if applicable.
  - `valuemax` <[float]> The maximum value in a node, if applicable.
  - `autocomplete` <[string]> What kind of autocomplete is supported by a control, if applicable.
  - `haspopup` <[string]> What kind of popup is currently being shown for a node, if applicable.
  - `invalid` <[string]> Whether and in what way this node's value is invalid, if applicable.
  - `orientation` <[string]> Whether the node is oriented horizontally or vertically, if applicable.
  - `children` <[Array]<[Object]>> Child nodes, if any, if applicable.

Captures the current state of the accessibility tree. The returned object represents the root accessible node of the
page.

:::note
The Chromium accessibility tree contains nodes that go unused on most platforms and by most screen readers. Playwright
will discard them as well for an easier to process tree, unless [`option: interestingOnly`] is set to `false`.
:::

**Usage**

An example of dumping the entire accessibility tree:

```js
const snapshot = await page.accessibility.snapshot();
console.log(snapshot);
```

```java
String snapshot = page.accessibility().snapshot();
System.out.println(snapshot);
```

```python async
snapshot = await page.accessibility.snapshot()
print(snapshot)
```

```python sync
snapshot = page.accessibility.snapshot()
print(snapshot)
```

```csharp
var accessibilitySnapshot = await page.Accessibility.SnapshotAsync();
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(accessibilitySnapshot));
```

An example of logging the focused node's name:

```js
const snapshot = await page.accessibility.snapshot();
const node = findFocusedNode(snapshot);
console.log(node && node.name);

function findFocusedNode(node) {
  if (node.focused)
    return node;
  for (const child of node.children || []) {
    const foundNode = findFocusedNode(child);
    if (foundNode)
      return foundNode;
  }
  return null;
}
```

```csharp
var accessibilitySnapshot = await page.Accessibility.SnapshotAsync();
Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(accessibilitySnapshot));
```

```java
// FIXME
String snapshot = page.accessibility().snapshot();
```

```python async
def find_focused_node(node):
    if node.get("focused"):
        return node
    for child in (node.get("children") or []):
        found_node = find_focused_node(child)
        if found_node:
            return found_node
    return None

snapshot = await page.accessibility.snapshot()
node = find_focused_node(snapshot)
if node:
    print(node["name"])
```

```python sync
def find_focused_node(node):
    if node.get("focused"):
        return node
    for child in (node.get("children") or []):
        found_node = find_focused_node(child)
        if found_node:
            return found_node
    return None

snapshot = page.accessibility.snapshot()
node = find_focused_node(snapshot)
if node:
    print(node["name"])
```

## async method: Accessibility.snapshot
* since: v1.8
* langs: java
- returns: <[null]|[string]>

## async method: Accessibility.snapshot
* since: v1.8
* langs: csharp
- returns: <[null]|[JsonElement]>

### option: Accessibility.snapshot.interestingOnly
* since: v1.8
- `interestingOnly` <[boolean]>

Prune uninteresting nodes from the tree. Defaults to `true`.

### option: Accessibility.snapshot.root
* since: v1.8
- `root` <[ElementHandle]>

The root DOM element for the snapshot. Defaults to the whole page.

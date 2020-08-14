# Actionability

Playwright does a range of actionability checks on the elements before performing certain actions. These checks ensure that action behaves as expected, for example Playwright does not click on a disabled button.

Playwright waits until all the relevant actionability checks pass before performing an action. This means that action will fail with `TimeoutError` if checks do not pass within the specified `timeout`.

Some actions like `page.click()` support `{force: true}` option that disable non-essential actionability checks, for example passing `force` to `click()` method will not check that the target element actually receives click events.

| Actions | Performed checks |
| ------ | ------- |
| `check()`<br>`click()`<br>`dblclick()`<br>`uncheck()` | [Visible]<br>[Stable]<br>[Enabled]<br>[Receiving Events]<br>[Attached] |
| `hover()` | [Visible]<br>[Stable]<br>[Receiving Events]<br>[Attached] |
| `fill()` | [Visible]<br>[Enabled]<br>[Editable]<br>[Attached] |
| `dispatchEvent()`<br>`focus()`<br>`press()`<br>`setInputFiles()`<br>`selectOption()`<br>`type()` | [Attached] |
| `scrollIntoViewIfNeeded()`<br>`screenshot()` | [Visible]<br>[Stable]<br>[Attached] |
| `selectText()` | [Visible]<br>[Attached] |
| `getAttribute()`<br>`innerText()`<br>`innerHTML()`<br>`textContent()` | [Attached] |

### Visible

Element is considered visible when it has non-empty bounding box and does not have `visibility:hidden` computed style. Note that elements of zero size or with `display:none` are not considered visible.

### Stable

Element is considered stable when it has maintained the same bounding box for at least two consecutive animation frames.

### Enabled

Element is considered enabled when it is not a `<button>`, `<select>` or `<input>` with a `disabled` property set.

### Editable

Element is considered editable when it does not have `readonly` property set.

### Receiving events

Element is considered receiving pointer events when it is the hit target of the pointer event at the action point. For example, when clicking at the point `(10;10)`, Playwright checks whether some other element (usually an overlay) will instead capture the click at `(10;10)`.

### Attached

Element is considered attached when it is [connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected) to a Document or a ShadowRoot.

Attached check differs between selector-based and handle-based actions, like `page.click(selector, options)` as opposite to `elementHandle.click(options)`:
- For selector-based actions, Playwright first waits for an element matching `selector` to be attached to the DOM, and then checks that element is still attached before performing the action. If element was detached, the action is retried from the start.
- For handle-based actions, Playwright throws if the element is not attached.

For example, consider a scenario where Playwright will click `Sign Up` button regardless of when the `page.click()` call was made:
- page is checking that user name is unique and `Sign Up` button is disabled;
- after checking with the server, the disabled `Sign Up` button is replaced with another one that is now enabled.

[Visible]: #visible "Visible"
[Stable]: #stable "Stable"
[Enabled]: #enabled "Enabled"
[Editable]: #editable "Editable"
[Receiving Events]: #receiving-events "Receiving Events"
[Attached]: #attached "Attached"

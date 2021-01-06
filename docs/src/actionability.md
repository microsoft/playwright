---
id: actionability
title: "Actionability"
---

Playwright does a range of actionability checks on the elements before performing certain actions. These checks ensure that action behaves as expected, for example Playwright does not click on a disabled button.

Playwright waits until all the relevant actionability checks pass before performing an action. This means that action will fail with the `TimeoutError` if checks do not pass within the specified `timeout`.

Some actions like [`method: Page.click`] support `force` option that disables non-essential actionability checks, for example passing truthy `force` to [`method: Page.click`] method will not check that the target element actually receives click events.

| Action | [Attached] | [Visible] | [Stable] | [Receiving Events] | [Enabled] | [Editable] |
| :- | :-: | :-: | :-: | :-: | :-: | :-: |
| check | Yes | Yes | Yes | Yes | Yes | - |
| click | Yes | Yes | Yes | Yes | Yes | - |
| dblclick | Yes | Yes | Yes | Yes | Yes | - |
| tap | Yes | Yes | Yes | Yes | Yes | - |
| uncheck | Yes | Yes | Yes | Yes | Yes | - |
| hover | Yes | Yes | Yes | Yes | - | - |
| scrollIntoViewIfNeeded | Yes | Yes | Yes | - | - | - |
| screenshot | Yes | Yes | Yes | - | - | - |
| fill | Yes | Yes | - | - | Yes | Yes |
| selectText | Yes | Yes | - | - | - | - |
| dispatchEvent | Yes | - | - | - | - | - |
| focus | Yes | - | - | - | - | - |
| getAttribute | Yes | - | - | - | - | - |
| innerText | Yes | - | - | - | - | - |
| innerHTML | Yes | - | - | - | - | - |
| press | Yes | - | - | - | - | - |
| setInputFiles | Yes | - | - | - | - | - |
| selectOption | Yes | - | - | - | - | - |
| textContent | Yes | - | - | - | - | - |
| type | Yes | - | - | - | - | - |

<br/>

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

Attached check differs between selector-based and handle-based actions, like [`method: Page.click`] as opposite to [`method: ElementHandle.click`]:
- For selector-based actions, Playwright first waits for an element matching `selector` to be attached to the DOM, and then checks that element is still attached before performing the action. If element was detached, the action is retried from the start.
- For handle-based actions, Playwright throws if the element is not attached.

For example, consider a scenario where Playwright will click `Sign Up` button regardless of when the [`method: Page.click`] call was made:
- page is checking that user name is unique and `Sign Up` button is disabled;
- after checking with the server, the disabled `Sign Up` button is replaced with another one that is now enabled.

[Visible]: #visible "Visible"
[Stable]: #stable "Stable"
[Enabled]: #enabled "Enabled"
[Editable]: #editable "Editable"
[Receiving Events]: #receiving-events "Receiving Events"
[Attached]: #attached "Attached"

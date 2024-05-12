---
id: actionability
title: "Auto-waiting"
---

## Introduction

Playwright performs a range of actionability checks on the elements before making actions to ensure these actions
behave as expected. It auto-waits for all the relevant checks to pass and only then performs the requested action. If the required checks do not pass within the given `timeout`, action fails with the `TimeoutError`.

For example, for [`method: Locator.click`], Playwright will ensure that:
- locator resolves to exactly one element
- element is [Visible]
- element is [Stable], as in not animating or completed animation
- element [Receives Events], as in not obscured by other elements
- element is [Enabled]

Here is the complete list of actionability checks performed for each action:

| Action | [Visible] | [Stable] | [Receives Events] | [Enabled] | [Editable] |
| :- | :-: | :-: | :-: | :-: | :-: |
| [`method: Locator.check`] | Yes | Yes | Yes | Yes | - |
| [`method: Locator.click`] | Yes | Yes | Yes | Yes | - |
| [`method: Locator.dblclick`] | Yes | Yes | Yes | Yes | - |
| [`method: Locator.setChecked`] | Yes | Yes | Yes | Yes | - |
| [`method: Locator.tap`] | Yes | Yes | Yes | Yes | - |
| [`method: Locator.uncheck`] | Yes | Yes | Yes | Yes | - |
| [`method: Locator.hover`] | Yes | Yes | Yes | - | - |
| [`method: Locator.dragTo`] | Yes | Yes | Yes | - | - |
| [`method: Locator.screenshot`] | Yes | Yes | - | - | - |
| [`method: Locator.fill`] | Yes | - | - | Yes | Yes |
| [`method: Locator.clear`] | Yes | - | - | Yes | Yes |
| [`method: Locator.selectOption`] | Yes | - | - | Yes | - |
| [`method: Locator.selectText`] | Yes | - | - | - | - |
| [`method: Locator.scrollIntoViewIfNeeded`] | - | Yes | - | - | - |
| [`method: Locator.blur`] | - | - | - | - | - |
| [`method: Locator.dispatchEvent`] | - | - | - | - | - |
| [`method: Locator.focus`] | - | - | - | - | - |
| [`method: Locator.press`] | - | - | - | - | - |
| [`method: Locator.pressSequentially`] | - | - | - | - | - |
| [`method: Locator.setInputFiles`] | - | - | - | - | - |

## Forcing actions

Some actions like [`method: Locator.click`] support `force` option that disables non-essential actionability checks,
for example passing truthy `force` to [`method: Locator.click`] method will not check that the target element actually
receives click events.

## Assertions

Playwright includes auto-retrying assertions that remove flakiness by waiting until the condition is met, similarly to auto-waiting before actions.

| Assertion | Description |
| :- | :- |
| [`method: LocatorAssertions.toBeAttached`] | Element is attached |
| [`method: LocatorAssertions.toBeChecked`] | Checkbox is checked |
| [`method: LocatorAssertions.toBeDisabled`] | Element is disabled |
| [`method: LocatorAssertions.toBeEditable`] | Element is editable |
| [`method: LocatorAssertions.toBeEmpty`] | Container is empty |
| [`method: LocatorAssertions.toBeEnabled`] | Element is enabled |
| [`method: LocatorAssertions.toBeFocused`] | Element is focused |
| [`method: LocatorAssertions.toBeHidden`] | Element is not visible |
| [`method: LocatorAssertions.toBeInViewport`] | Element intersects viewport |
| [`method: LocatorAssertions.toBeVisible`] | Element is visible |
| [`method: LocatorAssertions.toContainText`] | Element contains text |
| [`method: LocatorAssertions.toHaveAttribute`] | Element has a DOM attribute |
| [`method: LocatorAssertions.toHaveClass`] | Element has a class property |
| [`method: LocatorAssertions.toHaveCount`] | List has exact number of children |
| [`method: LocatorAssertions.toHaveCSS`] | Element has CSS property |
| [`method: LocatorAssertions.toHaveId`] | Element has an ID |
| [`method: LocatorAssertions.toHaveJSProperty`] | Element has a JavaScript property |
| [`method: LocatorAssertions.toHaveText`] | Element matches text |
| [`method: LocatorAssertions.toHaveValue`] | Input has a value |
| [`method: LocatorAssertions.toHaveValues`] | Select has options selected |
| [`method: PageAssertions.toHaveTitle`] | Page has a title |
| [`method: PageAssertions.toHaveURL`] | Page has a URL |
| [`method: APIResponseAssertions.toBeOK`] | Response has an OK status |

Learn more in the [assertions guide](./test-assertions.md).

## Visible

Element is considered visible when it has non-empty bounding box and does not have `visibility:hidden` computed style.

Note that according to this definition:
* Elements of zero size **are not** considered visible.
* Elements with `display:none` **are not** considered visible.
* Elements with `opacity:0` **are** considered visible.

## Stable

Element is considered stable when it has maintained the same bounding box for at least two consecutive animation frames.

## Enabled

Element is considered enabled unless it is a `<button>`, `<select>`, `<input>` or `<textarea>` with a `disabled` property.

## Editable

Element is considered editable when it is [enabled] and does not have `readonly` property set.

## Receives Events

Element is considered receiving pointer events when it is the hit target of the pointer event at the action point. For example, when clicking at the point `(10;10)`, Playwright checks whether some other element (usually an overlay) will instead capture the click at `(10;10)`.


For example, consider a scenario where Playwright will click `Sign Up` button regardless of when the [`method: Locator.click`] call was made:
- page is checking that user name is unique and `Sign Up` button is disabled;
- after checking with the server, the disabled `Sign Up` button is replaced with another one that is now enabled.

[Visible]: #visible "Visible"
[Stable]: #stable "Stable"
[Enabled]: #enabled "Enabled"
[Editable]: #editable "Editable"
[Receives Events]: #receives-events "Receives Events"

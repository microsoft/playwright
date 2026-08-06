# class: By
* since: v1.63
* langs: js

[By] describes an element without being bound to a [Page] or a [Frame]. It is built with the
top-level [`property: Playwright.by`] object and turned into a regular [Locator] with
[`method: Page.get`], [`method: Frame.get`] or [`method: Locator.get`].

Since a [By] carries no page, it can be defined once at module scope and reused by every test,
which makes it a natural fit for page objects.

**Usage**

```js
import { by, expect, test } from '@playwright/test';

const saveButton = by.role('button', { name: 'Save' });
const todoItems = by.testId('todo-list').role('listitem');

test('saves a todo', async ({ page }) => {
  await page.get(saveButton).click();
  await expect(page.get(todoItems)).toHaveCount(1);
});
```

A [By] chain resolves to the same element as the matching [Locator] chain, so
`page.get(by.testId('list').text('Row'))` and `page.getByTestId('list').getByText('Row')` are
interchangeable. Chaining composes rather than replaces: `page.get(outer.get(inner))` and
`page.get(outer).get(inner)` describe the same element.

## method: By.altText
* since: v1.63
- returns: <[By]>

Matches a descendant element by its `alt` text.

### param: By.altText.text = %%-locator-get-by-text-text-%%
* since: v1.63

### option: By.altText.exact = %%-locator-get-by-text-exact-%%
* since: v1.63

## method: By.and
* since: v1.63
- returns: <[By]>

Narrows down the match to elements that match both this and the given [By].

**Usage**

```js
const saveButton = by.role('button').and(by.title('Subscribe'));
```

### param: By.and.by
* since: v1.63
- `by` <[By]>

Additional locator to match.

## method: By.describe
* since: v1.63
- returns: <[By]>

Describes the element, the description is used in the trace viewer and the reports.

### param: By.describe.description
* since: v1.63
- `description` <[string]>

Locator description.

## method: By.filter
* since: v1.63
- returns: <[By]>

Narrows down the match according to the options, for example filters by text. It can be chained to
filter multiple times.

**Usage**

```js
const rowWithButton = by.get('tr')
    .filter({ hasText: 'text in column 1' })
    .filter({ has: by.role('button', { name: 'column 2 button' }) });
```

### option: By.filter.has
* since: v1.63
- `has` <[By]>

Narrows down the results to those which contain elements matching this relative [By]. The inner
[By] is queried starting with the outer match, not the document root.

### option: By.filter.hasNot
* since: v1.63
- `hasNot` <[By]>

Matches elements that do not contain an element matching this relative [By]. The inner [By] is
queried starting with the outer match, not the document root.

### option: By.filter.hasNotText = %%-locator-option-has-not-text-%%
* since: v1.63

### option: By.filter.hasText = %%-locator-option-has-text-%%
* since: v1.63

### option: By.filter.visible = %%-locator-option-visible-%%
* since: v1.63

## method: By.first
* since: v1.63
- returns: <[By]>

Matches the first matching element.

## method: By.get
* since: v1.63
- returns: <[By]>

Matches a descendant element by a selector or by another [By].

**Usage**

```js
const firstCell = by.get('table').get('td').first();

const listItem = by.role('listitem');
const unread = by.testId('inbox').get(listItem).filter({ hasText: 'Unread' });
```

**Details**

Passing a [By] composes rather than replaces, so `outer.get(inner.get(innermost))` and
`outer.get(inner).get(innermost)` describe the same element.

### param: By.get.selectorOrBy
* since: v1.63
- `selectorOrBy` <[string]|[By]>

A selector or a [By] to match inside this one.

## method: By.label
* since: v1.63
- returns: <[By]>

Matches an input element by the text of the associated `<label>` or `aria-label` attribute.

### param: By.label.text = %%-locator-get-by-text-text-%%
* since: v1.63

### option: By.label.exact = %%-locator-get-by-text-exact-%%
* since: v1.63

## method: By.last
* since: v1.63
- returns: <[By]>

Matches the last matching element.

## method: By.nth
* since: v1.63
- returns: <[By]>

Matches the n-th matching element. It is zero based, `nth(0)` selects the first element.

### param: By.nth.index
* since: v1.63
- `index` <[int]>

## method: By.or
* since: v1.63
- returns: <[By]>

Matches elements matching either this or the given [By].

**Usage**

```js
const dialogOrButton = by.role('dialog').or(by.role('button'));
```

### param: By.or.by
* since: v1.63
- `by` <[By]>

Alternative locator to match.

## method: By.placeholder
* since: v1.63
- returns: <[By]>

Matches an input element by the placeholder text.

### param: By.placeholder.text = %%-locator-get-by-text-text-%%
* since: v1.63

### option: By.placeholder.exact = %%-locator-get-by-text-exact-%%
* since: v1.63

## method: By.role
* since: v1.63
- returns: <[By]>

Matches an element by its [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles),
[ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and
[accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

### param: By.role.role = %%-get-by-role-to-have-role-role-%%
* since: v1.63

### option: By.role.-inline- = %%-locator-get-by-role-option-list-v1.27-%%
* since: v1.63

### option: By.role.description = %%-locator-get-by-role-option-description-%%
* since: v1.63

### option: By.role.exact = %%-locator-get-by-role-option-exact-%%
* since: v1.63

## method: By.testId
* since: v1.63
- returns: <[By]>

Matches an element by the test id. The test id attribute is resolved when the [By] is bound to a
page, so a [By] built at module scope still honours
[`method: Selectors.setTestIdAttribute`] and the `testIdAttribute` option.

### param: By.testId.testId = %%-locator-get-by-test-id-test-id-%%
* since: v1.63

## method: By.text
* since: v1.63
- returns: <[By]>

Matches an element containing the given text.

### param: By.text.text = %%-locator-get-by-text-text-%%
* since: v1.63

### option: By.text.exact = %%-locator-get-by-text-exact-%%
* since: v1.63

## method: By.title
* since: v1.63
- returns: <[By]>

Matches an element by its `title` attribute.

### param: By.title.text = %%-locator-get-by-text-text-%%
* since: v1.63

### option: By.title.exact = %%-locator-get-by-text-exact-%%
* since: v1.63

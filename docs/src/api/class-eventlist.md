# class: EventList
* langs: js
* since: v1.28

Event list collects events of a certain kind for future use; instances
of this class are accessible via the [`property: Page.events`] getter.

Notice that event lists simply store all historic events of a given type and
might store outdated objects, e.g. `page.events.popup.all()` might return
already-closed pages.

Use event lists instead of a `Promise.all` pattern. Consider the following
example:

```js
// Before:
const [consoleMessage] = await Promise.all([
  page.waitForEvent('console'),
  page.getByText('Log Console Message').click(),
]);

// After:
page.events.console.track();
await page.getByText('Log Console Message').click();
const consoleMessage = await page.events.console.take();
```

## method: EventList.all
* since: v1.28
- returns: <[Array]<[any]>>

Returns all accumulated events.

## method: EventList.clear
* since: v1.28

Clears all accumulated events.

## async method: EventList.take
* since: v1.28
- returns: <[any]>

Returns the first event that satisfies condition, if any. If no condition
is given, returns the first accumulated event.

```js
page.events.console.track();
page.events.console.clear();
await page.getByText('Log Console Message').click();
const consoleMessage = await page.events.console.take();
```

### param: EventList.take.optionsOrPredicate
* since: v1.28
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[int]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## method: EventList.track
* since: v1.28

Enables event tracking.

## method: EventList.untrack
* since: v1.28

Disables event tracking.

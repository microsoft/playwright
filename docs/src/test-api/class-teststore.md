# class: TestStore
* since: v1.29
* langs: js

Playwright Test provides a global `store` object for passing values between project setup and tests. It is
an error to call store methods outside of setup and tests.

```js tab=js-js
const { setup, store } = require('@playwright/test');

setup('sign in', async ({ page, context }) => {
  // Save signed-in state to an entry named 'github-test-user'.
  const contextState = await context.storageState();
  await store.set('test-user', contextState)
});
```

```js tab=js-ts
import { setup, store } from '@playwright/test';

setup('sign in', async ({ page, context }) => {
  // Save signed-in state to an entry named 'github-test-user'.
  const contextState = await context.storageState();
  await store.set('test-user', contextState)
});
```

## async method: TestStore.get
* since: v1.29
- returns: <[any]>

Get named item from the store. Returns undefined if there is no value with given name.

### param: TestStore.get.name
* since: v1.29
- `name` <[string]>

Item name.

## async method: TestStore.set
* since: v1.29

Set value to the store.

### param: TestStore.set.name
* since: v1.29
- `name` <[string]>

Item name.

### param: TestStore.set.value
* since: v1.29
- `value` <[any]>

Item value. The value must be serializable to JSON. Passing `undefined` deletes the entry with given name.


# class: TestStorage
* since: v1.29
* langs: js

Playwright Test provides a global `storage` object for passing values between project setup and tests. It is
an error to call storage methods outside of setup and tests.

```js tab=js-js
const { setup, storage } = require('@playwright/test');

setup('sign in', async ({ page, context }) => {
  // Save signed-in state to an entry named 'github-test-user'.
  const contextState = await context.storageState();
  await storage.set('test-user', contextState)
});
```

```js tab=js-ts
import { setup, storage } from '@playwright/test';

setup('sign in', async ({ page, context }) => {
  // Save signed-in state to an entry named 'github-test-user'.
  const contextState = await context.storageState();
  await storage.set('test-user', contextState)
});
```

## async method: TestStorage.get
* since: v1.29
- returns: <[any]>

Get named item from the storage. Returns undefined if there is no value with given name.

### param: TestStorage.get.name
* since: v1.29
- `name` <[string]>

Item name.

## async method: TestStorage.set
* since: v1.29

Set value to the storage.

### param: TestStorage.set.name
* since: v1.29
- `name` <[string]>

Item name.

### param: TestStorage.set.value
* since: v1.29
- `value` <[any]>

Item value. The value must be serializable to JSON. Passing `undefined` deletes the entry with given name.


# class: TestStore
* since: v1.32
* langs: js

Playwright Test provides a global `store` object that can be used to read/write values on the filesystem. Each value is stored in its own file inside './playwright' directory, configurable with [`property: TestConfig.storeDir`].

```ts
import { test, store } from '@playwright/test';

test('get user name', async ({ page, context }) => {
  await page.goto('/');
  // Return mock user info from the store.
  await page.route('**/info/user', route => route.fulfill({ path: store.path('mocks/user.json')}))
  await page.getByText('My Profile');
  // Check that the name matches mock data.
  await expect(page.getByLabel('Name')).toHaveText('John');
});
```

## async method: TestStore.delete
* since: v1.32

Delete named item from the store. Does nothing if the path is not in the store.

### param: TestStore.delete.path
* since: v1.32
- `path` <[string]>

Item path.

## async method: TestStore.get
* since: v1.32
- returns: <[any]>

Get named item from the store. Returns undefined if there is no value with given path.

### param: TestStore.get.path
* since: v1.32
- `path` <[string]>

Item path.

## method: TestStore.path
* since: v1.32
- returns: <[string]>

Returns absolute path of the corresponding store entry on the file system.

### param: TestStore.path.path
* since: v1.32
- `path` <[string]>

Path of the item in the store.

## method: TestStore.root
* since: v1.32
- returns: <[string]>

Returns absolute path of the store root directory.

## async method: TestStore.set
* since: v1.32

Set value to the store.

### param: TestStore.set.path
* since: v1.32
- `path` <[string]>

Item path.

### param: TestStore.set.value
* since: v1.32
- `value` <[any]>

Item value. The value must be serializable to JSON. Passing `undefined` deletes the entry with given path.

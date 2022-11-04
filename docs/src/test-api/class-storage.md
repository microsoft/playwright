# class: Storage
* since: v1.28
* langs: js

Playwright Test provides a [`method: TestInfo.storage`] object for passing values between project setup and tests.
TODO: examples

## async method: Storage.get
* since: v1.28
- returns: <[any]>

Get named item from the storage. Returns undefined if there is no value with given name.

### param: Storage.get.name
* since: v1.28
- `name` <[string]>

Item name.

## async method: Storage.set
* since: v1.28

Set value to the storage.

### param: Storage.set.name
* since: v1.28
- `name` <[string]>

Item name.

### param: Storage.set.value
* since: v1.28
- `value` <[any]>

Item value. The value must be serializable to JSON. Passing `undefined` deletes the entry with given name.


# class: Storage
* since: v1.28
* langs: js

Playwright Test provides a `storage` fixture for passing values between project setup and tests.
TODO: examples

## method: Storage.get
* since: v1.28
- returns: <[any]>

Get named item from the store.

### param: Storage.get.name
* since: v1.28
- `name` <[string]>

Item name.

## method: Storage.set
* since: v1.28

Set value to the store.

### param: Storage.set.name
* since: v1.28
- `name` <[string]>

Item name.

### param: Storage.set.value
* since: v1.28
- `value` <[any]>

Item value. The value must be serializable to JSON.


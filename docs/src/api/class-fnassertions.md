# class: FnAssertions
* since: v1.62
* langs: js

The [FnAssertions] class provides assertion methods that can be used to make assertions about mock functions created with `expect.fn()`. Mock functions record their calls and results, so that the test can assert on how they were used, for example when handed to concurrent code as callbacks.

Assertions over a mock function are asynchronous and retried until they pass or the expect timeout is reached, similarly to the web-first assertions. Await them to get reliable results:

```js
import { test, expect } from '@playwright/test';

test('records a click', async ({ page }) => {
  const callback = expect.fn();
  await page.evaluate(({ callback }) => {
    document.addEventListener('click', () => callback('clicked'));
  }, { callback }, { exposeFunctions: true });
  await page.locator('body').click();
  await expect(callback).toHaveBeenCalledWith('clicked');
});
```

## property: FnAssertions.not
* since: v1.62
- returns: <[FnAssertions]>

Makes the assertion check for the opposite condition.

**Usage**

```js
const callback = expect.fn();
await expect(callback).not.toHaveBeenCalled();
```

## async method: FnAssertions.toHaveBeenCalled
* since: v1.62

Ensures the mock function has been called at least once.

**Usage**

```js
const callback = expect.fn();
callback('hello');
await expect(callback).toHaveBeenCalled();
```

## async method: FnAssertions.toHaveBeenCalledTimes
* since: v1.62

Ensures the mock function has been called exactly the expected number of times. Note that the assertion fails right away when the mock function has been called more times than expected, because the call count can only grow.

**Usage**

```js
const callback = expect.fn();
callback('one');
callback('two');
await expect(callback).toHaveBeenCalledTimes(2);
```

### param: FnAssertions.toHaveBeenCalledTimes.count
* since: v1.62
- `count` <[int]>

Expected number of calls.

## async method: FnAssertions.toHaveBeenCalledWith
* since: v1.62

Ensures the mock function has been called at least once with the specified arguments. Arguments are compared with the same algorithm as [`method: GenericAssertions.toEqual`], so asymmetric matchers like `expect.objectContaining()` are supported.

**Usage**

```js
const callback = expect.fn();
callback({ title: 'Hello', id: 17 });
await expect(callback).toHaveBeenCalledWith(expect.objectContaining({ title: 'Hello' }));
```

### param: FnAssertions.toHaveBeenCalledWith.args
* since: v1.62
- `args` <[Array]<[any]>>

Expected arguments.

## async method: FnAssertions.toHaveBeenLastCalledWith
* since: v1.62

Ensures the last call of the mock function was made with the specified arguments.

**Usage**

```js
const callback = expect.fn();
callback('first');
callback('last');
await expect(callback).toHaveBeenLastCalledWith('last');
```

### param: FnAssertions.toHaveBeenLastCalledWith.args
* since: v1.62
- `args` <[Array]<[any]>>

Expected arguments.

## async method: FnAssertions.toHaveBeenNthCalledWith
* since: v1.62

Ensures the n-th call of the mock function was made with the specified arguments.

**Usage**

```js
const callback = expect.fn();
callback('first');
callback('second');
await expect(callback).toHaveBeenNthCalledWith(2, 'second');
```

### param: FnAssertions.toHaveBeenNthCalledWith.n
* since: v1.62
- `n` <[int]>

One-based call index.

### param: FnAssertions.toHaveBeenNthCalledWith.args
* since: v1.62
- `args` <[Array]<[any]>>

Expected arguments.

## async method: FnAssertions.toHaveLastResolvedWith
* since: v1.62

Ensures the last call of the mock function resolved with the specified value. The assertion waits for the pending result of the call to settle.

**Usage**

```js
const load = expect.fn(async () => 'loaded');
await load();
await expect(load).toHaveLastResolvedWith('loaded');
```

### param: FnAssertions.toHaveLastResolvedWith.value
* since: v1.62
- `value` <[any]>

Expected resolved value.

## async method: FnAssertions.toHaveLastReturnedWith
* since: v1.62

Ensures the last call of the mock function returned the specified value. For mock functions with an async implementation, the returned value is a promise, see [`method: FnAssertions.toHaveLastResolvedWith`] instead.

**Usage**

```js
const callback = expect.fn().mockReturnValue('value');
callback();
await expect(callback).toHaveLastReturnedWith('value');
```

### param: FnAssertions.toHaveLastReturnedWith.value
* since: v1.62
- `value` <[any]>

Expected return value.

## async method: FnAssertions.toHaveNthResolvedWith
* since: v1.62

Ensures the n-th call of the mock function resolved with the specified value. The assertion waits for the pending result of the call to settle.

**Usage**

```js
const load = expect.fn(async id => `loaded ${id}`);
await load(1);
await load(2);
await expect(load).toHaveNthResolvedWith(2, 'loaded 2');
```

### param: FnAssertions.toHaveNthResolvedWith.n
* since: v1.62
- `n` <[int]>

One-based call index.

### param: FnAssertions.toHaveNthResolvedWith.value
* since: v1.62
- `value` <[any]>

Expected resolved value.

## async method: FnAssertions.toHaveNthReturnedWith
* since: v1.62

Ensures the n-th call of the mock function returned the specified value. For mock functions with an async implementation, the returned value is a promise, see [`method: FnAssertions.toHaveNthResolvedWith`] instead.

**Usage**

```js
const callback = expect.fn().mockReturnValueOnce('first').mockReturnValue('rest');
callback();
callback();
await expect(callback).toHaveNthReturnedWith(1, 'first');
await expect(callback).toHaveNthReturnedWith(2, 'rest');
```

### param: FnAssertions.toHaveNthReturnedWith.n
* since: v1.62
- `n` <[int]>

One-based call index.

### param: FnAssertions.toHaveNthReturnedWith.value
* since: v1.62
- `value` <[any]>

Expected return value.

## async method: FnAssertions.toHaveResolved
* since: v1.62

Ensures the mock function has resolved successfully at least once. A call counts as resolved when its returned promise has been fulfilled, or when it returned a non-promise value.

**Usage**

```js
const load = expect.fn(async () => 'loaded');
await load();
await expect(load).toHaveResolved();
```

## async method: FnAssertions.toHaveResolvedTimes
* since: v1.62

Ensures the mock function has resolved successfully exactly the expected number of times. Calls that threw, returned a rejected promise, or are still pending do not count.

**Usage**

```js
const load = expect.fn(async () => 'loaded');
await load();
await load();
await expect(load).toHaveResolvedTimes(2);
```

### param: FnAssertions.toHaveResolvedTimes.count
* since: v1.62
- `count` <[int]>

Expected number of resolved calls.

## async method: FnAssertions.toHaveResolvedWith
* since: v1.62

Ensures the mock function has resolved with the specified value at least once. Values are compared with the same algorithm as [`method: GenericAssertions.toEqual`], so asymmetric matchers like `expect.objectContaining()` are supported.

**Usage**

```js
const load = expect.fn(async id => ({ id, title: 'Hello' }));
await load(17);
await expect(load).toHaveResolvedWith(expect.objectContaining({ id: 17 }));
```

### param: FnAssertions.toHaveResolvedWith.value
* since: v1.62
- `value` <[any]>

Expected resolved value.

## async method: FnAssertions.toHaveReturned
* since: v1.62

Ensures the mock function has returned at least once, i.e. has been called and did not throw. Note that a mock function with an async implementation returns a promise and therefore counts as returned even if that promise is later rejected.

**Usage**

```js
const callback = expect.fn().mockReturnValue('value');
callback();
await expect(callback).toHaveReturned();
```

## async method: FnAssertions.toHaveReturnedTimes
* since: v1.62

Ensures the mock function has returned exactly the expected number of times. Calls that threw do not count.

**Usage**

```js
const callback = expect.fn().mockReturnValue('value');
callback();
callback();
await expect(callback).toHaveReturnedTimes(2);
```

### param: FnAssertions.toHaveReturnedTimes.count
* since: v1.62
- `count` <[int]>

Expected number of returns.

## async method: FnAssertions.toHaveReturnedWith
* since: v1.62

Ensures the mock function has returned the specified value at least once. Values are compared with the same algorithm as [`method: GenericAssertions.toEqual`], so asymmetric matchers like `expect.objectContaining()` are supported. For mock functions with an async implementation, the returned value is a promise, see [`method: FnAssertions.toHaveResolvedWith`] instead.

**Usage**

```js
const callback = expect.fn().mockReturnValue({ title: 'Hello' });
callback();
await expect(callback).toHaveReturnedWith(expect.objectContaining({ title: 'Hello' }));
```

### param: FnAssertions.toHaveReturnedWith.value
* since: v1.62
- `value` <[any]>

Expected return value.

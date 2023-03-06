# class: GenericAssertions
* since: v1.9
* langs: js

The [GenericAssertions] class provides assertion methods that can be used to make assertions about any values in the tests. A new instance of [GenericAssertions] is created by calling [`method: PlaywrightAssertions.expectGeneric`]:

```js
import { test, expect } from '@playwright/test';

test('assert a value', async ({ page }) => {
  const value = 1;
  await expect(value).toBe(2);
});
```

## property: GenericAssertions.not
* since: v1.9
- returns: <[GenericAssertions]>

Makes the assertion check for the opposite condition. For example, the following code passes:

```js
const value = 1;
await expect(value).not.toBe(2);
```


## method: GenericAssertions.toBe
* since: v1.9

Compares value with [`param: expected`] by calling `Object.is`. This method compares objects by reference instead of their contents, similarly to the strict equality operator `===`.

**Usage**

```js
const value = { prop: 1 };
expect(value).toBe(value);
expect(value).not.toBe({});
expect(value.prop).toBe(1);
```

### param: GenericAssertions.toBe.expected
* since: v1.9
- `expected` <[any]>

Expected value.



## method: GenericAssertions.toBeCloseTo
* since: v1.9

Compares floating point numbers for approximate equality. Use this method instead of [`method: GenericAssertions.toBe`] when comparing floating point numbers.

**Usage**

```js
expect(0.1 + 0.2).not.toBe(0.3);
expect(0.1 + 0.2).toBeCloseTo(0.3, 5);
```

### param: GenericAssertions.toBeCloseTo.expected
* since: v1.9
- `expected` <[float]>

Expected value.

### param: GenericAssertions.toBeCloseTo.numDigits
* since: v1.9
- `numDigits` ?<[int]>

The number of decimal digits after the decimal point that must be equal.



## method: GenericAssertions.toBeDefined
* since: v1.9

Ensures that value is not `undefined`.

**Usage**

```js
const value = null;
expect(value).toBeDefined();
```


## method: GenericAssertions.toBeFalsy
* since: v1.9

Ensures that value is false in a boolean context, one of `false`, `0`, `''`, `null`, `undefined` or `NaN`. Use this method when you don't care about the specific value.

**Usage**

```js
const value = null;
expect(value).toBeFalsy();
```


## method: GenericAssertions.toBeGreaterThan
* since: v1.9

Ensures that `value > expected` for number or big integer values.

**Usage**

```js
const value = 42;
expect(value).toBeGreaterThan(1);
```

### param: GenericAssertions.toBeGreaterThan.expected
* since: v1.9
- `expected` <[float]|[bigint]>

The value to compare to.



## method: GenericAssertions.toBeGreaterThanOrEqual
* since: v1.9

Ensures that `value >= expected` for number or big integer values.

**Usage**

```js
const value = 42;
expect(value).toBeGreaterThanOrEqual(42);
```

### param: GenericAssertions.toBeGreaterThanOrEqual.expected
* since: v1.9
- `expected` <[float]|[bigint]>

The value to compare to.



## method: GenericAssertions.toBeInstanceOf
* since: v1.9

Ensures that value is an instance of a class. Uses `instanceof` operator.

**Usage**

```js
expect(page).toBeInstanceOf(Page);

class Example {}
expect(new Example()).toBeInstanceOf(Example);
```

### param: GenericAssertions.toBeInstanceOf.expected
* since: v1.9
- `expected` <[Function]>

The class or constructor function.



## method: GenericAssertions.toBeLessThan
* since: v1.9

Ensures that `value < expected` for number or big integer values.

**Usage**

```js
const value = 42;
expect(value).toBeLessThan(100);
```

### param: GenericAssertions.toBeLessThan.expected
* since: v1.9
- `expected` <[float]|[bigint]>

The value to compare to.



## method: GenericAssertions.toBeLessThanOrEqual
* since: v1.9

Ensures that `value <= expected` for number or big integer values.

**Usage**

```js
const value = 42;
expect(value).toBeLessThanOrEqual(42);
```

### param: GenericAssertions.toBeLessThanOrEqual.expected
* since: v1.9
- `expected` <[float]|[bigint]>

The value to compare to.



## method: GenericAssertions.toBeNaN
* since: v1.9

Ensures that value is `NaN`.

**Usage**

```js
const value = NaN;
expect(value).toBeNaN();
```


## method: GenericAssertions.toBeNull
* since: v1.9

Ensures that value is `null`.

**Usage**

```js
const value = null;
expect(value).toBeNull();
```



## method: GenericAssertions.toBeTruthy
* since: v1.9

Ensures that value is true in a boolean context, **anything but** `false`, `0`, `''`, `null`, `undefined` or `NaN`. Use this method when you don't care about the specific value.

**Usage**

```js
const value = { example: 'value' };
expect(value).toBeTruthy();
```


## method: GenericAssertions.toBeUndefined
* since: v1.9

Ensures that value is `undefined`.

**Usage**

```js
const value = undefined;
expect(value).toBeUndefined();
```


## method: GenericAssertions.toContain#1
* since: v1.9

Ensures that string value contains an expected substring. Comparison is case-sensitive.

**Usage**

```js
const value = 'Hello, World';
expect(value).toContain('World');
expect(value).toContain(',');
```

### param: GenericAssertions.toContain#1.expected
* since: v1.9
- `expected` <[string]>

Expected substring.



## method: GenericAssertions.toContain#2
* since: v1.9

Ensures that value is an `Array` or `Set` and contains an expected item.

**Usage**

```js
const value = [1, 2, 3];
expect(value).toContain(2);
expect(new Set(value)).toContain(2);
```

### param: GenericAssertions.toContain#2.expected
* since: v1.9
- `expected` <[any]>

Expected value in the collection.



## method: GenericAssertions.toContainEqual
* since: v1.9

Ensures that value is an `Array` or `Set` and contains an item equal to the expected.

For objects, this method recursively checks equality of all fields, rather than comparing objects by reference as performed by [`method: GenericAssertions.toContain#2`].

For primitive values, this method is equivalent to [`method: GenericAssertions.toContain#2`].

**Usage**

```js
const value = [
  { example: 1 },
  { another: 2 },
  { more: 3 },
];
expect(value).toContainEqual({ another: 2 });
expect(new Set(value)).toContainEqual({ another: 2 });
```

### param: GenericAssertions.toContainEqual.expected
* since: v1.9
- `expected` <[any]>

Expected value in the collection.



## method: GenericAssertions.toEqual
* since: v1.9

Compares contents of the value with contents of [`param: expected`], performing "deep equality" check.

For objects, this method recursively checks equality of all fields, rather than comparing objects by reference as performed by [`method: GenericAssertions.toBe`].

For primitive values, this method is equivalent to [`method: GenericAssertions.toBe`].

**Usage**

```js
const value = { prop: 1 };
expect(value).toEqual({ prop: 1 });
```

### param: GenericAssertions.toEqual.expected
* since: v1.9
- `expected` <[any]>

Expected value.



## method: GenericAssertions.toHaveLength
* since: v1.9

Ensures that value has a `.length` property equal to [`param: expected`]. Useful for arrays and strings.

**Usage**

```js
expect('Hello, World').toHaveLength(12);
expect([1, 2, 3]).toHaveLength(3);
```

### param: GenericAssertions.toHaveLength.expected
* since: v1.9
- `expected` <[int]>

Expected length.



## method: GenericAssertions.toHaveProperty
* since: v1.9

Ensures that property at provided `keyPath` exists on the object and optionally checks that property is equal to the [`param: expected`]. Equality is checked recursively, similarly to [`method: GenericAssertions.toEqual`].

**Usage**

```js
const value = {
  a: {
    b: [42],
  },
  c: true,
};
expect(value).toHaveProperty('a.b');
expect(value).toHaveProperty('a.b', [42]);
expect(value).toHaveProperty('a.b[0]', 42);
expect(value).toHaveProperty('c');
expect(value).toHaveProperty('c', true);
```

### param: GenericAssertions.toHaveProperty.keyPath
* since: v1.9
- `keyPath` <[string]>

Path to the property. Use dot notation `a.b` to check nested properties and indexed `a[2]` notation to check nested array items.

### param: GenericAssertions.toHaveProperty.expected
* since: v1.9
- `expected` ?<[any]>

Optional expected value to compare the property to.



## method: GenericAssertions.toMatch
* since: v1.9

Ensures that string value matches a regular expression.

**Usage**

```js
const value = 'Is 42 enough?';
expect(value).toMatch(/Is \d+ enough/);
```

### param: GenericAssertions.toMatch.expected
* since: v1.9
- `expected` <[RegExp]>

Regular expression to match against.



## method: GenericAssertions.toMatchObject
* since: v1.9

Compares contents of the value with contents of [`param: expected`], performing "deep equality" check. Allows extra properties to be present in the value, unlike [`method: GenericAssertions.toEqual`], so you can check just a subset of object properties.

When comparing arrays, the number of items must match, and each item is checked recursively.

**Usage**

```js
const value = {
  a: 1,
  b: 2,
  c: true,
};
expect(value).toMatchObject({ a: 1, c: true });
expect(value).toMatchObject({ b: 2, c: true });

expect([{ a: 1, b: 2 }]).toMatchObject([{ a: 1 }]);
```

### param: GenericAssertions.toMatchObject.expected
* since: v1.9
- `expected` <[Object]|[Array]>

The expected object value to match against.



## method: GenericAssertions.toStrictEqual
* since: v1.9

Compares contents of the value with contents of [`param: expected`] **and** their types.

Differences from [`method: GenericAssertions.toEqual`]:

* Keys with undefined properties are checked. For example, `{ a: undefined, b: 2 }` does not match `{ b: 2 }`.
* Array sparseness is checked. For example, `[, 1]` does not match `[undefined, 1]`.
* Object types are checked to be equal. For example, a class instance with fields `a` and `b` will not equal a literal object with fields `a` and `b`.

**Usage**

```js
const value = { prop: 1 };
expect(value).toStrictEqual({ prop: 1 });
```

### param: GenericAssertions.toStrictEqual.expected
* since: v1.9
- `expected` <[any]>

Expected value.



## method: GenericAssertions.toThrow
* since: v1.9

Calls the function and ensures it throws an error.

Optionally compares the error with [`param: expected`]. Allowed expected values:
* Regular expression - error message should **match** the pattern.
* String - error message should **include** the substring.
* Error object - error message should be **equal to** the message property of the object.
* Error class - error object should be an **instance of** the class.

**Usage**

```js
expect(() => {
  throw new Error('Something bad');
}).toThrow();

expect(() => {
  throw new Error('Something bad');
}).toThrow(/something/);

expect(() => {
  throw new Error('Something bad');
}).toThrow(Error);
```

### param: GenericAssertions.toThrow.expected
* since: v1.9
- `expected` ?<[any]>

Expected error message or error object.



## method: GenericAssertions.toThrowError
* since: v1.9

An alias for [`method: GenericAssertions.toThrow`].

**Usage**

```js
expect(() => {
  throw new Error('Something bad');
}).toThrowError();
```

### param: GenericAssertions.toThrowError.expected
* since: v1.9
- `expected` ?<[any]>

Expected error message or error object.

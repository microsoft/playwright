# class: Foo

## method: Foo.bar

### option: Foo.bar.x
- `x` <[number]>

### option: Foo.bar.y
- `y` <[number]>

### option: Foo.bar.nullable
- `nullable` <?[string]>

### option: Foo.bar.maybe
- `maybe` <[number]>

### option: Foo.bar.object
- `object` <[Object]>
  - `one` <[number]>
  - `two` <[number]> defaults to `2`.

## method: Foo.baz
- returns: <?[Object]>
  - `abc` <[number]>
  - `def` <[number]> if applicable.
  - `ghi` <[string]>

## method: Foo.goBack
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go back, resolves to `null`.

## method: Foo.response
- returns: <?[Response]> A matching [Response] object, or `null` if the response has not been received yet.

# class: Headers

HTTP request and response raw headers collection.

## method: Headers.get
- returns: <[string|null]>
Returns header value for the given name.

### param: Headers.get.name
- `name` <[string]>
Header name, case-insensitive.

## method: Headers.getAll
- returns: <[Array]<[string]>>

Returns all header values for the given header name.

### param: Headers.getAll.name
- `name` <[string]>
Header name, case-insensitive.

## method: Headers.headerNames
- returns: <[Array]<[string]>>

Returns all header names in this headers collection.

## method: Headers.headers
- returns: <[Array]<{ name: string, value: string }>>

Returns all raw headers.

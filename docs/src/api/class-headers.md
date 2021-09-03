# class: Headers

HTTP request and response all headers collection.

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
- returns: <[Object]<[string], [string]>>

Returns all headers as a dictionary. Header names are normalized to lower case, multi-value headers are concatenated
using comma.

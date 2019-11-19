### class: Foo

This is a class.

#### event: 'frame'
- <[Frame]>

This event is dispatched.

#### foo.$(selector)
- `selector` <[string]> A selector to query page for
- returns: <[Promise]<[ElementHandle]>>

The method runs document.querySelector.

#### foo.url
- <[string]>

Contains the URL of the request.

[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[ElementHandle]: # "ElementHandle"
[ElementHandle]: # "Frame"

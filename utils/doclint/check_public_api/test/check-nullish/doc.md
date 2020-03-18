### class: Foo

#### foo.bar(options)
- `options` <[Object]>
  - `x` <[number]>  **required**
  - `y` <[number]>  **required**
  - `nullable` <?[string]>  **required**
  - `maybe` <[number]>
  - `object` <[Object]>
    - `one` <[number]>
    - `two` <[number]> defaults to `2`.

#### foo.baz()
- returns: <?[Object]>
  - `abc` <[number]>
  - `def` <[number]> if applicable.
  - `ghi` <[string]>


#### foo.goBack()
- returns: <[Promise]<?[Response]>> Promise which resolves to the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If
can not go back, resolves to `null`.

#### foo.response()
- returns: <?[Response]> A matching [Response] object, or `null` if the response has not been received yet.


[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Object_type "Object"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type "number"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Promise_type "Promise"
[Response]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Response_type "Response"

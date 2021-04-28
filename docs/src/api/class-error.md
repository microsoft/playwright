# class: Error
* langs: python
* extends: [Exception]

Error is raised whenever certain operations are terminated abnormally, e.g.
browser closes while [`method: Page.evaluate`] is running. All Playwright exceptions
inherit from this class.

- [error.message](./api/class-error.mdx#errormessage)
- [error.name](./api/class-error.mdx#errorname)
- [error.stack](./api/class-error.mdx#errorstack)

## property: Error.message
- returns: <[str]>

Message of the error.

## property: Error.name
- returns: <[str]>

Name of the error which got thrown inside the browser. Optional.

## property: Error.stack
- returns: <[str]>

Stack of the error which got thrown inside the browser. Optional.

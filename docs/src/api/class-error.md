# class: Error
* since: v1.11
* langs: python
* extends: [Exception]

Error is raised whenever certain operations are terminated abnormally, e.g.
browser closes while [`method: Page.evaluate`] is running. All Playwright exceptions
inherit from this class.

## property: Error.message
* since: v1.11
- returns: <[str]>

Message of the error.

## property: Error.name
* since: v1.11
- returns: ?<[str]>

Name of the error which got thrown inside the browser. Optional.

## property: Error.stack
* since: v1.11
- returns: ?<[str]>

Stack of the error which got thrown inside the browser. Optional.

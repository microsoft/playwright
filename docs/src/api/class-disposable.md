# class: Disposable
* since: v1.59
* langs: js, python

[Disposable] is returned from various methods to allow undoing the corresponding action. For example,
[`method: Page.addInitScript`] returns a [Disposable] that can be used to remove the init script.

## async method: Disposable.close
* since: v1.59
* langs: python

Removes the associated resource. For example, removes the init script installed via
[`method: Page.addInitScript`] or [`method: BrowserContext.addInitScript`].

## async method: Disposable.dispose
* since: v1.59
* langs: js

Removes the associated resource. For example, removes the init script installed via
[`method: Page.addInitScript`] or [`method: BrowserContext.addInitScript`].

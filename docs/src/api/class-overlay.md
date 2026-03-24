# class: Overlay
* since: v1.59

Interface for managing page overlays that display persistent visual indicators on top of the page.

## async method: Overlay.add
* since: v1.59
- returns: <[Disposable]>

Adds an overlay with the given HTML content. The overlay is displayed on top of the page until removed. Returns a disposable that removes the overlay when disposed.

### param: Overlay.add.html
* since: v1.59
- `html` <[string]>

HTML content for the overlay.

### option: Overlay.add.timeout
* since: v1.59
- `timeout` <[int]>

Optional timeout to remove the decoration after. Decoration stays until dismissed if not provided.

## async method: Overlay.configure
* since: v1.59

Configures overlay behavior.

### option: Overlay.configure.actionDelay
* since: v1.59
- `actionDelay` <[int]>

Delay in milliseconds between actions when overlay is active.

### option: Overlay.configure.actionStyle
* since: v1.59
- `actionStyle` <[string]>

CSS style string applied to the action title element displayed during actions.

### option: Overlay.configure.locatorStyle
* since: v1.59
- `locatorStyle` <[string]>

CSS style string applied to the locator highlight element displayed during actions.

## async method: Overlay.hide
* since: v1.59

Hides all overlays without removing them. Overlays can be shown again with [`method: Overlay.show`].

## async method: Overlay.show
* since: v1.59

Shows previously hidden overlays.

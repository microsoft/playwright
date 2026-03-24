# class: Overlay
* since: v1.59

Interface for managing page overlays that display persistent visual indicators on top of the page.

## async method: Overlay.show
* since: v1.59
- returns: <[Disposable]>

Adds an overlay with the given HTML content. The overlay is displayed on top of the page until removed. Returns a disposable that removes the overlay when disposed.

### param: Overlay.show.html
* since: v1.59
- `html` <[string]>

HTML content for the overlay.

### option: Overlay.show.duration
* since: v1.59
- `duration` <[float]>

Duration in milliseconds after which the overlay is automatically removed. Overlay stays until dismissed if not provided.

## async method: Overlay.chapter
* since: v1.59

Shows a chapter overlay with a title and optional description, centered on the page with a blurred backdrop. Useful for narrating video recordings. The overlay is removed after the specified duration, or 2000ms.

### param: Overlay.chapter.title
* since: v1.59
- `title` <[string]>

Title text displayed prominently in the overlay.

### option: Overlay.chapter.description
* since: v1.59
- `description` <[string]>

Optional description text displayed below the title.

### option: Overlay.chapter.duration
* since: v1.59
- `duration` <[float]>

Duration in milliseconds after which the overlay is automatically removed. Defaults to `2000`.

## async method: Overlay.setVisible
* since: v1.59

Sets visibility of all overlays without removing them.

### param: Overlay.setVisible.visible
* since: v1.59
- `visible` <[boolean]>

Whether overlays should be visible.

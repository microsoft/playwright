# class: CrxApplication
* since: v1.**
* langs: js

## method: CrxApplication.context
* since: v1.**
- returns: <[BrowserContext]>

This method returns browser context that can be used for setting up context-wide routing, etc.

## method: CrxApplication.pages
* since: v1.**
- returns: <[Array]<[Page]>>

Convenience method that returns all the attached pages.

## async method: CrxApplication.close
* since: v1.**

Detaches all pages and closes.

## async method: CrxApplication.attach
* since: v1.**
- returns: <[Page]>

Attach a tab and returns the corresponding `Page`.

### param: CrxApplication.attach.tabId
* since: v1.**
- `tabId` <[int]>

## async method: CrxApplication.attachAll
* since: v1.**
- returns: <[Array]<[Page]>>

### option: CrxApplication.attachAll.status
* since: v1.**
- `status` <null|[TabStatus]<"loading"|"complete"|"serial">>

Optional. Whether the tabs have completed loading. One of: "loading", or "complete"

### option: CrxApplication.attachAll.lastFocusedWindow
* since: v1.**
- `lastFocusedWindow` <null|[boolean]>

Optional. Whether the tabs are in the last focused window.
@since Chrome 19.

### option: CrxApplication.attachAll.windowId
* since: v1.**
- `windowId` <null|[int]>

Optional. The ID of the parent window, or `windows.WINDOW_ID_CURRENT` for the current window.

### option: CrxApplication.attachAll.windowType
* since: v1.**
- `windowType` <null|[TabStatus]<"normal"|"popup"|"panel"|"app"|"devtools">>

Optional. The type of window the tabs are in. One of: "normal", "popup", "panel", "app", or "devtools"

### option: CrxApplication.attachAll.active
* since: v1.**
- `active` <null|[boolean]>

Optional. Whether the tabs are active in their windows.

### option: CrxApplication.attachAll.index
* since: v1.**
- `index` <null|[int]>

Optional. The position of the tabs within their windows.
@since Chrome 18.

### option: CrxApplication.attachAll.title
* since: v1.**
- `title` <null|[string]>

Optional. Match page titles against a pattern.

### option: CrxApplication.attachAll.url
* since: v1.**
- `url` <null|[string]|[Array]<[string]>>

Optional. Match tabs against one or more URL patterns. Note that fragment identifiers are not matched.

### option: CrxApplication.attachAll.currentWindow
* since: v1.**
- `currentWindow` <null|[boolean]>

Optional. Whether the tabs are in the current window.
@since Chrome 19.

### option: CrxApplication.attachAll.highlighted
* since: v1.**
- `highlighted` <null|[boolean]>

Optional. Whether the tabs are highlighted.

### option: CrxApplication.attachAll.discarded
* since: v1.**
- `discarded` <null|[boolean]>

Optional.
Whether the tabs are discarded. A discarded tab is one whose content has been unloaded from memory, but is still visible in the tab strip. Its content gets reloaded the next time it's activated.
@since Chrome 54.

### option: CrxApplication.attachAll.autoDiscardable
* since: v1.**
- `autoDiscardable` <null|[boolean]>

Optional.
Whether the tabs can be discarded automatically by the browser when resources are low.
@since Chrome 54.

### option: CrxApplication.attachAll.pinned
* since: v1.**
- `pinned` <null|[boolean]>

Optional. Whether the tabs are pinned.

### option: CrxApplication.attachAll.audible
* since: v1.**
- `audible` <null|[boolean]>

Optional. Whether the tabs are audible.
@since Chrome 45.

### option: CrxApplication.attachAll.muted
* since: v1.**
- `muted` <null|[boolean]>

Optional. Whether the tabs are muted.
@since Chrome 45.

### option: CrxApplication.attachAll.groupId
* since: v1.**
- `groupId` <null|[int]>

Optional. The ID of the group that the tabs are in, or chrome.tabGroups.TAB_GROUP_ID_NONE for ungrouped tabs.
@since Chrome 88

## async method: CrxApplication.detach
* since: v1.**

### param: CrxApplication.detach.tabId
* since: v1.**
- `tabId` <[int]>

## async method: CrxApplication.detachAll
* since: v1.**

Detaches all pages.

## async method: CrxApplication.newPage
* since: v1.**
- returns: <[Page]>

Creates a chrome tab using [chrome.tabs.create(createProperties)](https://developer.chrome.com/docs/extensions/reference/tabs/#method-create) and attaches it.

### option: CrxApplication.newPage.index
* since: v1.**
- `index` <null|[int]>

Optional. The position the tab should take in the window. The provided value will be clamped to between zero and the number of tabs in the window.

### option: CrxApplication.newPage.openerTabId
* since: v1.**
- `openerTabId` <null|[int]>

Optional.
The ID of the tab that opened this tab. If specified, the opener tab must be in the same window as the newly created tab.
@since Chrome 18.

### option: CrxApplication.newPage.url
* since: v1.**
- `url` <null|[string]>

Optional.
The URL to navigate the tab to initially. Fully-qualified URLs must include a scheme (i.e. 'http://www.google.com', not 'www.google.com'). Relative URLs will be relative to the current page within the extension. Defaults to the New Tab Page.

### option: CrxApplication.newPage.pinned
* since: v1.**
- `pinned` <null|[boolean]>

Optional. Whether the tab should be pinned. Defaults to false
@since Chrome 9.

### option: CrxApplication.newPage.windowId
* since: v1.**
- `windowId` <null|[int]>

Optional. The window to create the new tab in. Defaults to the current window.

### option: CrxApplication.newPage.active
* since: v1.**
- `active` <null|[boolean]>

Optional.
Whether the tab should become the active tab in the window. Does not affect whether the window is focused (see windows.update). Defaults to true.
@since Chrome 16.

### option: CrxApplication.newPage.selected
* since: v1.**
- `selected` <null|[boolean]>

Optional. Whether the tab should become the selected tab in the window. Defaults to true
@deprecated since Chrome 33. Please use active.

## property: CrxApplication.recorder
* since: v1.**
- type: <[CrxRecorder]>

# class: Debugger
* since: v1.59
* langs: js

API for controlling the Playwright debugger. The debugger allows pausing script execution and inspecting the page.
Obtain the debugger instance via [`property: BrowserContext.debugger`].

See also [`method: Page.pause`] for a simple way to pause script execution.

## event: Debugger.pausedStateChanged
* since: v1.59

Emitted when the debugger pauses or resumes.

## method: Debugger.pausedDetails
* since: v1.59
- returns: <[Array]<[Object]>>
  - `location` <[Object]>
    - `file` <[string]>
    - `line` ?<[int]>
    - `column` ?<[int]>
  - `title` <[string]>

Returns details about the currently paused calls. Returns an empty array if the debugger is not paused.

## async method: Debugger.resume
* since: v1.59

Resumes script execution if the debugger is paused.

## async method: Debugger.setPauseAt
* since: v1.59

Configures the debugger to pause at the next action or at a specific source location.
Call without arguments to reset the pausing behavior.

### option: Debugger.setPauseAt.next
* since: v1.59
- `next` <[boolean]>

When `true`, the debugger will pause before the next action.

### option: Debugger.setPauseAt.location
* since: v1.59
- `location` <[Object]>
  - `file` <[string]>
  - `line` ?<[int]>
  - `column` ?<[int]>

When specified, the debugger will pause when the action originates from the given source location.

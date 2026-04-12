# class: Debugger
* since: v1.59

API for controlling the Playwright debugger. The debugger allows pausing script execution and inspecting the page.
Obtain the debugger instance via [`property: BrowserContext.debugger`].

## event: Debugger.pausedStateChanged
* since: v1.59

Emitted when the debugger pauses or resumes.

## method: Debugger.pausedDetails
* since: v1.59
- returns: <[null]|[Object=DebuggerPausedDetails]>
  - `location` <[Object]>
    - `file` <[string]>
    - `line` ?<[int]>
    - `column` ?<[int]>
  - `title` <[string]>

Returns details about the currently paused call. Returns `null` if the debugger is not paused.

## async method: Debugger.requestPause
* since: v1.59

Configures the debugger to pause before the next action is executed.

Throws if the debugger is already paused. Use [`method: Debugger.next`] or [`method: Debugger.runTo`] to step while paused.

Note that [`method: Page.pause`] is equivalent to a "debugger" statement — it pauses execution at the call site immediately. On the contrary, [`method: Debugger.requestPause`] is equivalent to "pause on next statement" — it configures the debugger to pause before the next action is executed.

## async method: Debugger.resume
* since: v1.59

Resumes script execution. Throws if the debugger is not paused.

## async method: Debugger.next
* since: v1.59

Resumes script execution and pauses again before the next action. Throws if the debugger is not paused.

## async method: Debugger.runTo
* since: v1.59

Resumes script execution and pauses when an action originates from the given source location. Throws if the debugger is not paused.

### param: Debugger.runTo.location
* since: v1.59
- `location` <[Object]>
  - `file` <[string]>
  - `line` ?<[int]>
  - `column` ?<[int]>

The source location to pause at.

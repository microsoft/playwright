# class: CrxRecorder
* since: v1.**
* langs: js

## async method: CrxRecorder.show
* since: v1.**

### option: CrxRecorder.show.mode
* since: v1.**
- `mode` <null|[RecordMode]<"none"|"recording"|"inspecting">>

### option: CrxRecorder.show.language
* since: v1.**
- `language` <null|[string]>

### option: CrxRecorder.show.testIdAttributeName
* since: v1.**
- `testIdAttributeName` <null|[string]>

## async method: CrxRecorder.hide
* since: v1.**

## method: CrxRecorder.isHidden
* since: v1.**
- type: <[boolean]>

## event: CrxRecorder.hide
* since: v1.**
- argument: <[CrxRecorder]>

Emitted when recorder is hidden.

## event: CrxRecorder.show
* since: v1.**
- argument: <[CrxRecorder]>

Emitted when recorder is shown.

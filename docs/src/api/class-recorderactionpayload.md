# class: RecorderActionPayload
* since: v1.57
* Qanary fork

Represents the payload emitted by [`event: BrowserContext.recorderaction`] and [`event: Page.recorderaction`].

## property: RecorderActionPayload.selector
* since: v1.57
- type: <[string]>

The primary selector Playwright generated for the element.

## property: RecorderActionPayload.action
* since: v1.57
- type: <[string]>

Recorded user action type. One of `'check'`, `'click'`, `'closePage'`, `'fill'`, `'hover'`, `'navigate'`, `'openPage'`, `'press'`, `'select'`, `'setInputFiles'`, `'uncheck'`, `'assertText'`, `'assertValue'`, `'assertChecked'`, `'assertVisible'`, `'assertSnapshot'`.

## property: RecorderActionPayload.selectors
* since: v1.57
- type: <[Array]<[string]>>

Additional selectors ranked from best to worst. May be empty.

## property: RecorderActionPayload.role
* since: v1.57
- type: <[string]>

Element role (for example `'button'`, `'link'`) if detected.

## property: RecorderActionPayload.text
* since: v1.57
- type: <[string]>

Element text captured at the moment of the action, if any.

## property: RecorderActionPayload.value
* since: v1.57
- type: <[string]>

Value recorded for value-carrying actions. For example, the text passed to `locator.fill()` or the list of files passed to `setInputFiles()`.

Element text captured at the moment of the action, if any.

## property: RecorderActionPayload.sensitive
* since: v1.57
- type: <[boolean]>

Value recorded for value-carrying actions considered sensitive or not, based on input type (eg. `password` or not).

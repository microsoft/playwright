# class: CDPSessionEvent
* since: v1.30
* langs: csharp

[CDPSessionEvent] objects are returned by page via the [`method: CDPSession.event`] method.

Each object represents a named event and allows handling of the event when it is raised.

## event: CDPSessionEvent.onEvent
* since: v1.30
* langs: csharp
- argument: <[JsonElement?]>

## property: CDPSessionEvent.eventName
* since: 1.30
* langs: csharp
- returns: <[string]>
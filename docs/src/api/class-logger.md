# class: Logger
* since: v1.8
* langs: js

Playwright generates a lot of logs and they are accessible via the pluggable logger sink.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch({
    logger: {
      isEnabled: (name, severity) => name === 'api',
      log: (name, severity, message, args) => console.log(`${name} ${message}`)
    }
  });
  // ...
})();
```

## method: Logger.isEnabled
* since: v1.8
- returns: <[boolean]>

Determines whether sink is interested in the logger with the given name and severity.

### param: Logger.isEnabled.name
* since: v1.8
- `name` <[string]>

logger name

### param: Logger.isEnabled.severity
* since: v1.8
- `severity` <[LogSeverity]<"verbose"|"info"|"warning"|"error">>

## method: Logger.log
* since: v1.8

### param: Logger.log.name
* since: v1.8
- `name` <[string]>

logger name

### param: Logger.log.severity
* since: v1.8
- `severity` <[LogSeverity]<"verbose"|"info"|"warning"|"error">>

### param: Logger.log.message
* since: v1.8
- `message` <[string]|[Error]>

log message format

### param: Logger.log.args
* since: v1.8
- `args` <[Array]<[Object]>>

message arguments

### param: Logger.log.hints
* since: v1.8
- `hints` <[Object]>
  - `color` ?<[string]> Optional preferred logger color.

optional formatting hints

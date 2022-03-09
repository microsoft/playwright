# class: Logger
* langs: js

Playwright generates a lot of logs and they are accessible via the pluggable logger sink.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch({
    logger: {
      isEnabled: (name, severity) => name === 'browser',
      log: (name, severity, message, args) => console.log(`${name} ${message}`)
    }
  });
  ...
})();
```

## method: Logger.isEnabled
- returns: <[boolean]>

Determines whether sink is interested in the logger with the given name and severity.

### param: Logger.isEnabled.name
- `name` <[string]>

logger name

### param: Logger.isEnabled.severity
- `severity` <[LogSeverity]<"verbose"|"info"|"warning"|"error">>

## method: Logger.log

### param: Logger.log.name
- `name` <[string]>

logger name

### param: Logger.log.severity
- `severity` <[LogSeverity]<"verbose"|"info"|"warning"|"error">>

### param: Logger.log.message
- `message` <[string]|[Error]>

log message format

### param: Logger.log.args
- `args` <[Array]<[Object]>>

message arguments

### param: Logger.log.hints
- `hints` <[Object]>
  - `color` <[string]> Optional preferred logger color.

optional formatting hints

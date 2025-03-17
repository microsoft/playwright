### Playwright MCP

This package is experimental and not yet ready for production use.
It is a subject to change and will not respect semver versioning.

### Example config

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp",
        "--headless"
      ]
    }
  }
}
```

### Running headed browser (Browser with GUI).

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp"
      ]
    }
  }
}
```

### Running headed browser on Linux

When running headed browser on system w/o display or from worker processes of the IDEs,
you can run Playwright in a client-server manner. You'll run the Playwright server
from environment with the DISPLAY

```sh
npx playwright run-server
```

And then in MCP config, add following to the `env`:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp"
      ],
      "env": {
        // Use the endpoint from the output of the server above.
        "PLAYWRIGHT_WS_ENDPOINT": "ws://localhost:<port>/"
      }
    }
  }
}
```

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
        "@playwright/mcp"
      ],
      "env": {
        /**
         * If you run this server in a headless environment
         * (Cline on Linux, etc), either set HEADLESS to 1.
         */
        "PLAYWRIGHT_HEADLESS": "1",

        /**
         * ...or use Playwright Client/Server mode via
         * running the Playwright Server
         *     npx playwright run-server
         */
        "PLAYWRIGHT_WS_ENDPOINT": "ws://localhost:41541/"
      }
    }
  }
}
```

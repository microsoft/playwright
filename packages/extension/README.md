# Playwright MCP Chrome Extension

## Introduction

The Playwright MCP Chrome Extension allows you to connect to pages in your existing browser and leverage the state of your default user profile. This means the AI assistant can interact with websites where you're already logged in, using your existing cookies, sessions, and browser state, providing a seamless experience without requiring separate authentication or setup.

## Prerequisites

- Chrome/Edge/Chromium browser

## Installation Steps

### Install the Extension

Install [Playwright Extension](https://chromewebstore.google.com/detail/playwright-mcp-bridge/mmlmfjhmonkocbjadbfplnigmagldckm) from the Chrome Web Store.

### Configure Playwright MCP server

Configure Playwright MCP server to connect to the browser using the extension by passing the `--extension` option when running the MCP server:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--extension"
      ]
    }
  }
}
```

## Usage

### Browser Tab Selection

When the LLM interacts with the browser for the first time, it will load a page where you can select which browser tab the LLM will connect to. This allows you to control which specific page the AI assistant will interact with during the session.

### Bypassing the Connection Approval Dialog

By default, you'll need to approve each connection when the MCP server tries to connect to your browser. To bypass this approval dialog and allow automatic connections, you can use an authentication token.

#### Using Your Unique Authentication Token

1. After installing the extension, click on the extension icon or navigate to the extension's status page
2. Copy the `PLAYWRIGHT_MCP_EXTENSION_TOKEN` value displayed in the extension UI
3. Add it to your MCP server configuration:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--extension"
      ],
      "env": {
        "PLAYWRIGHT_MCP_EXTENSION_TOKEN": "your-token-here"
      }
    }
  }
}
```

This token is unique to your browser profile and provides secure authentication between the MCP server and the extension. Once configured, you won't need to manually approve connections each time.



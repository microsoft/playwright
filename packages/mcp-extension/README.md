# Playwright MCP Chrome Extension

## Introduction

The Playwright MCP Chrome Extension allows you to connect to pages in your existing browser and leverage the state of your default user profile. This means the AI assistant can interact with websites where you're already logged in, using your existing cookies, sessions, and browser state, providing a seamless experience without requiring separate authentication or setup.

## Prerequisites

- Chrome/Edge/Chromium browser

## Installation Steps

### Download the Extension

Download the latest Chrome extension from GitHub:
- **Download link**: https://github.com/microsoft/playwright-mcp/releases

### Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top right corner)
3. Click "Load unpacked" and select the extension directory

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



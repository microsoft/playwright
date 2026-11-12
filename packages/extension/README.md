# Playwright Chrome Extension

## Introduction

The Playwright Chrome Extension allows you to connect to pages in your existing browser and leverage the state of your default user profile. This means the AI assistant can interact with websites where you're already logged in, using your existing cookies, sessions, and browser state, providing a seamless experience without requiring separate authentication or setup.

## Prerequisites

- Chrome/Edge/Chromium browser

## Installation Steps

### Install the Extension

Install [Playwright Extension](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm) from the Chrome Web Store.

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

When the LLM interacts with the browser for the first time, it will load a page where you approve the connection and select what the client can control: one tab group as a whole, or some tabs. If you select nothing, the client gets a new blank tab.

### Tab Ownership

Several clients can be connected at the same time. A tab belongs to a single client at a time, and a client can only reach the tabs that it owns: the tabs you selected, the tabs it opened, and the tabs you dragged into its tab group. Click the extension icon to open the Manage clients page. It shows each connected client with its tabs, and lets you disconnect a client or rotate the token.

Clients can read browser-wide data such as cookies, but they cannot change browser-wide state: adding or clearing cookies and granting permissions are refused.

### Tab Groups

Each client gets its own tab group. Drag tabs in and out of a group to change what a client can reach; dragging a tab from the group of one client to the group of another moves it between the clients. The group takes the name and the color of the session. With the MCP server, pass `--session-name` and `--session-color` (blue, red, yellow, green, pink, purple, cyan or orange), or set `PLAYWRIGHT_MCP_SESSION_NAME` and `PLAYWRIGHT_MCP_SESSION_COLOR`. Without a session name, the group is named after the client. Without a color, it takes the first color that no other client uses. With the CLI, the group is named after the session:

```bash
playwright-cli attach --extension=msedge --session="my session" --session-color=red
```

When a client disconnects, its tab group stays and turns gray. Select that group on the connect page of the next client to continue with the same tabs.

With the CLI, `detach --close-tabs` closes the tabs of the session before it disconnects, so no group stays:

```bash
playwright-cli --session="my session" detach --close-tabs
```

To disable automatic grouping, pass `--no-tab-group` alongside `--extension`, or set `PLAYWRIGHT_MCP_NO_TAB_GROUP=1`. With the CLI, pass `--no-tab-group` to `attach`. Grouping stays enabled by default. With grouping disabled, the selected tabs and tabs opened by the client stay in their existing groups, if any. This does not grant access to all existing tabs or change connection approval; each controlled tab still belongs to only one client. Use the status page to see controlled tabs and disconnect clients.

### Bypassing the Connection Approval Dialog

By default, you'll need to approve each connection when the MCP server tries to connect to your browser. To bypass this approval dialog and allow automatic connections, you can use an authentication token.

#### Using Your Unique Authentication Token

1. After installing the extension, click on the extension icon to open the Manage clients page
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

This token is unique to your browser profile and provides secure authentication between the MCP server and the extension. Once configured, you won't need to manually approve connections each time. A client that connects with the token starts with a new blank tab.

#### Working in the Background

By default, the connected tab becomes active and the browser window is focused. To keep the browser behind the app you are working in, pass `--background` alongside `--extension`, or set `PLAYWRIGHT_MCP_BACKGROUND=1`. This mode requires the extension version 0.5.0 or later. In this mode, the extension does not activate the connected tab or focus its window, and tabs that the client opens are created in the background. Together with the authentication token, the connect page is also opened in the background (Chrome 158.0.8127.2 or later). This works only when the browser is already running; if it is not, the browser starts with a new focused window. Note that Chrome throttles timers and animation frames in background tabs.

### Selecting a Chrome Profile

If the extension is installed in several Chrome profiles, the connection is made to the one you used last. To always connect to a specific profile, pass the name of its directory, the last component of "Profile Path" at `chrome://version`, via `--profile-dir-name`:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--extension",
        "--profile-dir-name",
        "Profile 2"
      ]
    }
  }
}
```

The `PLAYWRIGHT_MCP_PROFILE_DIR_NAME` environment variable can be used instead of the option. The authentication token is specific to the profile, so use the one displayed in that profile.

## Troubleshooting

Chrome does not allow extensions to debug a page that contains a frame with a restricted URL, for example a page of another extension (`chrome-extension://`), a `chrome://` page, or a URL with a custom scheme. When such a frame loads, Chrome detaches the Playwright debugger. If the frame stays in the page, the tab is no longer available to the client. This often happens when another extension adds its own frame to every page. Disable that extension on the sites you automate, set its **Site access** to **On click**, or use a profile without it. Then navigate again.

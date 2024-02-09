---
id: remote
title: "Remote Connection"
---

## Introduction

Usually, Playwright launches a browser on the same computer before running tests in it. However, Playwright also supports connecting to a browser running remotely, or connecting to a Playwright server and launching a new browser remotely.

## Playwright server

Starting a Playwright server does not launch the browser right away. A new browser is launched for every connected client, and is automatically closed when the client disconnects.

You can start Playwright server by running the following CLI command:

```bash
$ npx playwright run-server --port=5678 --path=/secretpath
Listening on ws://localhost:5678/secretpath
```

When started, the server prints the ws endpoint that you can use to connect to it. We recommend generating a unique path before every server start for security benefits.

Later on, clients can connect to the Playwright server by setting `remote` option in the configuration file or passing [`option: remote`] option(s) to the [`method: BrowserType.launch`] method.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    launchOptions: {
      remote: {
        wsEndpoint: 'ws://<remote-ip>:5678/secretpath',
      },
    },
  },
});
```

```java
Browser browser = playwright.chromium().launch(
    new BrowserType.LaunchOptions().setRemoteEndpoint("ws://<remote-ip>:5678/secretpath"));
Page page = browser.newPage();
```

```python sync
browser = playwright.chromium.launch(remote_endpoint="ws://<remote-ip>:5678/secretpath")
page = browser.new_page()
```

```python async
browser = await playwright.chromium.launch(remote_endpoint="ws://<remote-ip>:5678/secretpath")
page = await browser.new_page()
```

```csharp
var browser = await Playwright.Chromium.LaunchAsync(new() { RemoteEndpoint = "ws://<remote-ip>:5678/secretpath" });
var page = await browser.NewPageAsync();
```

When connecting to a Playwright server, launch options are passed along so that server can launch a requested browser on behalf of the client. Some options are prohibited when launching remotely, for example [`option: executablePath`] and [`option: env`].

## Exposing local network to the remote browser

You can optionally expose local network, for example `localhost` to the remote browser when connecting to it by passing [`option: exposeNetwork`]. This option consists of a list of rules separated by comma, each rule specifies network domain pattern that should be exposed.

Available rules:
1. Hostname pattern, for example: `example.com`, `*.org:99`, `x.*.y.com`, `*foo.org`, `localhost`.
1. IP literal, for example: `127.0.0.1`, `0.0.0.0:99`, `[::1]`, `[0:0::1]:99`.
1. `<loopback>` that matches local loopback interfaces: `localhost`, `*.localhost`, `127.0.0.1`, `[::1]`.

Some common examples:
1. `"*"` to expose all network.
1. `"<loopback>"` to expose localhost network.
1. `"*.test.internal-domain,*.staging.internal-domain,<loopback>"` to expose test/staging deployments and localhost.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    launchOptions: {
      remote: {
        wsEndpoint: '...',
        exposeNetwork: '<loopback>,*.staging.app.domain',
      },
    },
  },
});
```

```java
Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
    .setRemoteEndpoint("ws://<remote-ip>:5678/secretpath")
    .setRemoteExposeNetwork("<loopback>,*.staging.app.domain"));
Page page = browser.newPage();
```

```python sync
browser = playwright.chromium.launch(
    remote_endpoint="ws://<remote-ip>:5678/secretpath",
    remote_expose_network="<loopback>,*.staging.app.domain",
)
page = browser.new_page()
```

```python async
browser = await playwright.chromium.launch(
    remote_endpoint="ws://<remote-ip>:5678/secretpath",
    remote_expose_network="<loopback>,*.staging.app.domain",
)
page = await browser.new_page()
```

```csharp
var browser = await Playwright.Chromium.LaunchAsync(new() {
    RemoteEndpoint = "ws://<remote-ip>:5678/secretpath",
    RemoteExposeNetwork = "<loopback>,*.staging.app.domain",
});
var page = await browser.NewPageAsync();
```

## Playwright-specific headers

The websocket connection request sent by Playwright to the remote server includes the following headers:
* `User-Agent` - Playwright's standard user agent that includes Playwright version.
* `x-playwright-proxy` - the value of [`option: exposeNetwork`].
* `x-playwright-browser` - the browser type, either `'chromium'`, `'firefox'` or `'webkit'`.
* `x-playwright-launch-options` - the allowed launch options passed to [`method: BrowserType.launch`] stringified as JSON.

You can also pass custom headers by setting the [`option: headers`] option.

## Single browser server

Single browser server is an alternative to the Playwright server. It launches a single browser right away when you start the server, and all the clients connect to this single browser. Launching a browser right away gives you the most control over it, including all the launch options.

You can start a server by calling [`browserType.launchServer()`](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-server) method in Node.js. Once the server is running, pass its [`wsEndpoint`](https://playwright.dev/docs/api/class-browserserver#browser-server-ws-endpoint) to the [`method: BrowserType.connect`] method. This will give you a [Browser] where you can create contexts with [`method: Browser.newContext`].

```js
const browser = await playwright.chromium.connect(wsEndpoint);
const page = await browser.newPage();
```

```java
Browser browser = playwright.chromium().connect("ws://<remote-ip>:5678/secretpath");
Page page = browser.newPage();
```

```python sync
browser = playwright.chromium.connect("ws://<remote-ip>:5678/secretpath")
page = browser.new_page()
```

```python async
browser = await playwright.chromium.connect("ws://<remote-ip>:5678/secretpath")
page = await browser.new_page()
```

```csharp
var browser = await Playwright.Chromium.ConnectAsync("ws://<remote-ip>:5678/secretpath");
var page = await browser.NewPageAsync();
```

Multiple clients can connect to the same browser server and create their own isolated contexts. When a client disconnects, all contexts created by the client are automatically closed.

:::note
Single browser server does not support exposing local network to the browser.
:::

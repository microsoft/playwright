/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs/promises';
import path from 'path';

import WebSocket from 'ws';

import { test, testWithOldExtensionVersion, expect, extensionId, clickAllowAndSelect, connectAndNavigate, readExtensionToken, startWithExtensionFlag } from './extension-fixtures';
import { utils } from '../../packages/playwright-core/lib/coreBundle';

const { defaultUserDataDirForChannel } = utils;

test(`navigate with extension`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Welcome');

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=f1e1]: Hello, world!`),
  });
});

test(`connect.html requests protocol version 2`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});

  const selectorPage = await confirmationPagePromise;
  const url = new URL(selectorPage.url());
  expect(url.searchParams.get('protocolVersion')).toBe('2');
});

test(`browser_run_code_unsafe can evaluate in a web worker`, async ({ startExtensionClient, server }) => {
  server.setContent('/worker.js', `
    self.onmessage = (e) => self.postMessage('echo:' + e.data);
    self.workerName = 'mcp-worker';
  `, 'application/javascript');
  server.setContent('/worker-page', `
    <title>WorkerPage</title>
    <body>
      <script>
        window.__worker = new Worker('/worker.js');
      </script>
    </body>
  `, 'text/html');

  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX + '/worker-page' },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Welcome');

  await navigateResponse;

  const runCodeResponse = await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: {
      code: `async (page) => {
        const worker = page.workers().length ? page.workers()[0] : await page.waitForEvent('worker');
        return await worker.evaluate(() => self.workerName);
      }`,
    },
  });

  expect(runCodeResponse).toHaveResponse({
    result: expect.stringContaining('mcp-worker'),
  });

  // Open a second page with its own worker via browser_tabs new and verify
  // that worker eval works in that tab too. This exercises child CDP sessions
  // (the worker session) on a non-first tab — the relay must route them to
  // the correct tab rather than always falling back to the first one.
  server.setContent('/worker2.js', `
    self.workerName = 'mcp-worker-2';
  `, 'application/javascript');
  server.setContent('/worker-page-2', `
    <title>WorkerPage2</title>
    <body>
      <script>
        window.__worker = new Worker('/worker2.js');
      </script>
    </body>
  `, 'text/html');

  await client.callTool({
    name: 'browser_tabs',
    arguments: { action: 'new', url: server.PREFIX + '/worker-page-2' },
  });

  const runCodeResponse2 = await client.callTool({
    name: 'browser_run_code_unsafe',
    arguments: {
      code: `async (page) => {
        const worker = page.workers().length ? page.workers()[0] : await page.waitForEvent('worker');
        return await worker.evaluate(() => self.workerName);
      }`,
    },
  });

  expect(runCodeResponse2).toHaveResponse({
    result: expect.stringContaining('mcp-worker-2'),
  });
});

test(`snapshot of an existing page`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  // Another empty page.
  await browserContext.newPage();
  expect(browserContext.pages()).toHaveLength(3);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);
  expect(browserContext.pages()).toHaveLength(3);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_snapshot',
    arguments: { },
  });

  const selectorPage = await confirmationPagePromise;
  expect(browserContext.pages()).toHaveLength(4);

  await clickAllowAndSelect(selectorPage, 'Title');

  expect(await navigateResponse).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`- generic [active] [ref=e1]: Hello, world!`),
  });
});

test(`extension connection uses noDefaults`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42117' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);
  await page.emulateMedia({ media: 'print' });
  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);

  const client = await startWithExtensionFlag(browserWithExtension, startClient);

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const snapshotResponse = client.callTool({
    name: 'browser_snapshot',
    arguments: { },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Title');

  expect(await snapshotResponse).toHaveResponse({
    inlineSnapshot: expect.stringContaining(`Hello, world!`),
  });

  expect(await page.evaluate(() => matchMedia('print').matches)).toBe(true);
});

testWithOldExtensionVersion(`works with old extension version`, async ({ startExtensionClient, server }) => {
  // Prelaunch the browser, so that it is properly closed after the test.
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await clickAllowAndSelect(selectorPage, 'Welcome');

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=f1e1]: Hello, world!`),
  });
});

test(`extension needs update`, async ({ startExtensionClient, server }) => {
  // Prelaunch the browser, so that it is properly closed after the test.
  const { browserContext, client } = await startExtensionClient({ PLAYWRIGHT_EXTENSION_PROTOCOL: '1000' });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  // The call hangs as MCP server never connects to the extension.
  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});

  const confirmationPage = await confirmationPagePromise;
  await expect(confirmationPage.locator('.status-banner')).toContainText(`Playwright client trying to connect requires newer extension version`);
});

test(`extension rejects outdated client protocol version`, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient({ PLAYWRIGHT_EXTENSION_PROTOCOL: '1' });

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });

  // The call hangs as the extension never connects to the relay.
  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});

  const confirmationPage = await confirmationPagePromise;
  await expect(confirmationPage.locator('.status-banner')).toContainText(`The client uses an unsupported protocol version. Update Playwright MCP or CLI to the latest version.`);
});

test(`custom executablePath skips local extension check`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1590' },
}, async ({ startClient, server }) => {
  const executablePath = test.info().outputPath('echo.sh');
  await fs.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  // Empty profile would normally fail the extension-installed check; it is skipped when executablePath is set.
  const { client } = await startClient({
    args: [`--extension`, `--executable-path=${executablePath}`],
    env: { PWTEST_EXTENSION_USER_DATA_DIR: test.info().outputPath('empty-profile') },
  });

  client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  }).catch(() => {});
  await expect(async () => {
    const output = await fs.readFile(test.info().outputPath('output.txt'), 'utf8');
    expect(output).toMatch(new RegExp(`Custom exec args.*chrome-extension://${extensionId}/connect\\.html\\?`));
  }).toPass();
});

test(`launches the profile that has the extension`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41916' },
}, async ({ startClient, server }, testInfo) => {
  // The extension lives in a non-default profile only; the launch must target that profile via
  // `--profile-directory`, otherwise Chrome opens the default profile without the extension and the
  // connection hangs. A fake executable records the launch arguments, so no real browser is needed.
  const userDataDir = testInfo.outputPath('multi-profile');
  await fs.mkdir(path.join(userDataDir, 'Default'), { recursive: true });
  await fs.mkdir(path.join(userDataDir, 'Profile 1', 'Extensions', extensionId), { recursive: true });

  const executablePath = testInfo.outputPath('echo.sh');
  await fs.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  const { client } = await startClient({
    args: [`--extension`, `--executable-path=${executablePath}`],
    env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir },
  });

  client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } }).catch(() => {});
  await expect(async () => {
    const output = await fs.readFile(testInfo.outputPath('output.txt'), 'utf8');
    expect(output).toContain(`--profile-directory=Profile 1`);
  }).toPass();
});

test(`ignores orphaned preferences entries of an uninstalled extension`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1712' },
}, async ({ startClient, server }, testInfo) => {
  // Uninstalling the extension leaves orphaned entries in the profile's Preferences (an empty
  // `extensions.settings.<id>` record, `protection.macs.*` and `updateclientdata.apps.*`). Those
  // must not be mistaken for an installation, otherwise the wrong profile is launched.
  const userDataDir = testInfo.outputPath('multi-profile');
  await fs.mkdir(path.join(userDataDir, 'Default'), { recursive: true });
  await fs.writeFile(path.join(userDataDir, 'Default', 'Preferences'), JSON.stringify({
    extensions: { settings: { [extensionId]: {} } },
    protection: { macs: { extensions: { settings: { [extensionId]: 'DEADBEEF' } } } },
    updateclientdata: { apps: { [extensionId]: { pv: '0.3.0' } } },
  }));
  // The extension is actually installed in Profile 1 via `--load-extension`, which only writes a
  // populated settings record into Preferences.
  await fs.mkdir(path.join(userDataDir, 'Profile 1'), { recursive: true });
  await fs.writeFile(path.join(userDataDir, 'Profile 1', 'Preferences'), JSON.stringify({
    extensions: { settings: { [extensionId]: { path: '/tmp/extension', location: 4 } } },
  }));
  // Ordering prefers the last used profile; make it the one with the orphaned entries.
  await fs.writeFile(path.join(userDataDir, 'Local State'), JSON.stringify({
    profile: { last_used: 'Default' },
  }));

  const executablePath = testInfo.outputPath('echo.sh');
  await fs.writeFile(executablePath, '#!/bin/bash\necho "Custom exec args: $@" > "$(dirname "$0")/output.txt"', { mode: 0o755 });

  const { client } = await startClient({
    args: [`--extension`, `--executable-path=${executablePath}`],
    env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir },
  });

  client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } }).catch(() => {});
  await expect(async () => {
    const output = await fs.readFile(testInfo.outputPath('output.txt'), 'utf8');
    expect(output).toContain(`--profile-directory=Profile 1`);
  }).toPass();
});

test(`fails when extension is missing in custom userDataDir`, async ({ startClient, server }) => {
  const userDataDir = test.info().outputPath('empty-profile');

  const { client } = await startClient({
    args: [`--extension`],
    env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    error: expect.stringContaining(`Playwright Extension not found in "${userDataDir}"`),
    isError: true,
  });
});

test(`navigate with extension via --user-data-dir`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42163' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();

  const { client } = await startClient({
    args: [`--extension`, `--user-data-dir=${browserWithExtension.userDataDir}`],
  });

  const response = await connectAndNavigate(browserContext, client, server.HELLO_WORLD);
  expect(response).toHaveResponse({
    snapshot: expect.stringContaining(`Hello, world!`),
  });
});

test(`--browser <channel> selects channel-specific userDataDir`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1589' },
}, async ({ startClient, server }) => {
  const expectedUserDataDir = defaultUserDataDirForChannel('chrome-dev')!;

  const { client } = await startClient({
    args: [`--extension`, `--browser=chrome-dev`],
    omitArgs: [`--browser=chromium`],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    error: expect.stringContaining(`Playwright Extension not found in "${expectedUserDataDir}"`),
    isError: true,
  });
});

test(`browser_cookie_list and browser_cookie_set work in extension mode`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/40687' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();
  const { client } = await startClient({
    args: [`--extension`],
    config: { capabilities: ['storage'] },
    env: {
      PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir,
    },
  });

  await connectAndNavigate(browserContext, client, server.HELLO_WORLD);

  // Storage.setCookie / Storage.getCookies are browser-level CDP commands
  // (no sessionId) and used to be rejected outright by the v2 relay.
  await client.callTool({
    name: 'browser_cookie_set',
    arguments: { name: 'extCookie', value: 'extValue' },
  });
  const result = await client.callTool({
    name: 'browser_cookie_list',
    arguments: {},
  });

  expect(result).toHaveResponse({
    result: expect.stringContaining('extCookie=extValue'),
  });
});

test(`bypass connection dialog with token`, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);

  const clientName = 'token-bypass-client';
  const { client } = await startClient({
    clientName,
    args: [`--extension`],
    env: {
      PLAYWRIGHT_MCP_EXTENSION_TOKEN: token,
      PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir,
    },
  });

  const navigateResponse = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(await navigateResponse).toHaveResponse({
    snapshot: expect.stringContaining(`- generic [active] [ref=f1e1]: Hello, world!`),
  });

  const page = await browserContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/status.html`);
  await expect(page.locator('.client-info')).toContainText(`Connected to "${clientName}"`);
});

test(`reconnects after the extension connection drops`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41874' },
}, async ({ browserWithExtension, startClient, server }) => {
  const browserContext = await browserWithExtension.launch();
  const token = await readExtensionToken(browserContext);

  const { client, stderr } = await startClient({
    args: [`--extension`],
    env: {
      DEBUG: 'pw:mcp:backend',
      PLAYWRIGHT_MCP_EXTENSION_TOKEN: token,
      PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir,
    },
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`Hello, world!`),
  });

  // Closing the last controlled tab drops the relay WebSocket, like the MV3
  // service worker idle timeout would.
  await browserContext.pages().find(page => page.url() === server.HELLO_WORLD)!.close();

  // Wait for the MCP server to observe the disconnect.
  await expect.poll(() => stderr()).toContain('browser disconnected');

  // The next tool call reconnects transparently; the token bypasses the dialog.
  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    snapshot: expect.stringContaining(`Hello, world!`),
  });
});

test(`relay rejects websocket upgrades with forged host or origin`, {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1694' },
}, async ({ startExtensionClient, server }) => {
  const { browserContext, client } = await startExtensionClient();

  const confirmationPagePromise = browserContext.waitForEvent('page', page => {
    return page.url().startsWith(`chrome-extension://${extensionId}/connect.html`);
  });
  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  const connectPage = await confirmationPagePromise;
  const relayUrl = new URL(connectPage.url()).searchParams.get('mcpRelayUrl')!;
  expect(relayUrl).toBeTruthy();
  await clickAllowAndSelect(connectPage, 'Welcome');
  await navigateResponse;

  expect(await wsUpgradeResult(relayUrl, { host: 'evil.com' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl, { host: 'evil.com:80' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl, { origin: 'http://evil.com' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl, { origin: 'https://evil.com' })).toBe(403);

  // Control: default headers pass the upgrade validation.
  expect(await wsUpgradeResult(relayUrl)).toBe('connected');
});

function wsUpgradeResult(url: string, headers?: Record<string, string>): Promise<number | 'connected'> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.on('open', () => {
      ws.close();
      resolve('connected');
    });
    ws.on('unexpected-response', (request, response) => {
      request.destroy();
      resolve(response.statusCode!);
    });
    ws.on('error', reject);
  });
}

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

import { test as base, expect } from './harness';
import { extensionId, clickAllow } from './extension-fixtures';
import { inprocess, utils } from '../../packages/playwright-core/lib/coreBundle';

const { defaultUserDataDirForChannel } = utils;

const connectPageUrl = expect.stringContaining(`chrome-extension://${extensionId}/connect.html?`);

type Profile = {
  // The profile has the folder of the installed extension.
  hasExtension?: boolean;
  // Content of the Preferences file of the profile.
  preferences?: object;
};

const test = base.extend<{
  // Starts a client with a Chrome executable that only records its arguments. Gives the arguments.
  chromeArgs: (options: { args?: string[], env?: Record<string, string> }) => Promise<string[]>;
}>({
  chromeArgs: async ({ startClient, server }, use, testInfo) => {
    await use(async options => {
      const executablePath = testInfo.outputPath('fake-chrome.sh');
      const argsFile = testInfo.outputPath('fake-chrome-args.txt');
      await fs.writeFile(executablePath, `#!/bin/bash\nprintf '%s\\n' "$@" > "${argsFile}"`, { mode: 0o755 });
      const { client } = await startClient({
        args: ['--extension', `--executable-path=${executablePath}`, ...options.args ?? []],
        env: options.env,
      });
      // The call does not complete, because no extension connects.
      client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } }).catch(() => {});
      let args: string[] = [];
      await expect.poll(async () => {
        args = (await fs.readFile(argsFile, 'utf8').catch(() => '')).split('\n').filter(Boolean);
        return args;
      }).not.toEqual([]);
      return args;
    });
  },
});

const testWithOldExtension = test.extend({
  pathToExtension: async ({ pathToExtension }, use) => {
    const manifestPath = path.join(pathToExtension, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    manifest.version = '0.0.1';
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await use(pathToExtension);
  },
});

// Creates a user data directory with the given profiles.
async function createUserDataDir(profiles: Record<string, Profile>, options: { lastUsedProfile?: string } = {}): Promise<string> {
  const userDataDir = test.info().outputPath('user-data-dir');
  for (const [name, profile] of Object.entries(profiles)) {
    await fs.mkdir(path.join(userDataDir, name), { recursive: true });
    if (profile.hasExtension)
      await fs.mkdir(path.join(userDataDir, name, 'Extensions', extensionId), { recursive: true });
    if (profile.preferences)
      await fs.writeFile(path.join(userDataDir, name, 'Preferences'), JSON.stringify(profile.preferences));
  }
  if (options.lastUsedProfile)
    await fs.writeFile(path.join(userDataDir, 'Local State'), JSON.stringify({ profile: { last_used: options.lastUsedProfile } }));
  return userDataDir;
}

// Connection through the connect page.

test('client controls the tab that the connect page gives it', async ({ connect, browserWithExtension }) => {
  const client = await connect('worker');
  await client.navigate('Alpha');

  expect(await client.snapshot()).toContain('- generic [active] [ref=e1]: Page Alpha');
  expect(await browserWithExtension.chromeStubArgs()).toEqual([[
    `--user-data-dir=${browserWithExtension.userDataDir}`,
    '--profile-directory=Default',
    connectPageUrl,
  ]]);
});

test('client starts the browser when it is not running', async ({ browserWithExtension, startClient, server }) => {
  const { client } = await startClient({
    args: ['--extension'],
    env: { ...browserWithExtension.chromeStubEnv, PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir },
  });
  const navigateResponse = client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } });

  const browserContext = await browserWithExtension.connect();
  const connectPage = () => browserContext.pages().find(page => page.url().startsWith(`chrome-extension://${extensionId}/connect.html`));
  await expect.poll(connectPage).toBeTruthy();
  await clickAllow(connectPage()!);

  expect(await navigateResponse).toHaveResponse({ snapshot: expect.stringContaining('Hello, world!') });
});

test('client controls the tab that the user picks', async ({ user, connect }) => {
  await user.openTab('Alpha');
  await user.openTab('Beta');

  const client = await connect('worker', { tabs: ['Alpha'] });
  expect(await client.tabs()).toEqual(['Alpha']);
  expect(await client.snapshot()).toContain('- generic [active] [ref=e1]: Page Alpha');
});

test('client does not reset the emulation of the tab that the user picks', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42117' },
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/44096' },
  ],
}, async ({ user, connect }) => {
  user.definePage('Alpha', `<button onclick="this.textContent = 'Clicked'">Click me</button>`);
  const page = await user.openTab('Alpha');
  await page.emulateMedia({ media: 'print' });
  // The fixture enables focus emulation; a normal user's tab does not have it.
  const session = inprocess.playwright._connection.toImpl(page).delegate._mainFrameSession._client;
  await session.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  const isPrint = () => page.evaluate(() => matchMedia('print').matches);
  expect(await isPrint()).toBe(true);

  const client = await connect('worker', { tabs: ['Alpha'] }, { args: ['--background'] });
  await (await user.openTab('Beta')).bringToFront();
  expect(await client.runCode(`async page => {
    await page.getByRole('button', { name: 'Click me' }).click({ timeout: 5000 });
    return await page.getByRole('button').textContent();
  }`)).toContain('"Clicked"');
  expect(await isPrint()).toBe(true);
  expect(await user.activeTabs()).toEqual(['Beta']);
});

test('client evaluates in the web worker of each tab', async ({ user, connect, server }) => {
  server.setContent('/worker-1.js', `self.workerName = 'worker-1';`, 'application/javascript');
  server.setContent('/worker-2.js', `self.workerName = 'worker-2';`, 'application/javascript');
  user.definePage('First', `<script>window.worker = new Worker('/worker-1.js');</script>`);
  user.definePage('Second', `<script>window.worker = new Worker('/worker-2.js');</script>`);
  const readWorkerName = `async page => {
    const worker = page.workers()[0] ?? await page.waitForEvent('worker');
    return await worker.evaluate(() => self.workerName);
  }`;

  const client = await connect('worker');
  await client.navigate('First');
  expect(await client.runCode(readWorkerName)).toContain('worker-1');

  // The session of the worker must go to the second tab, not to the first one.
  await client.openTab('Second');
  expect(await client.runCode(readWorkerName)).toContain('worker-2');
});

test('client lists the cookies of the browser', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/40687' },
}, async ({ user, connect }) => {
  const client = await connect('worker', {}, { config: { capabilities: ['storage'] } });
  await client.navigate('Alpha');

  // Storage.getCookies is a command for the browser, not for a tab.
  await user.browserContext.addCookies([{ name: 'extCookie', value: 'extValue', url: user.urlOf('Alpha') }]);
  expect(await client.mcp.callTool({ name: 'browser_cookie_list', arguments: {} })).toHaveResponse({
    result: expect.stringContaining('extCookie=extValue'),
  });
});

// Connection with the token.

test('client with the token skips the connect page', async ({ user, connectWithToken }) => {
  const client = await connectWithToken('token-client');
  await client.navigate('Alpha');

  expect(await client.snapshot()).toContain('- generic [active] [ref=e1]: Page Alpha');
  expect(await user.connectedClients()).toEqual(['token-client']);
});

test('token is not in the url of the connect page', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1791' },
}, async ({ user, connectWithToken }) => {
  const client = await connectWithToken('worker');

  // The connect page becomes the blank tab of the client.
  const response = await client.mcp.callTool({ name: 'browser_tabs', arguments: { action: 'list' } });
  expect(response).toHaveResponse({ result: expect.stringContaining('about:blank') });
  expect(JSON.stringify(response)).not.toContain(await user.token());
});

test('client reports an error when the extension refuses the token', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1732' },
}, async ({ user, start }) => {
  const client = await start('worker', {
    env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: 'wrong-token', PWTEST_EXTENSION_CONNECT_TIMEOUT: '500' },
  });

  const connectPage = user.waitForConnectPage();
  expect(await client.mcp.callTool({ name: 'browser_tabs', arguments: { action: 'list' } })).toHaveResponse({
    error: expect.stringContaining(`Playwright extension did not connect within 0.5s after opening the connect page. Make sure the extension is installed in the Chrome profile "Default" and PLAYWRIGHT_MCP_EXTENSION_TOKEN matches its token.`),
    isError: true,
  });
  await expect((await connectPage).locator('.status-banner')).toContainText('Invalid token provided.');

  // The client does not keep the failed attempt. The next tool call opens a new connect page.
  await Promise.all([user.waitForConnectPage(), client.tabs()]);
});

test('client reconnects after the user disconnects it', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41874' },
}, async ({ user, connectWithToken }) => {
  const client = await connectWithToken('worker', { env: { DEBUG: 'pw:mcp:backend' } });
  await client.navigate('Alpha');

  // The disconnect closes the relay connection, as the stop of an idle service worker does.
  await user.disconnect('worker');
  await expect.poll(client.stderr).toContain('browser disconnected');

  // The next tool call connects again. The token skips the connect page.
  await client.navigate('Beta');
  expect(await client.snapshot()).toContain('Page Beta');
});

test('--background does not show the tabs of the client to the user', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42973' },
}, async ({ user, connectWithToken, browserWithExtension }) => {
  const page = await user.openTab('Alpha');
  await page.bringToFront();

  const client = await connectWithToken('worker', { args: ['--background'] });
  await client.navigate('Beta');
  expect(await client.snapshot()).toContain('Page Beta');
  expect(await user.activeTabs()).toEqual(['Alpha']);
  expect(await browserWithExtension.chromeStubArgs()).toEqual([[
    `--user-data-dir=${browserWithExtension.userDataDir}`,
    '--profile-directory=Default',
    '--open-in-background',
    connectPageUrl,
  ]]);

  await client.openTab('Gamma');
  await client.selectTab('Beta');
  expect(await client.currentTab()).toBe('Beta');
  expect(await user.activeTabs()).toEqual(['Alpha']);
});

// The manage page.

test('extension icon opens the manage page with the clients and their tabs', async ({ user, connectWithToken }) => {
  const client = await connectWithToken('worker');
  await client.navigate('Alpha');

  await user.clickExtensionIcon();
  const managePages = () => user.browserContext.pages().filter(page => page.url().endsWith('/manage.html'));
  await expect.poll(() => managePages().length).toBe(1);
  const [managePage] = managePages();
  const connection = managePage.locator('.connection');
  await expect(connection.locator('.card-title')).toHaveText('worker');
  await expect(connection.locator('.tab-title')).toHaveText(['Alpha']);

  // The page shows a new tab of the client without a reload.
  await client.openTab('Beta');
  await expect(connection.locator('.tab-title')).toHaveText(['Alpha', 'Beta']);

  // The second click shows the same page again.
  await user.clickExtensionIcon();
  await expect.poll(user.activeTabs).toEqual(['Playwright Extension']);
  expect(managePages()).toHaveLength(1);

  await connection.getByRole('button', { name: 'Disconnect' }).click();
  await expect(connection).toHaveCount(0);
  await expect(managePage.locator('.status-banner')).toContainText('No clients are connected.');
});

test('user rotates the token on the manage page', async ({ user, connectWithToken }) => {
  const oldToken = await user.token();
  await user.rotateToken();
  expect(await user.token()).not.toBe(oldToken);

  const client = await connectWithToken('worker');
  await client.navigate('Alpha');
  expect(await client.snapshot()).toContain('Page Alpha');
});

// Protocol versions.

test('connect page asks for protocol version 2', async ({ openConnectPage }) => {
  const { connectPage } = await openConnectPage('worker');
  expect(new URL(connectPage.url()).searchParams.get('protocolVersion')).toBe('2');
});

testWithOldExtension('client works with an old version of the extension', async ({ connect }) => {
  const client = await connect('worker');
  await client.navigate('Alpha');
  expect(await client.snapshot()).toContain('- generic [active] [ref=e1]: Page Alpha');
});

test('connect page asks to update the extension for a newer client', async ({ openConnectPage }) => {
  const { connectPage } = await openConnectPage('worker', { env: { PWTEST_EXTENSION_PROTOCOL: '1000' } });
  await expect(connectPage.locator('.status-banner')).toContainText('Playwright client trying to connect requires newer extension version');
});

test('connect page asks to update the client for an older client', async ({ openConnectPage }) => {
  const { connectPage } = await openConnectPage('worker', { env: { PWTEST_EXTENSION_PROTOCOL: '1' } });
  await expect(connectPage.locator('.status-banner')).toContainText('The client uses an unsupported protocol version. Update Playwright MCP or CLI to the latest version.');
});

// The browser profile that the client starts.

test('--user-data-dir gives the profile of the extension', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42163' },
}, async ({ connect, browserWithExtension }) => {
  const client = await connect('worker', {}, { args: [`--user-data-dir=${browserWithExtension.userDataDir}`] });
  await client.navigate('Alpha');
  expect(await client.snapshot()).toContain('Page Alpha');
});

test('PLAYWRIGHT_MCP_PROFILE_DIR_NAME gives the profile of the extension', async ({ connect }) => {
  const client = await connect('worker', {}, { env: { PLAYWRIGHT_MCP_PROFILE_DIR_NAME: 'Default' } });
  await client.navigate('Alpha');
  expect(await client.snapshot()).toContain('Page Alpha');
});

test('client starts the profile that has the extension', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/41916' },
}, async ({ chromeArgs }) => {
  const userDataDir = await createUserDataDir({
    'Default': {},
    'Profile 1': { hasExtension: true },
  });

  const args = await chromeArgs({ env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir } });
  expect(args).toContain('--profile-directory=Profile 1');
});

test('client ignores the preferences that an uninstalled extension left in a profile', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1712' },
}, async ({ chromeArgs }) => {
  const userDataDir = await createUserDataDir({
    'Default': {
      preferences: {
        extensions: { settings: { [extensionId]: {} } },
        protection: { macs: { extensions: { settings: { [extensionId]: 'DEADBEEF' } } } },
        updateclientdata: { apps: { [extensionId]: { pv: '0.3.0' } } },
      },
    },
    'Profile 1': {
      preferences: { extensions: { settings: { [extensionId]: { path: '/tmp/extension', location: 4 } } } },
    },
  }, { lastUsedProfile: 'Default' });

  const args = await chromeArgs({ env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir } });
  expect(args).toContain('--profile-directory=Profile 1');
});

test('--profile-dir-name selects one of the profiles that have the extension', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1732' },
}, async ({ chromeArgs }) => {
  const userDataDir = await createUserDataDir({
    'Default': { hasExtension: true },
    'Profile 1': { hasExtension: true },
  }, { lastUsedProfile: 'Default' });

  const args = await chromeArgs({ args: [`--user-data-dir=${userDataDir}`, '--profile-dir-name=Profile 1'] });
  expect(args).toEqual([`--user-data-dir=${userDataDir}`, '--profile-directory=Profile 1', connectPageUrl]);
});

test('--executable-path skips the check that the profile has the extension', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1590' },
}, async ({ chromeArgs }) => {
  const args = await chromeArgs({ env: { PWTEST_EXTENSION_USER_DATA_DIR: test.info().outputPath('empty-profile') } });
  expect(args).toContainEqual(connectPageUrl);
});

test('client reports an error when the profile does not have the extension', async ({ startClient, server }) => {
  const userDataDir = test.info().outputPath('empty-profile');
  const { client } = await startClient({
    args: ['--extension'],
    env: { PWTEST_EXTENSION_USER_DATA_DIR: userDataDir },
  });

  expect(await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } })).toHaveResponse({
    error: expect.stringContaining(`Playwright Extension not found in "${userDataDir}"`),
    isError: true,
  });
});

test('--browser selects the user data directory of that channel', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1589' },
}, async ({ startClient, server }) => {
  const { client } = await startClient({
    args: ['--extension', '--browser=chrome-dev'],
    omitArgs: ['--browser=chromium'],
  });

  expect(await client.callTool({ name: 'browser_navigate', arguments: { url: server.HELLO_WORLD } })).toHaveResponse({
    error: expect.stringContaining(`Playwright Extension not found in "${defaultUserDataDirForChannel('chrome-dev')}"`),
    isError: true,
  });
});

// The relay.

test('relay refuses a WebSocket connection with a wrong host or origin', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright-mcp/issues/1694' },
}, async ({ user, openConnectPage }) => {
  const { connectPage, connected } = await openConnectPage('worker');
  const relayUrl = new URL(connectPage.url()).searchParams.get('mcpRelayUrl')!;
  await user.allow(connectPage);
  await connected;

  expect(await wsUpgradeResult(relayUrl, { host: 'evil.com' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl, { host: 'evil.com:80' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl, { origin: 'http://evil.com' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl, { origin: 'https://evil.com' })).toBe(403);
  expect(await wsUpgradeResult(relayUrl)).toBe('connected');
});

// Gives the HTTP status of a refused WebSocket connection, or 'connected'.
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

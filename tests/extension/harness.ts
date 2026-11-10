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

import { test as base, expect, extensionId, clickAllow, waitForConnectPage } from './extension-fixtures';

import type { Config } from '../../packages/playwright-core/src/tools/mcp/config.d';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { BrowserContext, Page, Worker } from 'playwright';
import type { TestServer } from '../config/testserver';
import type { WebSocket } from 'ws';

// The harness has two actors.
// - `user` is the person at the browser: opens, closes and drags tabs, reads the tab groups.
// - `connect()` and `connectWithToken()` start a client, which is an MCP server with `--extension`.
// Tabs and pages are named by their title. The page with the title "Alpha" has the text "Page Alpha".

export type Group = { title: string, color: string, tabs: string[] };

// What the user selects on the connect page. Nothing selected gives the client a blank tab.
export type Pick = {
  // Titles of the tabs to select.
  tabs?: string[];
  // Title of the tab group to select.
  group?: string;
  // Titles of all rows that the connect page must offer, groups first.
  offered?: string[];
};

type ConnectOptions = {
  // More command line arguments of the client.
  args?: string[];
  // More environment variables of the client.
  env?: Record<string, string>;
  config?: Config;
};

type Fixtures = {
  // Paths of more extensions that the browser loads.
  extraExtensions: string[];
  user: User;
  // Starts a client. The client connects to the extension on its first tool call.
  start: (clientName: string, options?: ConnectOptions) => Promise<ExtensionClient>;
  // Starts a client and gives its connect page, before the user picks anything. `connected` resolves when the client has its tabs.
  openConnectPage: (clientName: string, options?: ConnectOptions) => Promise<{ client: ExtensionClient, connectPage: Page, connected: Promise<void> }>;
  // Starts a client. The user makes the pick on the connect page.
  connect: (clientName: string, pick?: Pick | ((connectPage: Page) => Promise<void>), options?: ConnectOptions) => Promise<ExtensionClient>;
  // Starts a client that skips the connect page. It gets a blank tab.
  connectWithToken: (clientName: string, options?: ConnectOptions) => Promise<ExtensionClient>;
  // Connects to the extension the way the relay of a client does, to send protocol commands and read protocol events.
  connectRelay: (clientName: string) => Promise<RelayPeer>;
};

export const test = base.extend<Fixtures>({
  extraExtensions: [[], { option: true }],

  user: async ({ browserWithExtension, extraExtensions, server }, use) => {
    const browserContext = await browserWithExtension.launch(undefined, extraExtensions);
    await use(new User(browserContext, server));
  },

  start: async ({ user, browserWithExtension, startClient }, use) => {
    await use(async (clientName, options = {}) => {
      const args = options.args ?? [];
      // The client finds the browser profile through the environment, unless the test gives --user-data-dir.
      const profileEnv = args.some(arg => arg.startsWith('--user-data-dir=')) ? {} : { PWTEST_EXTENSION_USER_DATA_DIR: browserWithExtension.userDataDir };
      const { client, stderr } = await startClient({
        clientName,
        args: ['--extension', ...args],
        env: { ...profileEnv, ...options.env },
        config: options.config,
      });
      return new ExtensionClient(client, user, stderr);
    });
  },

  openConnectPage: async ({ user, start }, use) => {
    await use(async (clientName, options = {}) => {
      const client = await start(clientName, options);
      // The first tool call makes the client open the connect page.
      const connectPagePromise = user.waitForConnectPage();
      const connected = client.tabs().then(() => {});
      connected.catch(() => {});
      return { client, connectPage: await connectPagePromise, connected };
    });
  },

  connect: async ({ user, openConnectPage }, use) => {
    await use(async (clientName, pick = {}, options = {}) => {
      const { client, connectPage, connected } = await openConnectPage(clientName, options);
      if (typeof pick === 'function')
        await pick(connectPage);
      else
        await user.allow(connectPage, pick);
      await connected;
      return client;
    });
  },

  connectWithToken: async ({ user, start }, use) => {
    await use(async (clientName, options = {}) => {
      const client = await start(clientName, { ...options, env: { PLAYWRIGHT_MCP_EXTENSION_TOKEN: await user.token(), ...options.env } });
      await client.tabs();
      return client;
    });
  },

  connectRelay: async ({ user, server }, use) => {
    await use(async clientName => {
      // The test server is the relay.
      const socketPromise = new Promise<WebSocket>(resolve => server.onceWebSocketConnection(resolve));
      const url = new URL(`chrome-extension://${extensionId}/connect.html`);
      url.searchParams.set('mcpRelayUrl', `ws://127.0.0.1:${server.PORT}/ws`);
      url.searchParams.set('protocolVersion', '2');
      url.searchParams.set('client', JSON.stringify({ name: clientName }));
      url.searchParams.set('token', await user.token());
      const connectPage = await user.browserContext.newPage();
      await connectPage.goto(url.toString()).catch(() => {});
      const peer = new RelayPeer(await socketPromise);
      await expect.poll(() => peer.eventNames()).toContain('extension.initialized');
      return peer;
    });
  },
});

export { expect };

type ChromeAction<Args extends any[]> = (chrome: any, tabOf: (title: string) => Promise<any>, ...args: Args) => Promise<any>;

export class User {
  readonly browserContext: BrowserContext;
  private _server: TestServer;
  private _definedPages = new Set<string>();
  private _token: Promise<string> | undefined;

  constructor(browserContext: BrowserContext, server: TestServer) {
    this.browserContext = browserContext;
    this._server = server;
  }

  // The URL of the page with the given title. The page has the text "Page <title>", unless definePage() gave it a body.
  urlOf(title: string): string {
    if (!this._definedPages.has(title))
      this.definePage(title, `Page ${title}`);
    return this._server.PREFIX + '/' + title;
  }

  definePage(title: string, body: string): void {
    this._definedPages.add(title);
    this._server.setContent('/' + title, `<title>${title}</title><body>${body}</body>`, 'text/html');
  }

  // The token of the extension. A client that has it skips the connect page.
  async token(): Promise<string> {
    this._token ??= this._onManagePage(async managePage => (await managePage.locator('.auth-token-code').textContent())!.split('=')[1]);
    return await this._token;
  }

  // Clicks "Rotate token" on the manage page of the extension.
  async rotateToken(): Promise<void> {
    await this._onManagePage(managePage => managePage.getByRole('button', { name: 'Rotate token' }).click());
    this._token = undefined;
  }

  // Clicks the icon of the extension in the toolbar of the browser.
  async clickExtensionIcon(): Promise<void> {
    await this.chrome(async chrome => chrome.action.onClicked.dispatch({}));
  }

  // The next connect page that a client opens.
  async waitForConnectPage(): Promise<Page> {
    return await waitForConnectPage(this.browserContext);
  }

  // The page of the tab, to change it the way its own script or the user does.
  pageOf(title: string): Page {
    const page = this.browserContext.pages().find(page => page.url() === this.urlOf(title));
    if (!page)
      throw new Error(`No page with the title "${title}"`);
    return page;
  }

  async openTab(title: string): Promise<Page> {
    const page = await this.browserContext.newPage();
    await page.goto(this.urlOf(title));
    return page;
  }

  // Opens a tab that Playwright cannot open, for example a chrome:// page.
  async openUrl(url: string, title: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, url: string) => chrome.tabs.create({ url, active: false }), url);
    await expect.poll(() => this.tabs()).toContain(title);
  }

  async navigateTab(title: string, toTitle: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, title: string, url: string) => chrome.tabs.update((await tabOf(title)).id, { url }), title, this.urlOf(toTitle));
    await expect.poll(() => this.tabs()).toContain(toTitle);
  }

  async closeTab(title: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, title: string) => chrome.tabs.remove((await tabOf(title)).id), title);
  }

  // Drags the tabs into the tab group that has the tab `groupTabTitle`.
  async dragIntoGroupOf(titles: string | string[], groupTabTitle: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, titles: string[], groupTabTitle: string) => {
      const tabs = await Promise.all(titles.map(tabOf));
      await chrome.tabs.group({ groupId: (await tabOf(groupTabTitle)).groupId, tabIds: tabs.map(tab => tab.id) });
    }, [titles].flat(), groupTabTitle);
  }

  // Makes a red tab group of the user from the tabs.
  async dragIntoNewGroup(titles: string | string[], groupTitle: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, titles: string[], groupTitle: string) => {
      const tabs = await Promise.all(titles.map(tabOf));
      const groupId = await chrome.tabs.group({ tabIds: tabs.map(tab => tab.id) });
      await chrome.tabGroups.update(groupId, { title: groupTitle, color: 'red' });
    }, [titles].flat(), groupTitle);
  }

  async dragOutOfGroup(title: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, title: string) => chrome.tabs.ungroup((await tabOf(title)).id), title);
  }

  async dragIntoNewWindow(title: string): Promise<void> {
    await this.chrome(async (chrome, tabOf, title: string) => chrome.windows.create({ tabId: (await tabOf(title)).id }), title);
  }

  // Titles of all tabs in the browser.
  async tabs(): Promise<string[]> {
    return await this.chrome(async chrome => (await chrome.tabs.query({})).map((tab: any) => tab.title));
  }

  // Titles of the tabs that the user sees, one for each window.
  activeTabs = async (): Promise<string[]> => {
    return await this.chrome(async chrome => (await chrome.tabs.query({ active: true })).map((tab: any) => tab.title));
  };

  async tabId(title: string): Promise<number> {
    return await this.chrome(async (chrome, tabOf, title: string) => (await tabOf(title)).id, title);
  }

  // The tab group of the tab, and the badge that the extension shows on a controlled tab.
  async tab(title: string): Promise<{ group: string | null, badge: string }> {
    return await this.chrome(async (chrome, tabOf, title: string) => {
      const tab = await tabOf(title);
      return {
        group: tab.groupId === -1 ? null : (await chrome.tabGroups.get(tab.groupId)).title,
        badge: await chrome.action.getBadgeText({ tabId: tab.id }),
      };
    }, title);
  }

  // All tab groups, ordered by their tabs.
  groups = async (): Promise<Group[]> => {
    const groups: Group[] = await this.chrome(async chrome => {
      const [groups, tabs] = await Promise.all([chrome.tabGroups.query({}), chrome.tabs.query({})]);
      return groups.map((group: any) => ({
        title: group.title,
        color: group.color,
        tabs: tabs.filter((tab: any) => tab.groupId === group.id).map((tab: any) => tab.title).sort(),
      }));
    });
    return groups.sort((a, b) => a.tabs.join().localeCompare(b.tabs.join()));
  };

  // Colors of all tab groups, in the order of the alphabet.
  groupColors = async (): Promise<string[]> => {
    return (await this.groups()).map(group => group.color).sort();
  };

  // Selects tabs or a group on the connect page and clicks Allow.
  async allow(connectPage: Page, pick: Pick = {}): Promise<void> {
    const row = (title: string) => connectPage.locator('.tab-item').filter({ has: connectPage.getByText(title, { exact: true }) });
    if (pick.offered)
      await expect(connectPage.locator('.tab-item .tab-title')).toHaveText(pick.offered);
    if (pick.group)
      await row(pick.group).filter({ hasText: 'Tab group' }).click();
    for (const title of pick.tabs ?? [])
      await row(title).getByRole('checkbox').check();
    await clickAllow(connectPage);
  }

  // Names of the connected clients, as the manage page of the extension shows them.
  connectedClients = async (): Promise<string[]> => {
    return await this._onManagePage(async managePage => {
      const { sessions } = await managePage.evaluate(() => (window as any).chrome.runtime.sendMessage({ type: 'getStatus' }));
      return sessions.map((session: any) => session.clientName);
    });
  };

  // Clicks Disconnect for the client on the manage page of the extension.
  async disconnect(clientName: string): Promise<void> {
    await this._onManagePage(async managePage => {
      const connection = managePage.locator('.connection').filter({ has: managePage.getByText(clientName, { exact: true }) });
      await connection.getByRole('button', { name: 'Disconnect' }).click();
      await expect(connection).toHaveCount(0);
    });
  }

  // Runs code with the extension API. `tabOf(title)` gives the tab with that title, and waits for it.
  async chrome<Args extends any[]>(action: ChromeAction<Args>, ...args: Args): Promise<any> {
    return await (await this._serviceWorker()).evaluate(async ({ source, args }) => {
      const chrome = (globalThis as any).chrome;
      // A tab gets its title when its page loads, so wait for it.
      const tabOf = async (title: string) => {
        for (let attempt = 0; attempt < 50; attempt++) {
          const tab = (await chrome.tabs.query({})).find((tab: any) => tab.title === title);
          if (tab)
            return tab;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`No tab with the title "${title}"`);
      };
      return await (0, eval)(`(${source})`)(chrome, tabOf, ...args);
    }, { source: action.toString(), args });
  }

  // Stops the service worker of the extension, as Chrome does with an idle one. The next extension event starts a new one.
  async stopExtensionWorker(): Promise<void> {
    const page = await this.browserContext.newPage();
    await page.goto('chrome://serviceworker-internals/');
    await page.locator('.serviceworker-item', { hasText: extensionId }).getByRole('button', { name: 'Stop' }).click();
    await page.close();
  }

  // Changes the title and the color of the tab group that has the tab.
  async editGroupOf(tabTitle: string, style: { title: string, color: string }): Promise<void> {
    await this.chrome(async (chrome, tabOf, tabTitle: string, style: object) => chrome.tabGroups.update((await tabOf(tabTitle)).groupId, style), tabTitle, style);
  }

  private async _serviceWorker(): Promise<Worker> {
    const isBackground = (worker: Worker) => worker.url().startsWith(`chrome-extension://${extensionId}/`);
    return this.browserContext.serviceWorkers().find(isBackground) ?? await this.browserContext.waitForEvent('serviceworker', isBackground);
  }

  private async _onManagePage<T>(action: (managePage: Page) => Promise<T>): Promise<T> {
    const managePage = await this.browserContext.newPage();
    await managePage.goto(`chrome-extension://${extensionId}/manage.html`);
    try {
      return await action(managePage);
    } finally {
      await managePage.close();
    }
  }
}

export class ExtensionClient {
  // The MCP client, for tool calls that the harness does not wrap.
  readonly mcp: Client;
  // The log of the client process.
  readonly stderr: () => string;
  private _user: User;

  constructor(mcp: Client, user: User, stderr: () => string) {
    this.mcp = mcp;
    this._user = user;
    this.stderr = stderr;
  }

  // Titles of the tabs that the client controls. A client with no tabs opens a blank tab on this call.
  tabs = async (): Promise<string[]> => {
    return (await this._tabList()).map(tab => tab.title);
  };

  async currentTab(): Promise<string | undefined> {
    return (await this._tabList()).find(tab => tab.current)?.title;
  }

  // Navigates the current tab to the page with the given title.
  async navigate(title: string): Promise<void> {
    await this.mcp.callTool({ name: 'browser_navigate', arguments: { url: this._user.urlOf(title) } });
  }

  async openTab(title: string): Promise<void> {
    await this.mcp.callTool({ name: 'browser_tabs', arguments: { action: 'new', url: this._user.urlOf(title) } });
  }

  async selectTab(title: string): Promise<void> {
    await this.mcp.callTool({ name: 'browser_tabs', arguments: { action: 'select', index: await this._indexOf(title) } });
  }

  async closeTab(title: string): Promise<void> {
    await this.mcp.callTool({ name: 'browser_tabs', arguments: { action: 'close', index: await this._indexOf(title) } });
  }

  // Clicks the element with the given ref of the snapshot.
  async click(ref: string, modifiers: string[] = []): Promise<void> {
    await this.mcp.callTool({ name: 'browser_click', arguments: { element: ref, target: ref, modifiers } });
  }

  // The accessibility snapshot of the current tab.
  async snapshot(): Promise<string> {
    return await this._text('browser_snapshot', {});
  }

  // Runs Playwright code with the page of the current tab. Gives the response text, which has the result.
  async runCode(code: string): Promise<string> {
    return await this._text('browser_run_code_unsafe', { code });
  }

  // Checks that the client can select the tab and read its page.
  async expectControls(title: string): Promise<void> {
    await expect.poll(this.tabs).toContain(title);
    await this.selectTab(title);
    expect(await this.snapshot()).toContain(`Page ${title}`);
  }

  async close(): Promise<void> {
    await this.mcp.close();
  }

  private async _tabList(): Promise<{ title: string, current: boolean }[]> {
    const text = await this._text('browser_tabs', { action: 'list' });
    return [...text.matchAll(/^- \d+: (\(current\) )?\[(.*?)\]\(/gm)].map(match => ({ title: match[2], current: !!match[1] }));
  }

  private async _indexOf(title: string): Promise<number> {
    const index = (await this.tabs()).indexOf(title);
    if (index === -1)
      throw new Error(`The client has no tab with the title "${title}"`);
    return index;
  }

  private async _text(tool: string, args: Record<string, unknown>): Promise<string> {
    const response = await this.mcp.callTool({ name: tool, arguments: args }) as any;
    return response.content?.[0]?.text ?? '';
  }
}

// The relay side of the extension protocol.
export class RelayPeer {
  readonly events: { method: string, params: any[] }[] = [];
  private _socket: WebSocket;
  private _callbacks = new Map<number, (response: any) => void>();
  private _lastId = 0;

  constructor(socket: WebSocket) {
    this._socket = socket;
    socket.on('message', data => {
      const message = JSON.parse(data.toString());
      if (message.id)
        this._callbacks.get(message.id)!(message);
      else
        this.events.push(message);
    });
  }

  eventNames(): string[] {
    return this.events.map(event => event.method);
  }

  // Ids of the tabs that the extension announced to this client.
  announcedTabIds(): number[] {
    return this.events.filter(event => event.method === 'chrome.tabs.onCreated').map(event => event.params[0].id);
  }

  // Sends a command. Gives `{ result }` or `{ error }`.
  async send(method: string, ...params: any[]): Promise<{ result?: any, error?: string }> {
    const id = ++this._lastId;
    const { result, error } = await new Promise<any>(resolve => {
      this._callbacks.set(id, resolve);
      this._socket.send(JSON.stringify({ id, method, params }));
    });
    return error === undefined ? { result } : { error };
  }

  // Attaches the debugger to the tab.
  async attach(tabId: number): Promise<{ result?: any, error?: string }> {
    return await this.send('chrome.debugger.attach', { tabId }, '1.3');
  }

  // Sends a CDP command to the tab.
  async sendToTab(tabId: number, cdpMethod: string, cdpParams?: object): Promise<{ result?: any, error?: string }> {
    return await this.send('chrome.debugger.sendCommand', { tabId }, cdpMethod, cdpParams);
  }

  close(): void {
    this._socket.close();
  }
}

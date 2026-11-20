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

/**
 * WebSocket server that bridges Playwright and the Playwright extension.
 * `connectOverCDP('extension://chrome')` starts it, see `startExtensionRelay`.
 *
 *   Playwright (connectOverCDP)
 *        │  CDP: Target.*, Page.*, ... with pw-tab-N session ids
 *        ▼  ws /cdp/<uuid>
 *   ┌─ CDPRelayServer (this file) ───────────────────────────────────────────┐
 *   │ Speaks: CDP framing only (command ids ↔ responses). Launches Chrome    │
 *   │ with the connect page, accepts both sockets, waits for the handshake.  │
 *   │ Knows nothing about tabs, sessions or chrome.* APIs.                   │
 *   │ ┌─ BrowserModel (crExtensionBrowserModel.ts) ─────────────────────────┐│
 *   │ │ Speaks: CDP semantics AND the extension protocol. The only          ││
 *   │ │ translator, in both directions:                                     ││
 *   │ │   CDP command    → chrome.* command  (Target.*, Browser.* switch)   ││
 *   │ │   chrome.* event → CDP event         (chrome.tabs/debugger switch)  ││
 *   │ │ State: tab id ↔ pw-tab-N session id, child sessions (workers).      ││
 *   │ │ ┌─ ExtensionConnection ────────────────────────────────────────────┐││
 *   │ │ │ Speaks: extension protocol framing only (ids ↔ responses).       │││
 *   │ │ └──────────────────────────────────────────────────────────────────┘││
 *   │ └─────────────────────────────────────────────────────────────────────┘│
 *   └────┬───────────────────────────────────────────────────────────────────┘
 *        │  extension protocol (crExtensionProtocol.ts): chrome.* calls and
 *        │  events mirrored 1:1, plus extension.initialized
 *        ▼  ws /extension/<uuid>
 *   ┌─ Playwright extension (packages/extension/src) ────────────────────────┐
 *   │ ClientSession: speaks extension protocol. Runs a chrome.* command only │
 *   │   for a tab that its client owns, sends the events of those tabs.      │
 *   │ TabRegistry: the owner of each tab. A tab has one client at most.      │
 *   │ TabGroupManager: keeps the tab group of a client equal to its tabs.    │
 *   └────┬───────────────────────────────────────────────────────────────────┘
 *        │  chrome.debugger / chrome.tabs / chrome.tabGroups
 *        ▼
 *   Chrome
 *
 * Handshake: the extension connects first, reports its initial tabs with
 * `chrome.tabs.onCreated`, then sends `extension.initialized`. Only then is
 * Playwright connected to the CDP endpoint, so `Target.setAutoAttach` is
 * answered from a populated BrowserModel.
 *
 * The protocol version advertised to the extension can be overridden with the
 * PWTEST_EXTENSION_PROTOCOL env variable (used in tests). The only time limit
 * is the timeout of `connectOverCDP`.
 */

import { spawn } from 'child_process';
import path from 'path';

import ws from 'ws';
import { ManualPromise } from '@isomorphic/manualPromise';
import { defaultUserDataDirForChannel } from '@utils/chromiumChannels';
import { debugLogger } from '@utils/debugLogger';
import { WSServer } from '@utils/wsServer';
import { TimeoutError } from '../errors';
import { registry } from '../registry';

import { isExtensionInstalledInProfile, playwrightExtensionId, playwrightExtensionInstallUrl } from './crExtensionProfile';
import { BrowserModel } from './crExtensionBrowserModel';
import * as protocol from './crExtensionProtocol';

import type { ExtensionURL } from './crAttachURL';
import type { CDPMessage } from './crExtensionBrowserModel';
import type { Progress } from '../progress';
import type { WebSocket } from 'ws';

// The way to provide an option depends on the client: the library, the MCP server or the CLI.
const optionHint = (option: string) => `Refer to the documentation of your Playwright client (library, MCP server or CLI) for how to provide the ${option}.`;

export type ExtensionRelayOptions = {
  channel: string;
  executablePath?: string;
  userDataDir?: string;
  profileDirectory?: string;
  clientName: string;
  token?: string;
  // Undefined for a client without a tab group.
  tabGroup?: { title?: string, color?: string };
  background: boolean;
};

// Starts the relay, opens the connect page in the browser and waits for the extension.
// The URL tells which browser and profile to connect to. The other options of the connection
// are the headers of `connectOverCDP`. `headers` must have lower case names.
export async function startExtensionRelay(progress: Progress, extensionURL: ExtensionURL, headers: Record<string, string>): Promise<CDPRelayServer> {
  const { channel, executablePath, userDataDir: customUserDataDir } = extensionURL;
  const token = headers['x-playwright-extension-token'];
  // Custom executablePath may target a browser in a different filesystem (e.g. Windows chrome.exe from WSL2), so the local profile path is not meaningful.
  const userDataDir = customUserDataDir ?? (executablePath ? undefined : defaultUserDataDirForChannel(channel));
  const profileDirectory = extensionURL.profileDirectory ?? 'Default';
  if (userDataDir && !executablePath && !await progress.race(isExtensionInstalledInProfile(path.join(userDataDir, profileDirectory))))
    throw new Error(`Playwright Extension not found in "${path.join(userDataDir, profileDirectory)}". Install it from ${playwrightExtensionInstallUrl}, or give the browser executable in the URL to use a browser at a custom location: extension://${channel}?executablePath=<path>.`);

  const relay = new CDPRelayServer({
    channel,
    executablePath,
    userDataDir: customUserDataDir,
    profileDirectory,
    clientName: headers['x-playwright-extension-client-name'] ?? 'Playwright',
    token,
    tabGroup: headers['x-playwright-extension-tab-group'] === 'false' ? undefined : {
      title: headers['x-playwright-extension-tab-group-title'],
      color: headers['x-playwright-extension-tab-group-color'],
    },
    background: headers['x-playwright-extension-background'] === 'true',
  });
  const started = relay.start();
  try {
    await progress.race(started);
    progress.log(`<extension> relay started, extension endpoint: ${relay.extensionEndpoint()}`);
    await progress.race(relay.establishExtensionConnection());
    return relay;
  } catch (error) {
    // A server that is not listening yet cannot be closed.
    void started.catch(() => {}).then(() => relay.stop());
    if (error instanceof TimeoutError) {
      const advice = token
        ? `Make sure the extension is installed in the Chrome profile "${profileDirectory}" and the extension token is correct. ${optionHint('extension token')}`
        : `Make sure the extension is installed in the Chrome profile "${profileDirectory}", and allow the connection on the connect page. Increase the connection timeout to have more time. ${optionHint('connection timeout')}`;
      throw new TimeoutError(`Playwright extension did not connect within ${progress.timeout / 1000}s after opening the connect page. ${advice}`);
    }
    throw error;
  }
}

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: any;
};

export class CDPRelayServer {
  private _wsServer: WSServer;
  private _wsHost!: string;
  private _options: ExtensionRelayOptions;
  private _cdpPath: string;
  private _extensionPath: string;
  private _cdpConnection: WebSocket | null = null;
  private _browser: BrowserModel | null = null;
  // Resolved once the extension has connected and finished its initial handshake.
  private _extensionReady = new ManualPromise<void>();
  private _protocolVersion: number;
  private _stopped = false;

  constructor(options: ExtensionRelayOptions) {
    this._options = options;
    this._protocolVersion = parseInt(process.env.PWTEST_EXTENSION_PROTOCOL ?? protocol.VERSION.toString(), 10);

    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;

    void this._extensionReady.catch(e => debugLogger.log('extension', e));
    this._wsServer = new WSServer({
      onRequest: (request, response) => {
        response.statusCode = 404;
        response.end();
      },
      onHeaders: () => {},
      onUpgrade: () => undefined,
      isAllowedPathname: pathname => pathname === this._cdpPath || pathname === this._extensionPath,
      onConnection: (request, url, ws) => {
        debugLogger.log('extension', `New connection to ${url.pathname}`);
        if (url.pathname === this._cdpPath)
          this._handlePlaywrightConnection(ws);
        else
          this._handleExtensionConnection(ws);
        return undefined;
      },
    });
  }

  async start(): Promise<void> {
    this._wsHost = await this._wsServer.listen(0, undefined, '');
  }

  cdpEndpoint() {
    return `${this._wsHost}${this._cdpPath}`;
  }

  extensionEndpoint() {
    return `${this._wsHost}${this._extensionPath}`;
  }

  async establishExtensionConnection() {
    debugLogger.log('extension', 'Establishing extension connection');
    this._openConnectPageInBrowser();
    debugLogger.log('extension', 'Waiting for incoming extension connection');
    await this._extensionReady;
    debugLogger.log('extension', 'Extension connection established');
  }

  private _openConnectPageInBrowser() {
    const { clientName, tabGroup, background, token } = this._options;
    const mcpRelayEndpoint = `${this._wsHost}${this._extensionPath}`;
    const url = new URL(`chrome-extension://${playwrightExtensionId}/connect.html`);
    url.searchParams.set('mcpRelayUrl', mcpRelayEndpoint);
    const client = {
      name: clientName,
      // Not used anymore.
      version: undefined,
    };
    url.searchParams.set('client', JSON.stringify(client));
    url.searchParams.set('protocolVersion', this._protocolVersion.toString());
    if (!tabGroup)
      url.searchParams.set('tabGroup', 'false');
    if (tabGroup?.title)
      url.searchParams.set('tabGroupTitle', tabGroup.title);
    if (tabGroup?.color)
      url.searchParams.set('tabGroupColor', tabGroup.color);
    if (background)
      url.searchParams.set('background', 'true');
    if (token)
      url.searchParams.set('token', token);
    const href = url.toString();

    const channel = registry.isChromiumAlias(this._options.channel) ? 'chromium' : this._options.channel;
    let executablePath = this._options.executablePath;
    if (!executablePath) {
      const executableInfo = registry.findExecutable(channel);
      if (!executableInfo)
        throw new Error(`Unsupported channel: "${this._options.channel}"`);
      executablePath = executableInfo.executablePath();
      if (!executablePath)
        throw new Error(`"${this._options.channel}" executable not found. Make sure it is installed at a standard location.`);
    }

    const args: string[] = [];
    // The default profile dir is not passed explicitly, the browser resolves it on its own.
    if (this._options.userDataDir)
      args.push(`--user-data-dir=${this._options.userDataDir}`);
    if (this._options.profileDirectory)
      args.push(`--profile-directory=${this._options.profileDirectory}`);
    // Without a token, the user must see the connect page to approve the connection.
    if (background && token)
      args.push('--open-in-background');
    args.push(href);
    const browserProcess = spawn(executablePath, args, {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
    browserProcess.on('error', error => {
      if (!this._extensionReady.isDone())
        this._extensionReady.reject(new Error(`Failed to start the browser at "${executablePath}": ${error.message}`));
    });
    // The browser of the user must not keep this process alive.
    browserProcess.unref();
  }

  stop(): void {
    if (this._stopped)
      return;
    this._stopped = true;
    this._closeCDPConnection('Server stopped');
    this._closeExtensionConnection('Server stopped');
    void this._wsServer.close().catch(e => debugLogger.log('extension', e));
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._browser) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._browser = new BrowserModel(ws, this._options.background, {
      sendToCDPClient: message => this._sendToCDPClient(message),
      onInitialized: () => this._extensionReady.resolve(),
      onClose: reason => {
        debugLogger.log('extension', `Extension WebSocket closed: ${reason}`);
        if (!this._extensionReady.isDone())
          this._extensionReady.reject(new Error(`Extension disconnected before initialization: ${reason}`));
        this._closeCDPConnection(`Extension disconnected: ${reason}`);
      },
    });
  }

  private _closeExtensionConnection(reason: string) {
    this._browser?.close(reason);
    if (!this._extensionReady.isDone())
      this._extensionReady.reject(new Error(reason));
  }

  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (!this._browser) {
      debugLogger.log('extension', 'Rejecting Playwright connection: extension not connected');
      ws.close(1000, 'Extension not connected');
      return;
    }
    if (this._cdpConnection) {
      debugLogger.log('extension', 'Rejecting second Playwright connection');
      ws.close(1000, 'Another CDP client already connected');
      return;
    }
    this._cdpConnection = ws;
    ws.on('message', async data => {
      try {
        await this._handlePlaywrightMessage(JSON.parse(data.toString()));
      } catch (error: any) {
        debugLogger.log('extension', `Error while handling Playwright message\n${data.toString()}`);
        debugLogger.log('extension', error);
      }
    });
    ws.on('close', () => {
      this._closeExtensionConnection('Playwright client disconnected');
      debugLogger.log('extension', 'Playwright WebSocket closed');
    });
    ws.on('error', error => {
      debugLogger.log('extension', `Playwright WebSocket error: ${error}`);
    });
    debugLogger.log('extension', 'Playwright connected');
  }

  private _closeCDPConnection(reason: string) {
    if (this._cdpConnection?.readyState === ws.OPEN)
      this._cdpConnection.close(1000, reason);
  }

  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    debugLogger.log('extension', `← Playwright: ${message.method} (id=${message.id})`);
    const { id, sessionId, method, params } = message;
    try {
      const result = await this._handleCDPCommand(method, params, sessionId);
      this._sendToCDPClient({ id, sessionId, result });
    } catch (e) {
      debugLogger.log('extension', 'Error in the extension:');
      debugLogger.log('extension', e as Error);
      this._sendToCDPClient({
        id,
        sessionId,
        error: { message: (e as Error).message }
      });
    }
  }

  private async _handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<any> {
    if (!this._browser)
      throw new Error('Extension not connected');
    return await this._browser.handleCDPCommand(method, params, sessionId);
  }

  private _sendToCDPClient(message: CDPMessage): void {
    debugLogger.log('extension', `→ Playwright: ${message.method ?? `response(id=${message.id})`}`);
    this._cdpConnection?.send(JSON.stringify(message));
  }
}

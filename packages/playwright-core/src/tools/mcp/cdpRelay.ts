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
 * WebSocket server that bridges Playwright MCP and the Playwright extension.
 *
 *   Playwright (connectOverCDP)
 *        │  CDP: Target.*, Page.*, ... with pw-tab-N session ids
 *        ▼  ws /cdp/<uuid>
 *   ┌─ CDPRelayServer (this file) ───────────────────────────────────────────┐
 *   │ Speaks: CDP framing only (command ids ↔ responses). Launches Chrome    │
 *   │ with the connect page, accepts both sockets, waits for the handshake.  │
 *   │ Knows nothing about tabs, sessions or chrome.* APIs.                   │
 *   │ ┌─ BrowserModel (browserModel.ts) ────────────────────────────────────┐│
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
 *        │  extension protocol (protocol.ts): chrome.* calls and events
 *        │  mirrored 1:1, plus extension.initialized
 *        ▼  ws /extension/<uuid>
 *   ┌─ Playwright extension (packages/extension/src) ────────────────────────┐
 *   │ RelayConnection: speaks extension protocol ↔ chrome.* APIs. Invokes    │
 *   │   allow-listed chrome.* commands reflectively, forwards the            │
 *   │   chrome.debugger and chrome.tabs events of attached tabs.             │
 *   │ ConnectedTabGroup: speaks chrome.tabGroups only. The Chrome tab group  │
 *   │   is the source of truth for which tabs a client controls.             │
 *   │ background.ts: one ConnectedTabGroup per client, connect page flow.    │
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
 * PWTEST_EXTENSION_PROTOCOL env variable, and the connection timeout with
 * PWTEST_EXTENSION_CONNECT_TIMEOUT (both used in tests).
 */

import { spawn } from 'child_process';

import debug from 'debug';
import ws from 'ws';
import { ManualPromise } from '@isomorphic/manualPromise';
import { monotonicTime } from '@isomorphic/time';
import { raceAgainstDeadline } from '@isomorphic/timeoutRunner';
import { WSServer } from '@utils/wsServer';
import { registry } from '../../server/registry/index';

import { playwrightExtensionId } from '../utils/extension';
import { logUnhandledError } from './log';
import { BrowserModel } from './browserModel';
import * as protocol from './protocol';

import type { CDPMessage } from './browserModel';
import type { WebSocket } from 'ws';


const debugLogger = debug('pw:mcp:relay');

const extensionConnectionTimeout = +(process.env.PWTEST_EXTENSION_CONNECT_TIMEOUT ?? 30_000);

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: any;
};

export class CDPRelayServer {
  private _wsServer: WSServer;
  private _wsHost!: string;
  private _browserChannel: string;
  private _executablePath?: string;
  private _customUserDataDir?: string;
  private _profileDirectory?: string;
  private _background: boolean;
  private _cdpPath: string;
  private _extensionPath: string;
  private _cdpConnection: WebSocket | null = null;
  private _browser: BrowserModel | null = null;
  // Resolved once the extension has connected and finished its initial handshake.
  private _extensionReady = new ManualPromise<void>();
  private _protocolVersion: number;
  private _token?: string;

  constructor(browserChannel: string, executablePath?: string, customUserDataDir?: string, profileDirectory?: string, background = false) {
    this._browserChannel = browserChannel;
    this._executablePath = executablePath;
    this._customUserDataDir = customUserDataDir;
    this._profileDirectory = profileDirectory;
    this._background = background;
    this._protocolVersion = parseInt(process.env.PWTEST_EXTENSION_PROTOCOL ?? protocol.VERSION.toString(), 10);
    this._token = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;

    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;

    void this._extensionReady.catch(logUnhandledError);
    this._wsServer = new WSServer({
      onRequest: (request, response) => {
        response.statusCode = 404;
        response.end();
      },
      onHeaders: () => {},
      onUpgrade: () => undefined,
      isAllowedPathname: pathname => pathname === this._cdpPath || pathname === this._extensionPath,
      onConnection: (request, url, ws) => {
        debugLogger(`New connection to ${url.pathname}`);
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

  async establishExtensionConnection(clientName: string, tabGroup = true) {
    debugLogger('Establishing extension connection');
    await this._openConnectPageInBrowser(clientName, tabGroup);
    debugLogger('Waiting for incoming extension connection');
    // Without a token the user has to approve the connection in the browser, which can take arbitrarily long.
    const deadline = this._token ? monotonicTime() + extensionConnectionTimeout : 0;
    const { timedOut } = await raceAgainstDeadline(() => this._extensionReady, deadline);
    if (timedOut) {
      const profile = this._profileDirectory ? ` "${this._profileDirectory}"` : '';
      throw new Error(`Playwright extension did not connect within ${extensionConnectionTimeout / 1000}s after opening the connect page. Make sure the extension is installed in the Chrome profile${profile} and PLAYWRIGHT_MCP_EXTENSION_TOKEN matches its token.`);
    }
    debugLogger('Extension connection established');
  }

  private async _openConnectPageInBrowser(clientName: string, tabGroup: boolean) {
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
    if (this._background)
      url.searchParams.set('background', 'true');
    if (this._token)
      url.searchParams.set('token', this._token);
    const href = url.toString();

    const channel = registry.isChromiumAlias(this._browserChannel) ? 'chromium' : this._browserChannel;
    let executablePath = this._executablePath;
    if (!executablePath) {
      const executableInfo = registry.findExecutable(channel);
      if (!executableInfo)
        throw new Error(`Unsupported channel: "${this._browserChannel}"`);
      executablePath = executableInfo.executablePath();
      if (!executablePath)
        throw new Error(`"${this._browserChannel}" executable not found. Make sure it is installed at a standard location.`);
    }

    const args: string[] = [];
    // The default profile dir is not passed explicitly, the browser resolves it on its own.
    if (this._customUserDataDir)
      args.push(`--user-data-dir=${this._customUserDataDir}`);
    if (this._profileDirectory)
      args.push(`--profile-directory=${this._profileDirectory}`);
    // Without a token, the user must see the connect page to approve the connection.
    if (this._background && this._token)
      args.push('--open-in-background');
    args.push(href);
    spawn(executablePath, args, {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
  }

  stop(): void {
    this._closeCDPConnection('Server stopped');
    this._closeExtensionConnection('Server stopped');
    void this._wsServer.close().catch(logUnhandledError);
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._browser) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._browser = new BrowserModel(ws, this._background, {
      sendToCDPClient: message => this._sendToCDPClient(message),
      onInitialized: () => this._extensionReady.resolve(),
      onClose: reason => {
        debugLogger('Extension WebSocket closed:', reason);
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
      debugLogger('Rejecting Playwright connection: extension not connected');
      ws.close(1000, 'Extension not connected');
      return;
    }
    if (this._cdpConnection) {
      debugLogger('Rejecting second Playwright connection');
      ws.close(1000, 'Another CDP client already connected');
      return;
    }
    this._cdpConnection = ws;
    ws.on('message', async data => {
      try {
        await this._handlePlaywrightMessage(JSON.parse(data.toString()));
      } catch (error: any) {
        debugLogger(`Error while handling Playwright message\n${data.toString()}\n`, error);
      }
    });
    ws.on('close', () => {
      this._closeExtensionConnection('Playwright client disconnected');
      debugLogger('Playwright WebSocket closed');
    });
    ws.on('error', error => {
      debugLogger('Playwright WebSocket error:', error);
    });
    debugLogger('Playwright MCP connected');
  }

  private _closeCDPConnection(reason: string) {
    if (this._cdpConnection?.readyState === ws.OPEN)
      this._cdpConnection.close(1000, reason);
  }

  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    debugLogger('← Playwright:', `${message.method} (id=${message.id})`);
    const { id, sessionId, method, params } = message;
    try {
      const result = await this._handleCDPCommand(method, params, sessionId);
      this._sendToCDPClient({ id, sessionId, result });
    } catch (e) {
      debugLogger('Error in the extension:', e);
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
    debugLogger('→ Playwright:', `${message.method ?? `response(id=${message.id})`}`);
    this._cdpConnection?.send(JSON.stringify(message));
  }
}

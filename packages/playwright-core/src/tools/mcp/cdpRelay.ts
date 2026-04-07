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
 * WebSocket server that bridges Playwright MCP and Chrome Extension
 *
 * Endpoints:
 * - /cdp/guid - Full CDP interface for Playwright MCP
 * - /extension/guid - Extension connection that exposes a thin chrome.* RPC.
 *
 * The relay owns CDP session management: it asks the extension for the user's
 * tab pick (extension.selectTab), then attaches the debugger and dispatches
 * Target.attachedToTarget events to Playwright. Additional tabs are created
 * either by Playwright (Target.createTarget → chrome.tabs.create) or by the
 * controlled tabs themselves (chrome.tabs.onCreated event from the extension).
 */

import { spawn } from 'child_process';
import http from 'http';
import os from 'os';

import { debug, ws, wsServer } from '../../utilsBundle';
import { registry } from '../../server/registry/index';
import { ManualPromise } from '../../utils/isomorphic/manualPromise';

import { addressToString } from '../utils/mcp/http';
import { logUnhandledError } from './log';
import * as protocol from './protocol';

import type websocket from 'ws';
import type { ExtensionCommand, ExtensionEvents } from './protocol';
import type { WebSocket, WebSocketServer } from '../../utilsBundle';


const debugLogger = debug('pw:mcp:relay');

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: any;
};

type CDPResponse = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code?: number; message: string };
};

type TabSession = {
  tabId: number;
  sessionId: string;
  targetInfo: any;
};

export class CDPRelayServer {
  private _wsHost: string;
  private _browserChannel: string;
  private _userDataDir?: string;
  private _executablePath?: string;
  private _cdpPath: string;
  private _extensionPath: string;
  private _wss: WebSocketServer;
  private _playwrightConnection: WebSocket | null = null;
  private _extensionConnection: ExtensionConnection | null = null;
  // sessionId → TabSession (sessions known to the Playwright client).
  private _tabSessions = new Map<string, TabSession>();
  private _tabIdToSessionId = new Map<number, string>();
  private _nextSessionId: number = 1;
  private _extensionConnectionPromise!: ManualPromise<void>;

  constructor(server: http.Server, browserChannel: string, userDataDir?: string, executablePath?: string) {
    this._wsHost = addressToString(server.address(), { protocol: 'ws' });
    this._browserChannel = browserChannel;
    this._userDataDir = userDataDir;
    this._executablePath = executablePath;

    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;

    this._resetExtensionConnection();
    this._wss = new wsServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }

  cdpEndpoint() {
    return `${this._wsHost}${this._cdpPath}`;
  }

  extensionEndpoint() {
    return `${this._wsHost}${this._extensionPath}`;
  }

  async ensureExtensionConnectionForMCPContext(clientName: string) {
    debugLogger('Ensuring extension connection for MCP context');
    if (this._extensionConnection)
      return;
    this._connectBrowser(clientName);
    debugLogger('Waiting for incoming extension connection');
    await Promise.race([
      this._extensionConnectionPromise,
      new Promise((_, reject) => setTimeout(() => {
        reject(new Error(`Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed. See https://github.com/microsoft/playwright-mcp/blob/main/packages/extension/README.md for installation instructions.`));
      }, process.env.PWMCP_TEST_CONNECTION_TIMEOUT ? parseInt(process.env.PWMCP_TEST_CONNECTION_TIMEOUT, 10) : 5_000)),
    ]);
    debugLogger('Extension connection established');
  }

  private _connectBrowser(clientName: string) {
    const mcpRelayEndpoint = `${this._wsHost}${this._extensionPath}`;
    // Need to specify "key" in the manifest.json to make the id stable when loading from file.
    const url = new URL('chrome-extension://mmlmfjhmonkocbjadbfplnigmagldckm/connect.html');
    url.searchParams.set('mcpRelayUrl', mcpRelayEndpoint);
    const client = {
      name: clientName,
      // Not used anymore.
      version: undefined,
    };
    url.searchParams.set('client', JSON.stringify(client));
    url.searchParams.set('protocolVersion', process.env.PWMCP_TEST_PROTOCOL_VERSION ?? protocol.VERSION.toString());
    const token = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;
    if (token)
      url.searchParams.set('token', token);
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
    if (this._userDataDir)
      args.push(`--user-data-dir=${this._userDataDir}`);
    if (os.platform() === 'linux' && channel === 'chromium')
      args.push('--no-sandbox');
    args.push(href);
    spawn(executablePath, args, {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
  }

  stop(): void {
    this.closeConnections('Server stopped');
    this._wss.close();
  }

  closeConnections(reason: string) {
    this._closePlaywrightConnection(reason);
    this._closeExtensionConnection(reason);
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`);
    debugLogger(`New connection to ${url.pathname}`);
    if (url.pathname === this._cdpPath) {
      this._handlePlaywrightConnection(ws);
    } else if (url.pathname === this._extensionPath) {
      this._handleExtensionConnection(ws);
    } else {
      debugLogger(`Invalid path: ${url.pathname}`);
      ws.close(4004, 'Invalid path');
    }
  }

  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (this._playwrightConnection) {
      debugLogger('Rejecting second Playwright connection');
      ws.close(1000, 'Another CDP client already connected');
      return;
    }
    this._playwrightConnection = ws;
    ws.on('message', async data => {
      try {
        const message = JSON.parse(data.toString());
        await this._handlePlaywrightMessage(message);
      } catch (error: any) {
        debugLogger(`Error while handling Playwright message\n${data.toString()}\n`, error);
      }
    });
    ws.on('close', () => {
      if (this._playwrightConnection !== ws)
        return;
      this._playwrightConnection = null;
      this._closeExtensionConnection('Playwright client disconnected');
      debugLogger('Playwright WebSocket closed');
    });
    ws.on('error', error => {
      debugLogger('Playwright WebSocket error:', error);
    });
    debugLogger('Playwright MCP connected');
  }

  private _closeExtensionConnection(reason: string) {
    this._extensionConnection?.close(reason);
    this._extensionConnectionPromise.reject(new Error(reason));
    this._resetExtensionConnection();
  }

  private _resetExtensionConnection() {
    this._tabSessions.clear();
    this._tabIdToSessionId.clear();
    this._extensionConnection = null;
    this._extensionConnectionPromise = new ManualPromise();
    void this._extensionConnectionPromise.catch(logUnhandledError);
  }

  private _closePlaywrightConnection(reason: string) {
    if (this._playwrightConnection?.readyState === ws.OPEN)
      this._playwrightConnection.close(1000, reason);
    this._playwrightConnection = null;
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._extensionConnection = new ExtensionConnection(ws);
    this._extensionConnection.onclose = (c, reason) => {
      debugLogger('Extension WebSocket closed:', reason, c === this._extensionConnection);
      if (this._extensionConnection !== c)
        return;
      this._resetExtensionConnection();
      this._closePlaywrightConnection(`Extension disconnected: ${reason}`);
    };
    this._extensionConnection.onmessage = this._handleExtensionMessage.bind(this);
    this._extensionConnectionPromise.resolve();
  }

  private _handleExtensionMessage<M extends keyof ExtensionEvents>(method: M, params: ExtensionEvents[M]['params']) {
    switch (method) {
      case 'chrome.debugger.onEvent': {
        const [source, cdpMethod, cdpParams] = params as ExtensionEvents['chrome.debugger.onEvent']['params'];
        if (source.tabId === undefined)
          return;
        const tabSessionId = this._tabIdToSessionId.get(source.tabId);
        if (!tabSessionId)
          return;
        // Top-level CDP events for the tab use the tab's relay sessionId.
        // Child CDP sessions (workers, oopifs) keep their own sessionId.
        const sessionId = source.sessionId || tabSessionId;
        this._sendToPlaywright({
          sessionId,
          method: cdpMethod,
          params: cdpParams,
        });
        break;
      }
      case 'chrome.debugger.onDetach': {
        const [source] = params as ExtensionEvents['chrome.debugger.onDetach']['params'];
        if (source.tabId !== undefined)
          this._detachTab(source.tabId);
        break;
      }
      case 'chrome.tabs.onCreated': {
        const [tab] = params as ExtensionEvents['chrome.tabs.onCreated']['params'];
        // A controlled tab opened a popup. Attach to it.
        if (tab.id !== undefined)
          void this._attachTab(tab.id).catch(logUnhandledError);
        break;
      }
      case 'chrome.tabs.onRemoved': {
        const [tabId] = params as ExtensionEvents['chrome.tabs.onRemoved']['params'];
        this._detachTab(tabId);
        break;
      }
    }
  }

  private async _attachTab(tabId: number): Promise<TabSession> {
    if (this._tabIdToSessionId.has(tabId))
      return this._tabSessions.get(this._tabIdToSessionId.get(tabId)!)!;
    if (!this._extensionConnection)
      throw new Error('Extension not connected');
    await this._extensionConnection.send('chrome.debugger.attach', [{ tabId }, '1.3']);
    const result = await this._extensionConnection.send('chrome.debugger.sendCommand', [
      { tabId },
      'Target.getTargetInfo',
    ]);
    const targetInfo = result?.targetInfo;
    const sessionId = `pw-tab-${this._nextSessionId++}`;
    const tabSession: TabSession = { tabId, sessionId, targetInfo };
    this._tabSessions.set(sessionId, tabSession);
    this._tabIdToSessionId.set(tabId, sessionId);
    debugLogger(`Attached tab ${tabId} as session ${sessionId}`);
    this._sendToPlaywright({
      method: 'Target.attachedToTarget',
      params: {
        sessionId,
        targetInfo: { ...targetInfo, attached: true },
        waitingForDebugger: false,
      },
    });
    return tabSession;
  }

  private _detachTab(tabId: number): void {
    const sessionId = this._tabIdToSessionId.get(tabId);
    if (!sessionId)
      return;
    this._tabIdToSessionId.delete(tabId);
    this._tabSessions.delete(sessionId);
    debugLogger(`Detached tab ${tabId} (session ${sessionId})`);
    this._sendToPlaywright({
      method: 'Target.detachedFromTarget',
      params: { sessionId },
    });
  }

  private async _handlePlaywrightMessage(message: CDPCommand): Promise<void> {
    debugLogger('← Playwright:', `${message.method} (id=${message.id})`);
    const { id, sessionId, method, params } = message;
    try {
      const result = await this._handleCDPCommand(method, params, sessionId);
      this._sendToPlaywright({ id, sessionId, result });
    } catch (e) {
      debugLogger('Error in the extension:', e);
      this._sendToPlaywright({
        id,
        sessionId,
        error: { message: (e as Error).message }
      });
    }
  }

  private async _handleCDPCommand(method: string, params: any, sessionId: string | undefined): Promise<any> {
    switch (method) {
      case 'Browser.getVersion': {
        return {
          protocolVersion: '1.3',
          product: 'Chrome/Extension-Bridge',
          userAgent: 'CDP-Bridge-Server/1.0.0',
        };
      }
      case 'Browser.setDownloadBehavior': {
        return { };
      }
      case 'Target.setAutoAttach': {
        // Forward child session handling.
        if (sessionId)
          break;
        // Ask the user to pick the initial tab via the connect UI, then attach.
        if (!this._extensionConnection)
          throw new Error('Extension not connected');
        const { tabId } = await this._extensionConnection.send('extension.selectTab', []);
        await this._attachTab(tabId);
        return { };
      }
      case 'Target.createTarget': {
        if (!this._extensionConnection)
          throw new Error('Extension not connected');
        const tab = await this._extensionConnection.send('chrome.tabs.create', [{ url: params?.url }]);
        if (tab?.id === undefined)
          throw new Error('Failed to create tab');
        const tabSession = await this._attachTab(tab.id);
        return { targetId: tabSession.targetInfo?.targetId };
      }
      case 'Target.getTargetInfo': {
        if (sessionId)
          return this._tabSessions.get(sessionId)?.targetInfo;
        return this._tabSessions.values().next().value?.targetInfo;
      }
    }
    return await this._forwardToExtension(method, params, sessionId);
  }

  private async _forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any> {
    if (!this._extensionConnection)
      throw new Error('Extension not connected');
    // Resolve the relay sessionId to a tabId. Child CDP sessions pass through unchanged.
    let tabId: number | undefined;
    let cdpSessionId: string | undefined = sessionId;
    if (sessionId && this._tabSessions.has(sessionId)) {
      tabId = this._tabSessions.get(sessionId)!.tabId;
      cdpSessionId = undefined;
    }
    if (tabId === undefined) {
      // No relay tab session — fall back to the only tab if there is one.
      const first = this._tabSessions.values().next().value;
      if (first)
        tabId = first.tabId;
    }
    if (tabId === undefined)
      throw new Error('No tab is connected');
    return await this._extensionConnection.send('chrome.debugger.sendCommand', [
      { tabId, sessionId: cdpSessionId },
      method,
      params,
    ]);
  }

  private _sendToPlaywright(message: CDPResponse): void {
    debugLogger('→ Playwright:', `${message.method ?? `response(id=${message.id})`}`);
    this._playwrightConnection?.send(JSON.stringify(message));
  }
}

type ExtensionResponse = {
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: string;
};

class ExtensionConnection {
  private readonly _ws: WebSocket;
  private readonly _callbacks = new Map<number, { resolve: (o: any) => void, reject: (e: Error) => void, error: Error }>();
  private _lastId = 0;

  onmessage?: <M extends keyof ExtensionEvents>(method: M, params: ExtensionEvents[M]['params']) => void;
  onclose?: (self: ExtensionConnection, reason: string) => void;

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }

  async send<M extends keyof ExtensionCommand>(method: M, params: ExtensionCommand[M]['params']): Promise<ExtensionCommand[M]['result']> {
    if (this._ws.readyState !== ws.OPEN)
      throw new Error(`Unexpected WebSocket state: ${this._ws.readyState}`);
    const id = ++this._lastId;
    this._ws.send(JSON.stringify({ id, method, params }));
    const error = new Error(`Protocol error: ${method}`);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error });
    });
  }

  close(message: string) {
    debugLogger('closing extension connection:', message);
    if (this._ws.readyState === ws.OPEN)
      this._ws.close(1000, message);
  }

  private _onMessage(event: websocket.RawData) {
    const eventData = event.toString();
    let parsedJson;
    try {
      parsedJson = JSON.parse(eventData);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to malformed JSON. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
      return;
    }
    try {
      this._handleParsedMessage(parsedJson);
    } catch (e: any) {
      debugLogger(`<closing ws> Closing websocket due to failed onmessage callback. eventData=${eventData} e=${e?.message}`);
      this._ws.close();
    }
  }

  private _handleParsedMessage(object: ExtensionResponse) {
    if (object.id && this._callbacks.has(object.id)) {
      const callback = this._callbacks.get(object.id)!;
      this._callbacks.delete(object.id);
      if (object.error) {
        const error = callback.error;
        error.message = object.error;
        callback.reject(error);
      } else {
        callback.resolve(object.result);
      }
    } else if (object.id) {
      debugLogger('← Extension: unexpected response', object);
    } else {
      this.onmessage?.(object.method! as keyof ExtensionEvents, object.params);
    }
  }

  private _onClose(event: websocket.CloseEvent) {
    debugLogger(`<ws closed> code=${event.code} reason=${event.reason}`);
    this._dispose();
    this.onclose?.(this, event.reason);
  }

  private _onError(event: websocket.ErrorEvent) {
    debugLogger(`<ws error> message=${event.message} type=${event.type} target=${event.target}`);
    this._dispose();
  }

  private _dispose() {
    for (const callback of this._callbacks.values())
      callback.reject(new Error('WebSocket closed'));
    this._callbacks.clear();
  }
}

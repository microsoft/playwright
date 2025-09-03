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
 * - /extension/guid - Extension connection for chrome.debugger forwarding
 */

import { spawn } from 'child_process';
import http from 'http';

import { debug, ws, wsServer } from 'playwright-core/lib/utilsBundle';
import { registry } from 'playwright-core/lib/server/registry/index';
import { ManualPromise } from 'playwright-core/lib/utils';

import { httpAddressToString } from '../sdk/http';
import { logUnhandledError } from '../log';
import * as protocol from './protocol';

import type websocket from 'ws';
import type { ClientInfo } from '../browser/browserContextFactory';
import type { ExtensionCommand, ExtensionEvents } from './protocol';
import type { WebSocket, WebSocketServer } from 'playwright-core/lib/utilsBundle';


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
  private _connectedTabInfo: {
    targetInfo: any;
    // Page sessionId that should be used by this connection.
    sessionId: string;
  } | undefined;
  private _nextSessionId: number = 1;
  private _extensionConnectionPromise!: ManualPromise<void>;

  constructor(server: http.Server, browserChannel: string, userDataDir?: string, executablePath?: string) {
    this._wsHost = httpAddressToString(server.address()).replace(/^http/, 'ws');
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

  async ensureExtensionConnectionForMCPContext(clientInfo: ClientInfo, abortSignal: AbortSignal, toolName: string | undefined) {
    debugLogger('Ensuring extension connection for MCP context');
    if (this._extensionConnection)
      return;
    this._connectBrowser(clientInfo, toolName);
    debugLogger('Waiting for incoming extension connection');
    await Promise.race([
      this._extensionConnectionPromise,
      new Promise((_, reject) => setTimeout(() => {
        reject(new Error(`Extension connection timeout. Make sure the "Playwright MCP Bridge" extension is installed. See https://github.com/microsoft/playwright-mcp/blob/main/extension/README.md for installation instructions.`));
      }, process.env.PWMCP_TEST_CONNECTION_TIMEOUT ? parseInt(process.env.PWMCP_TEST_CONNECTION_TIMEOUT, 10) : 5_000)),
      new Promise((_, reject) => abortSignal.addEventListener('abort', reject))
    ]);
    debugLogger('Extension connection established');
  }

  private _connectBrowser(clientInfo: ClientInfo, toolName: string | undefined) {
    const mcpRelayEndpoint = `${this._wsHost}${this._extensionPath}`;
    // Need to specify "key" in the manifest.json to make the id stable when loading from file.
    const url = new URL('chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html');
    url.searchParams.set('mcpRelayUrl', mcpRelayEndpoint);
    const client = {
      name: clientInfo.name,
      version: clientInfo.version,
    };
    url.searchParams.set('client', JSON.stringify(client));
    url.searchParams.set('protocolVersion', process.env.PWMCP_TEST_PROTOCOL_VERSION ?? protocol.VERSION.toString());
    if (toolName)
      url.searchParams.set('newTab', String(toolName === 'browser_navigate'));
    const href = url.toString();

    let executablePath = this._executablePath;
    if (!executablePath) {
      const executableInfo = registry.findExecutable(this._browserChannel);
      if (!executableInfo)
        throw new Error(`Unsupported channel: "${this._browserChannel}"`);
      executablePath = executableInfo.executablePath('javascript');
      if (!executablePath)
        throw new Error(`"${this._browserChannel}" executable not found. Make sure it is installed at a standard location.`);
    }

    const args: string[] = [];
    if (this._userDataDir)
      args.push(`--user-data-dir=${this._userDataDir}`);
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
    this._connectedTabInfo = undefined;
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
      case 'forwardCDPEvent':
        const sessionId = params.sessionId || this._connectedTabInfo?.sessionId;
        this._sendToPlaywright({
          sessionId,
          method: params.method,
          params: params.params
        });
        break;
    }
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
        // Simulate auto-attach behavior with real target info
        const { targetInfo } = await this._extensionConnection!.send('attachToTab', { });
        this._connectedTabInfo = {
          targetInfo,
          sessionId: `pw-tab-${this._nextSessionId++}`,
        };
        debugLogger('Simulating auto-attach');
        this._sendToPlaywright({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: this._connectedTabInfo.sessionId,
            targetInfo: {
              ...this._connectedTabInfo.targetInfo,
              attached: true,
            },
            waitingForDebugger: false
          }
        });
        return { };
      }
      case 'Target.getTargetInfo': {
        return this._connectedTabInfo?.targetInfo;
      }
    }
    return await this._forwardToExtension(method, params, sessionId);
  }

  private async _forwardToExtension(method: string, params: any, sessionId: string | undefined): Promise<any> {
    if (!this._extensionConnection)
      throw new Error('Extension not connected');
    // Top level sessionId is only passed between the relay and the client.
    if (this._connectedTabInfo?.sessionId === sessionId)
      sessionId = undefined;
    return await this._extensionConnection.send('forwardCDPCommand', { sessionId, method, params });
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

  async send<M extends keyof ExtensionCommand>(method: M, params: ExtensionCommand[M]['params']): Promise<any> {
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

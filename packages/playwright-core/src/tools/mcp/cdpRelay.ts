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
 * WebSocket server that bridges Playwright MCP and Chrome Extension.
 *
 * Endpoints:
 * - /cdp/guid - Full CDP interface for Playwright MCP
 * - /extension/guid - Extension connection
 *
 * The protocol version advertised to the extension can be overridden with the
 * PWTEST_EXTENSION_PROTOCOL env variable, and the connection timeout with
 * PWTEST_EXTENSION_CONNECT_TIMEOUT (both used in tests).
 */

import { spawn } from 'child_process';
import os from 'os';

import debug from 'debug';
import ws from 'ws';
import { ManualPromise } from '@isomorphic/manualPromise';
import { monotonicTime } from '@isomorphic/time';
import { raceAgainstDeadline } from '@isomorphic/timeoutRunner';
import { WSServer } from '@utils/wsServer';
import { registry } from '../../server/registry/index';

import { playwrightExtensionId } from '../utils/extension';
import { logUnhandledError } from './log';
import { ExtensionProtocolV2 } from './cdpRelayV2';
import * as protocol from './protocol';

import type websocket from 'ws';
import type { ExtensionCommandV2, ExtensionEventsV2 } from './protocol';
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

type CDPResponse = CDPMessage;

export class CDPRelayServer {
  private _wsServer: WSServer;
  private _wsHost!: string;
  private _browserChannel: string;
  private _executablePath?: string;
  private _customUserDataDir?: string;
  private _profileDirectory?: string;
  private _cdpPath: string;
  private _extensionPath: string;
  private _cdpConnection: WebSocket | null = null;
  private _extensionConnection: ExtensionConnection | null = null;
  private _protocolVersion: number;
  private _token?: string;
  private _handler: ExtensionProtocolV2;
  private _extensionConnectionPromise = new ManualPromise<void>();

  constructor(browserChannel: string, executablePath?: string, customUserDataDir?: string, profileDirectory?: string) {
    this._browserChannel = browserChannel;
    this._executablePath = executablePath;
    this._customUserDataDir = customUserDataDir;
    this._profileDirectory = profileDirectory;
    this._protocolVersion = parseInt(process.env.PWTEST_EXTENSION_PROTOCOL ?? protocol.VERSION.toString(), 10);
    this._token = process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN;

    const sendCommand = (method: string, params: any): Promise<any> => {
      if (!this._extensionConnection)
        throw new Error('Extension not connected');
      return this._extensionConnection.send(method as keyof ExtensionCommandV2, params);
    };
    this._handler = new ExtensionProtocolV2(sendCommand);

    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;

    void this._extensionConnectionPromise.catch(logUnhandledError);
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

  async establishExtensionConnection(clientName: string) {
    debugLogger('Establishing extension connection');
    await this._openConnectPageInBrowser(clientName);
    debugLogger('Waiting for incoming extension connection');
    // Without a token the user has to approve the connection in the browser, which can take arbitrarily long.
    const deadline = this._token ? monotonicTime() + extensionConnectionTimeout : 0;
    const { timedOut } = await raceAgainstDeadline(async () => {
      await this._extensionConnectionPromise;
      await this._handler.ready();
    }, deadline);
    if (timedOut) {
      const profile = this._profileDirectory ? ` "${this._profileDirectory}"` : '';
      throw new Error(`Playwright extension did not connect within ${extensionConnectionTimeout / 1000}s after opening the connect page. Make sure the extension is installed in the Chrome profile${profile} and PLAYWRIGHT_MCP_EXTENSION_TOKEN matches its token.`);
    }
    debugLogger('Extension connection established');
  }

  private async _openConnectPageInBrowser(clientName: string) {
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
    this._closeConnections('Server stopped');
    void this._wsServer.close().catch(logUnhandledError);
  }

  private _closeConnections(reason: string) {
    this._closeCDPConnection(reason);
    this._closeExtensionConnection(reason);
  }

  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (!this._extensionConnection) {
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
    this._handler.connectOverCDP(msg => this._sendToCDPClient(msg));
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

  private _closeExtensionConnection(reason: string) {
    this._extensionConnection?.close(reason);
    if (!this._extensionConnectionPromise.isDone())
      this._extensionConnectionPromise.reject(new Error(reason));
  }

  private _closeCDPConnection(reason: string) {
    if (this._cdpConnection?.readyState === ws.OPEN)
      this._cdpConnection.close(1000, reason);
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }
    this._extensionConnection = new ExtensionConnection(ws);
    this._extensionConnection.onclose = reason => {
      debugLogger('Extension WebSocket closed:', reason);
      this._handler.onExtensionDisconnect(reason);
      this._closeCDPConnection(`Extension disconnected: ${reason}`);
    };
    this._extensionConnection.onmessage = (method, params) => this._handler.handleExtensionEvent(method, params);
    this._extensionConnectionPromise.resolve();
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
    }
    const handled = await this._handler.handleCDPCommand(method, params, sessionId);
    if (handled)
      return handled.result;
    return await this._handler.forwardToExtension(method, params, sessionId);
  }

  private _sendToCDPClient(message: CDPResponse): void {
    debugLogger('→ Playwright:', `${message.method ?? `response(id=${message.id})`}`);
    this._cdpConnection?.send(JSON.stringify(message));
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

  onmessage?: <M extends keyof ExtensionEventsV2>(method: M, params: ExtensionEventsV2[M]['params']) => void;
  onclose?: (reason: string) => void;

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }

  async send<M extends keyof ExtensionCommandV2>(method: M, params: ExtensionCommandV2[M]['params']): Promise<any> {
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
      this.onmessage?.(object.method! as keyof ExtensionEventsV2, object.params);
    }
  }

  private _onClose(code: number, reason: Buffer) {
    const message = reason.toString();
    debugLogger(`<ws closed> code=${code} reason=${message}`);
    this._dispose();
    this.onclose?.(message);
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

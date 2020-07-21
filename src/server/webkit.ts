/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { WKBrowser } from '../webkit/wkBrowser';
import { Env } from './processLauncher';
import * as path from 'path';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';
import { BrowserTypeBase } from './browserType';
import { ConnectionTransport, ProtocolResponse, ProtocolRequest } from '../transport';
import * as ws from 'ws';
import { Logger } from '../logger';
import { BrowserOptions } from '../browser';
import { BrowserDescriptor } from '../install/browserPaths';
import { WebSocketServer } from './webSocketServer';
import { assert } from '../helper';
import { LaunchOptionsBase } from '../types';

export class WebKit extends BrowserTypeBase {
  constructor(packagePath: string, browser: BrowserDescriptor) {
    super(packagePath, browser, null /* use pipe not websocket */);
  }

  _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<WKBrowser> {
    return WKBrowser.connect(transport, options);
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return { ...env, CURL_COOKIE_JAR_PATH: path.join(userDataDir, 'cookiejar.db') };
  }

  _amendArguments(browserArguments: string[]): string[] {
    return browserArguments;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    transport.send({method: 'Playwright.close', params: {}, id: kBrowserCloseMessageId});
  }

  _startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer {
    return startWebSocketServer(transport, logger, port);
  }

  _defaultArgs(options: LaunchOptionsBase, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], proxy, devtools, headless } = options;
    if (devtools)
      console.warn('devtools parameter as a launch argument in WebKit is not supported. Also starting Web Inspector manually will terminate the execution in WebKit.');
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir='));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const webkitArguments = ['--inspector-pipe'];
    if (headless)
      webkitArguments.push('--headless');
    if (isPersistent)
      webkitArguments.push(`--user-data-dir=${userDataDir}`);
    else
      webkitArguments.push(`--no-startup-window`);
    if (proxy) {
      if (process.platform === 'darwin') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(`--proxy-bypass-list=${proxy.bypass}`);
      } else if (process.platform === 'linux') {
        webkitArguments.push(`--proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(...proxy.bypass.split(',').map(t => `--ignore-host=${t}`));
      } else if (process.platform === 'win32') {
        webkitArguments.push(`--curl-proxy=${proxy.server}`);
        if (proxy.bypass)
          webkitArguments.push(`--curl-noproxy=${proxy.bypass}`);
      }
    }
    webkitArguments.push(...args);
    if (isPersistent)
      webkitArguments.push('about:blank');
    return webkitArguments;
  }
}

function startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer {
  const pendingBrowserContextCreations = new Set<number>();
  const pendingBrowserContextDeletions = new Map<number, string>();
  const browserContextIds = new Map<string, ws>();

  const server = new WebSocketServer(transport, logger, port, {
    onBrowserResponse(seqNum: number, source: ws, message: ProtocolResponse) {
      if (source.readyState === ws.CLOSED || source.readyState === ws.CLOSING) {
        if (pendingBrowserContextCreations.has(seqNum))
          server.sendMessageToBrowserOneWay('Playwright.deleteContext', { browserContextId: message.result.browserContextId });
        return;
      }

      if (pendingBrowserContextCreations.has(seqNum)) {
        // Browser.createContext response -> establish context attribution.
        browserContextIds.set(message.result.browserContextId, source);
        pendingBrowserContextCreations.delete(seqNum);
      }

      const deletedContextId = pendingBrowserContextDeletions.get(seqNum);
      if (deletedContextId) {
        // Browser.deleteContext response -> remove context attribution.
        browserContextIds.delete(deletedContextId);
        pendingBrowserContextDeletions.delete(seqNum);
      }

      source.send(JSON.stringify(message));
      return;
    },

    onBrowserNotification(message: ProtocolResponse) {
      // Process notification response.
      const { params, browserContextId } = message;
      const contextId = browserContextId || params.browserContextId;
      assert(contextId);
      const socket = browserContextIds.get(contextId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      socket.send(JSON.stringify(message));
    },

    onClientAttached(socket: ws) {
    },

    onClientRequest(socket: ws, message: ProtocolRequest) {
      const { method, params } = message;
      const seqNum = server.sendMessageToBrowser(message, socket);
      if (method === 'Playwright.createContext')
        pendingBrowserContextCreations.add(seqNum);
      if (method === 'Playwright.deleteContext')
        pendingBrowserContextDeletions.set(seqNum, params.browserContextId);
    },

    onClientDetached(socket: ws) {
      for (const [browserContextId, s] of browserContextIds) {
        if (s === socket) {
          server.sendMessageToBrowserOneWay('Playwright.deleteContext', { browserContextId });
          browserContextIds.delete(browserContextId);
        }
      }
    }
  });
  return server;
}

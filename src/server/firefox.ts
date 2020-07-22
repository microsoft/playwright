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

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as ws from 'ws';
import { FFBrowser } from '../firefox/ffBrowser';
import { kBrowserCloseMessageId } from '../firefox/ffConnection';
import { BrowserTypeBase, LaunchNonPersistentOptions } from './browserType';
import { Env } from './processLauncher';
import { ConnectionTransport, ProtocolResponse, ProtocolRequest } from '../transport';
import { Logger } from '../logger';
import { BrowserOptions } from '../browser';
import { BrowserDescriptor } from '../install/browserPaths';
import { WebSocketServer } from './webSocketServer';

export class Firefox extends BrowserTypeBase {
  constructor(packagePath: string, browser: BrowserDescriptor) {
    const webSocketRegex = /^Juggler listening on (ws:\/\/.*)$/;
    super(packagePath, browser, { webSocketRegex, stream: 'stdout' });
  }

  _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<FFBrowser> {
    return FFBrowser.connect(transport, options);
  }

  _rewriteStartupError(error: Error, prefix: string): Error {
    return error;
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return os.platform() === 'linux' ? {
      ...env,
      // On linux Juggler ships the libstdc++ it was linked against.
      LD_LIBRARY_PATH: `${path.dirname(executable)}:${process.env.LD_LIBRARY_PATH}`,
    } : env;
  }

  _amendArguments(browserArguments: string[]): string[] {
    return browserArguments;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message = { method: 'Browser.close', params: {}, id: kBrowserCloseMessageId };
    transport.send(message);
  }

  _startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer {
    return startWebSocketServer(transport, logger, port);
  }

  _defaultArgs(options: LaunchNonPersistentOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], proxy, devtools, headless } = options;
    if (devtools)
      console.warn('devtools parameter is not supported as a launch argument in Firefox. You can launch the devtools window manually.');
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying -profile argument');
    if (args.find(arg => arg.startsWith('-juggler')))
      throw new Error('Use the port parameter instead of -juggler argument');
    if (proxy) {
      options.firefoxUserPrefs = options.firefoxUserPrefs || {};
      options.firefoxUserPrefs['network.proxy.type'] = 1;
      const proxyServer = new URL(proxy.server);
      const isSocks = proxyServer.protocol === 'socks5:';
      if (isSocks) {
        options.firefoxUserPrefs['network.proxy.socks'] = proxyServer.hostname;
        options.firefoxUserPrefs['network.proxy.socks_port'] = parseInt(proxyServer.port, 10);
      } else {
        options.firefoxUserPrefs['network.proxy.http'] = proxyServer.hostname;
        options.firefoxUserPrefs['network.proxy.http_port'] = parseInt(proxyServer.port, 10);
        options.firefoxUserPrefs['network.proxy.ssl'] = proxyServer.hostname;
        options.firefoxUserPrefs['network.proxy.ssl_port'] = parseInt(proxyServer.port, 10);
      }
      if (proxy.bypass)
        options.firefoxUserPrefs['network.proxy.no_proxies_on'] = proxy.bypass;
    }
    if (options.firefoxUserPrefs) {
      const lines: string[] = [];
      for (const [name, value] of Object.entries(options.firefoxUserPrefs))
        lines.push(`user_pref(${JSON.stringify(name)}, ${JSON.stringify(value)});`);
      fs.writeFileSync(path.join(userDataDir, 'user.js'), lines.join('\n'));
    }
    const firefoxArguments = ['-no-remote'];
    if (headless) {
      firefoxArguments.push('-headless');
    } else {
      firefoxArguments.push('-wait-for-browser');
      firefoxArguments.push('-foreground');
    }
    firefoxArguments.push(`-profile`, userDataDir);
    firefoxArguments.push('-juggler', '0');
    firefoxArguments.push(...args);
    if (isPersistent)
      firefoxArguments.push('about:blank');
    else
      firefoxArguments.push('-silent');
    return firefoxArguments;
  }
}

type SessionData = {
 socket: ws,
};

function startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer {
  const pendingBrowserContextCreations = new Set<number>();
  const pendingBrowserContextDeletions = new Map<number, string>();
  const browserContextIds = new Map<string, ws>();
  const sessionToData = new Map<string, SessionData>();

  function removeSession(sessionId: string): SessionData | undefined {
    const data = sessionToData.get(sessionId);
    if (!data)
      return;
    sessionToData.delete(sessionId);
    return data;
  }

  const server = new WebSocketServer(transport, logger, port, {
    onBrowserResponse(seqNum: number, source: ws, message: ProtocolResponse) {
      // Process command response.
      if (source.readyState === ws.CLOSING || source.readyState === ws.CLOSED) {
        if (pendingBrowserContextCreations.has(seqNum))
          server.sendMessageToBrowserOneWay('Browser.removeBrowserContext', { browserContextId: message.result.browserContextId });
        return;
      }

      if (pendingBrowserContextCreations.has(seqNum)) {
        // Browser.createBrowserContext response -> establish context attribution.
        browserContextIds.set(message.result.browserContextId, source);
        pendingBrowserContextCreations.delete(seqNum);
      }

      const deletedContextId = pendingBrowserContextDeletions.get(seqNum);
      if (deletedContextId) {
        // Browser.removeBrowserContext response -> remove context attribution.
        browserContextIds.delete(deletedContextId);
        pendingBrowserContextDeletions.delete(seqNum);
      }

      source.send(JSON.stringify(message));
      return;
    },

    onBrowserNotification(message: ProtocolResponse) {
      // Process notification response.
      const { method, params, sessionId } = message;
      if (sessionId) {
        const data = sessionToData.get(sessionId);
        if (!data || data.socket.readyState === ws.CLOSING) {
          // Drop unattributed messages on the floor.
          return;
        }
        data.socket.send(JSON.stringify(message));
        return;
      }
      if (method === 'Browser.attachedToTarget') {
        const socket = browserContextIds.get(params.targetInfo.browserContextId);
        if (!socket || socket.readyState === ws.CLOSING) {
          // Drop unattributed messages on the floor.
          return;
        }
        sessionToData.set(params.sessionId, { socket });
        socket.send(JSON.stringify(message));
        return;
      }
      if (method === 'Browser.detachedFromTarget') {
        const data = removeSession(params.sessionId);
        if (data && data.socket.readyState !== ws.CLOSING)
          data.socket.send(JSON.stringify(message));
        return;
      }
    },

    onClientAttached() {},

    onClientRequest(socket: ws, message: ProtocolRequest) {
      const { method, params } = message;
      const seqNum = server.sendMessageToBrowser(message, socket);
      if (method === 'Browser.createBrowserContext')
        pendingBrowserContextCreations.add(seqNum);
      if (method === 'Browser.removeBrowserContext')
        pendingBrowserContextDeletions.set(seqNum, params.browserContextId);
    },

    onClientDetached(socket: ws) {
      for (const [browserContextId, s] of browserContextIds) {
        if (s === socket) {
          server.sendMessageToBrowserOneWay('Browser.removeBrowserContext', { browserContextId });
          browserContextIds.delete(browserContextId);
        }
      }
    }
  });
  return server;
}

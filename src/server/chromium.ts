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

import * as path from 'path';
import { assert, getFromENV, logPolitely, helper } from '../helper';
import { CRBrowser } from '../chromium/crBrowser';
import * as ws from 'ws';
import { Env } from './processLauncher';
import { kBrowserCloseMessageId } from '../chromium/crConnection';
import { BrowserTypeBase } from './browserType';
import { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import { Logger } from '../logger';
import { BrowserDescriptor } from '../install/browserPaths';
import { CRDevTools } from '../chromium/crDevTools';
import { BrowserOptions } from '../browser';
import { WebSocketServer } from './webSocketServer';
import { LaunchOptionsBase } from '../types';

export class Chromium extends BrowserTypeBase {
  private _devtools: CRDevTools | undefined;
  private _debugPort: number | undefined;

  constructor(packagePath: string, browser: BrowserDescriptor) {
    const debugPortStr = getFromENV('PLAYWRIGHT_CHROMIUM_DEBUG_PORT');
    const debugPort: number | undefined = debugPortStr ? +debugPortStr : undefined;
    if (debugPort !== undefined) {
      if (Number.isNaN(debugPort))
        throw new Error(`PLAYWRIGHT_CHROMIUM_DEBUG_PORT must be a number, but is set to "${debugPortStr}"`);
      logPolitely(`NOTE: Chromium will be launched in debug mode on port ${debugPort}`);
    }

    super(packagePath, browser, debugPort ? { webSocketRegex: /^DevTools listening on (ws:\/\/.*)$/, stream: 'stderr' } : null);
    this._debugPort = debugPort;
    if (helper.isDebugMode())
      this._devtools = this._createDevTools();
  }

  private _createDevTools() {
    return new CRDevTools(path.join(this._browserPath, 'devtools-preferences.json'));
  }

  async _connectToTransport(transport: ConnectionTransport, options: BrowserOptions): Promise<CRBrowser> {
    let devtools = this._devtools;
    if ((options as any).__testHookForDevTools) {
      devtools = this._createDevTools();
      await (options as any).__testHookForDevTools(devtools);
    }
    return CRBrowser.connect(transport, options, devtools);
  }

  _amendEnvironment(env: Env, userDataDir: string, executable: string, browserArguments: string[]): Env {
    return env;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
    transport.send(message);
  }

  _startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer {
    return startWebSocketServer(transport, logger, port);
  }

  _defaultArgs(options: LaunchOptionsBase, isPersistent: boolean, userDataDir: string): string[] {
    const { args = [], proxy } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...DEFAULT_ARGS];
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    if (this._debugPort !== undefined)
      chromeArguments.push('--remote-debugging-port=' + this._debugPort);
    else
      chromeArguments.push('--remote-debugging-pipe');
    if (options.devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (options.headless) {
      chromeArguments.push(
          '--headless',
          '--hide-scrollbars',
          '--mute-audio'
      );
    }
    if (proxy) {
      const proxyURL = new URL(proxy.server);
      const isSocks = proxyURL.protocol === 'socks5:';
      // https://www.chromium.org/developers/design-documents/network-settings
      if (isSocks) {
        // https://www.chromium.org/developers/design-documents/network-stack/socks-proxy
        chromeArguments.push(`--host-resolver-rules="MAP * ~NOTFOUND , EXCLUDE ${proxyURL.hostname}"`);
      }
      chromeArguments.push(`--proxy-server=${proxy.server}`);
      if (proxy.bypass) {
        const patterns = proxy.bypass.split(',').map(t => t.trim()).map(t => t.startsWith('.') ? '*' + t : t);
        chromeArguments.push(`--proxy-bypass-list=${patterns.join(';')}`);
      }
    }
    chromeArguments.push(...args);
    if (isPersistent)
      chromeArguments.push('about:blank');
    else
      chromeArguments.push('--no-startup-window');
    return chromeArguments;
  }
}

type SessionData = {
  socket: ws,
  children: Set<string>,
  isBrowserSession: boolean,
  parent?: string,
};

function startWebSocketServer(transport: ConnectionTransport, logger: Logger, port: number): WebSocketServer {
  const awaitingBrowserTarget = new Map<number, ws>();
  const sessionToData = new Map<string, SessionData>();
  const socketToBrowserSession = new Map<ws, { sessionId?: string, queue?: ProtocolRequest[] }>();

  function addSession(sessionId: string, socket: ws, parentSessionId?: string) {
    sessionToData.set(sessionId, {
      socket,
      children: new Set(),
      isBrowserSession: !parentSessionId,
      parent: parentSessionId,
    });
    if (parentSessionId)
      sessionToData.get(parentSessionId)!.children.add(sessionId);
  }

  function removeSession(sessionId: string) {
    const data = sessionToData.get(sessionId)!;
    for (const child of data.children)
      removeSession(child);
    if (data.parent)
      sessionToData.get(data.parent)!.children.delete(sessionId);
    sessionToData.delete(sessionId);
  }

  const server = new WebSocketServer(transport, logger, port, {
    onBrowserResponse(seqNum: number, source: ws, message: ProtocolResponse) {
      if (awaitingBrowserTarget.has(seqNum)) {
        const freshSocket = awaitingBrowserTarget.get(seqNum)!;
        awaitingBrowserTarget.delete(seqNum);

        const sessionId = message.result.sessionId;
        if (freshSocket.readyState !== ws.CLOSED && freshSocket.readyState !== ws.CLOSING) {
          const { queue } = socketToBrowserSession.get(freshSocket)!;
          for (const item of queue!) {
            item.sessionId = sessionId;
            server.sendMessageToBrowser(item, source);
          }
          socketToBrowserSession.set(freshSocket, { sessionId });
          addSession(sessionId, freshSocket);
        } else {
          server.sendMessageToBrowserOneWay('Target.detachFromTarget', { sessionId });
          socketToBrowserSession.delete(freshSocket);
        }
        return;
      }

      if (message.id === -1)
        return;

      // At this point everything we care about has sessionId.
      if (!message.sessionId)
        return;

      const data = sessionToData.get(message.sessionId);
      if (data && data.socket.readyState !== ws.CLOSING) {
        if (data.isBrowserSession)
          delete message.sessionId;
        data.socket.send(JSON.stringify(message));
      }
    },

    onBrowserNotification(message: ProtocolResponse) {
      // At this point everything we care about has sessionId.
      if (!message.sessionId)
        return;

      const data = sessionToData.get(message.sessionId);
      if (data && data.socket.readyState !== ws.CLOSING) {
        if (message.method === 'Target.attachedToTarget')
          addSession(message.params.sessionId, data.socket, message.sessionId);
        if (message.method === 'Target.detachedFromTarget')
          removeSession(message.params.sessionId);
        // Strip session ids from the browser sessions.
        if (data.isBrowserSession)
          delete message.sessionId;
        data.socket.send(JSON.stringify(message));
      }
    },

    onClientAttached(socket: ws) {
      socketToBrowserSession.set(socket, { queue: [] });

      const seqNum = server.sendMessageToBrowser({
        id: -1, // Proxy-initiated request.
        method: 'Target.attachToBrowserTarget',
        params: {}
      }, socket);
      awaitingBrowserTarget.set(seqNum, socket);
    },

    onClientRequest(socket: ws, message: ProtocolRequest) {
      // If message has sessionId, pass through.
      if (message.sessionId) {
        server.sendMessageToBrowser(message, socket);
        return;
      }

      // If message has no sessionId, look it up.
      const session = socketToBrowserSession.get(socket)!;
      if (session.sessionId) {
        // We have it, use it.
        message.sessionId = session.sessionId;
        server.sendMessageToBrowser(message, socket);
        return;
      }
      // Pending session id, queue the message.
      session.queue!.push(message);
    },

    onClientDetached(socket: ws) {
      const session = socketToBrowserSession.get(socket);
      if (!session || !session.sessionId)
        return;
      removeSession(session.sessionId);
      socketToBrowserSession.delete(socket);
      server.sendMessageToBrowserOneWay('Target.detachFromTarget', { sessionId: session.sessionId });
    }
  });
  return server;
}


const DEFAULT_ARGS = [
  '--disable-background-networking',
  '--enable-features=NetworkService,NetworkServiceInProcess',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  // BlinkGenPropertyTrees disabled due to crbug.com/937609
  '--disable-features=TranslateUI,BlinkGenPropertyTrees,ImprovedCookieControls,SameSiteByDefaultCookies',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-sync',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--no-sandbox',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
];

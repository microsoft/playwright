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
import { helper, assert, isDebugMode } from '../helper';
import { CRBrowser } from '../chromium/crBrowser';
import * as ws from 'ws';
import { Env } from './processLauncher';
import { kBrowserCloseMessageId } from '../chromium/crConnection';
import { BrowserArgOptions, BrowserTypeBase, processBrowserArgOptions } from './browserType';
import { WebSocketWrapper } from './browserServer';
import { ConnectionTransport, ProtocolRequest } from '../transport';
import { InnerLogger, logError } from '../logger';
import { BrowserDescriptor } from '../install/browserPaths';
import { CRDevTools } from '../chromium/crDevTools';
import { BrowserOptions } from '../browser';

export class Chromium extends BrowserTypeBase {
  private _devtools: CRDevTools | undefined;

  constructor(packagePath: string, browser: BrowserDescriptor) {
    super(packagePath, browser, null /* use pipe not websocket */);
    if (isDebugMode())
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
    const runningAsRoot = process.geteuid && process.geteuid() === 0;
    assert(!runningAsRoot || browserArguments.includes('--no-sandbox'), 'Cannot launch Chromium as root without --no-sandbox. See https://crbug.com/638180.');
    return env;
  }

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
    transport.send(message);
  }

  _wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper {
    return wrapTransportWithWebSocket(transport, logger, port);
  }

  _defaultArgs(options: BrowserArgOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { devtools, headless } = processBrowserArgOptions(options);
    const { args = [] } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const chromeArguments = [...DEFAULT_ARGS];
    chromeArguments.push(`--user-data-dir=${userDataDir}`);
    chromeArguments.push('--remote-debugging-pipe');
    if (devtools)
      chromeArguments.push('--auto-open-devtools-for-tabs');
    if (headless) {
      chromeArguments.push(
          '--headless',
          '--hide-scrollbars',
          '--mute-audio'
      );
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

function wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper {
  const server = new ws.Server({ port });
  const guid = helper.guid();

  const awaitingBrowserTarget = new Map<number, ws>();
  const sessionToData = new Map<string, SessionData>();
  const socketToBrowserSession = new Map<ws, { sessionId?: string, queue?: ProtocolRequest[] }>();
  let lastSequenceNumber = 1;

  function addSession(sessionId: string, socket: ws, parentSessionId?: string) {
    sessionToData.set(sessionId, {
      socket,
      children: new Set(),
      isBrowserSession: !parentSessionId,
      parent: parentSessionId
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

  transport.onmessage = message => {
    if (typeof message.id === 'number' && awaitingBrowserTarget.has(message.id)) {
      const freshSocket = awaitingBrowserTarget.get(message.id)!;
      awaitingBrowserTarget.delete(message.id);

      const sessionId = message.result.sessionId;
      if (freshSocket.readyState !== ws.CLOSED && freshSocket.readyState !== ws.CLOSING) {
        const { queue } = socketToBrowserSession.get(freshSocket)!;
        for (const item of queue!) {
          item.sessionId = sessionId;
          transport.send(item);
        }
        socketToBrowserSession.set(freshSocket, { sessionId });
        addSession(sessionId, freshSocket);
      } else {
        transport.send({
          id: ++lastSequenceNumber,
          method: 'Target.detachFromTarget',
          params: { sessionId }
        });
        socketToBrowserSession.delete(freshSocket);
      }
      return;
    }

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
  };

  transport.onclose = () => {
    for (const socket of socketToBrowserSession.keys()) {
      socket.removeListener('close', (socket as any).__closeListener);
      socket.close(undefined, 'Browser disconnected');
    }
    server.close();
    transport.onmessage = undefined;
    transport.onclose = undefined;
  };

  server.on('connection', (socket: ws, req) => {
    if (req.url !== '/' + guid) {
      socket.close();
      return;
    }
    socketToBrowserSession.set(socket, { queue: [] });

    transport.send({
      id: ++lastSequenceNumber,
      method: 'Target.attachToBrowserTarget',
      params: {}
    });
    awaitingBrowserTarget.set(lastSequenceNumber, socket);

    socket.on('message', (message: string) => {
      const parsedMessage = JSON.parse(Buffer.from(message).toString()) as ProtocolRequest;
      // If message has sessionId, pass through.
      if (parsedMessage.sessionId) {
        transport.send(parsedMessage);
        return;
      }

      // If message has no sessionId, look it up.
      const session = socketToBrowserSession.get(socket)!;
      if (session.sessionId) {
        // We have it, use it.
        parsedMessage.sessionId = session.sessionId;
        transport.send(parsedMessage);
        return;
      }
      // Pending session id, queue the message.
      session.queue!.push(parsedMessage);
    });

    socket.on('error', logError(logger));

    socket.on('close', (socket as any).__closeListener = () => {
      const session = socketToBrowserSession.get(socket);
      if (!session || !session.sessionId)
        return;
      removeSession(session.sessionId);
      socketToBrowserSession.delete(socket);
      transport.send({
        id: ++lastSequenceNumber,
        method: 'Target.detachFromTarget',
        params: { sessionId: session.sessionId }
      });
    });
  });

  const address = server.address();
  const wsEndpoint = typeof address === 'string' ? `${address}/${guid}` : `ws://127.0.0.1:${address.port}/${guid}`;
  return new WebSocketWrapper(wsEndpoint, [awaitingBrowserTarget, sessionToData, socketToBrowserSession]);
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
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
];

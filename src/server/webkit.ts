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
import { helper } from '../helper';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';
import { BrowserArgOptions, BrowserTypeBase, processBrowserArgOptions } from './browserType';
import { ConnectionTransport, SequenceNumberMixer } from '../transport';
import * as ws from 'ws';
import { WebSocketWrapper } from './browserServer';
import { InnerLogger, logError } from '../logger';
import { BrowserOptions } from '../browser';
import { BrowserDescriptor } from '../install/browserPaths';

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

  _attemptToGracefullyCloseBrowser(transport: ConnectionTransport): void {
    transport.send({method: 'Playwright.close', params: {}, id: kBrowserCloseMessageId});
  }

  _wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper {
    return wrapTransportWithWebSocket(transport, logger, port);
  }

  _defaultArgs(options: BrowserArgOptions, isPersistent: boolean, userDataDir: string): string[] {
    const { devtools, headless } = processBrowserArgOptions(options);
    const { args = [], proxy } = options;
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
      let proxyURL = new URL(proxy.server);
      if (!['http:', 'https:', 'socks5:'].includes(proxyURL.protocol))
        proxyURL = new URL('all://' + proxy.server);
      if (process.platform === 'darwin') {
        if (proxyURL.protocol === 'socks5:') {
          webkitArguments.push(`--proxy-socks=${proxyURL.href}`);
        } else {
          webkitArguments.push(`--proxy-http=http://${proxyURL.host}`);
          webkitArguments.push(`--proxy-https=https://${proxyURL.host}`);
        }
      } else if (process.platform === 'linux') {
        if (proxyURL.protocol === 'socks5:')
          webkitArguments.push(`--proxy=${proxyURL.href}`);
        else
          webkitArguments.push(`--proxy=${proxyURL.host}`);
        if (proxy.bypass)
          webkitArguments.push(...proxy.bypass.split(',').map(t => `--ignore-host=${t.trim()}`));
      }
    }
    webkitArguments.push(...args);
    if (isPersistent)
      webkitArguments.push('about:blank');
    return webkitArguments;
  }
}

function wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper {
  const server = new ws.Server({ port });
  const guid = helper.guid();
  const idMixer = new SequenceNumberMixer<{id: number, socket: ws}>();
  const pendingBrowserContextCreations = new Set<number>();
  const pendingBrowserContextDeletions = new Map<number, string>();
  const browserContextIds = new Map<string, ws>();
  const pageProxyIds = new Map<string, ws>();
  const sockets = new Set<ws>();

  transport.onmessage = message => {
    if (typeof message.id === 'number') {
      if (message.id === -9999)
        return;
      // Process command response.
      const value = idMixer.take(message.id);
      if (!value)
        return;
      const { id, socket } = value;

      if (socket.readyState === ws.CLOSING) {
        if (pendingBrowserContextCreations.has(id)) {
          transport.send({
            id: ++SequenceNumberMixer._lastSequenceNumber,
            method: 'Playwright.deleteContext',
            params: { browserContextId: message.result.browserContextId }
          });
        }
        return;
      }

      if (pendingBrowserContextCreations.has(message.id)) {
        // Browser.createContext response -> establish context attribution.
        browserContextIds.set(message.result.browserContextId, socket);
        pendingBrowserContextCreations.delete(message.id);
      }

      const deletedContextId = pendingBrowserContextDeletions.get(message.id);
      if (deletedContextId) {
        // Browser.deleteContext response -> remove context attribution.
        browserContextIds.delete(deletedContextId);
        pendingBrowserContextDeletions.delete(message.id);
      }

      message.id = id;
      socket.send(JSON.stringify(message));
      return;
    }

    // Process notification response.
    const { method, params, pageProxyId } = message;
    if (pageProxyId) {
      const socket = pageProxyIds.get(pageProxyId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      socket.send(JSON.stringify(message));
      return;
    }
    if (method === 'Playwright.pageProxyCreated') {
      const socket = browserContextIds.get(params.pageProxyInfo.browserContextId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      pageProxyIds.set(params.pageProxyInfo.pageProxyId, socket);
      socket.send(JSON.stringify(message));
      return;
    }
    if (method === 'Playwright.pageProxyDestroyed') {
      const socket = pageProxyIds.get(params.pageProxyId);
      pageProxyIds.delete(params.pageProxyId);
      if (socket && socket.readyState !== ws.CLOSING)
        socket.send(JSON.stringify(message));
      return;
    }
    if (method === 'Playwright.provisionalLoadFailed') {
      const socket = pageProxyIds.get(params.pageProxyId);
      if (socket && socket.readyState !== ws.CLOSING)
        socket.send(JSON.stringify(message));
      return;
    }
  };

  transport.onclose = () => {
    for (const socket of sockets) {
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
    sockets.add(socket);

    socket.on('message', (message: string) => {
      const parsedMessage = JSON.parse(Buffer.from(message).toString());
      const { id, method, params } = parsedMessage;
      const seqNum = idMixer.generate({ id, socket });
      transport.send({ ...parsedMessage, id: seqNum });
      if (method === 'Playwright.createContext')
        pendingBrowserContextCreations.add(seqNum);
      if (method === 'Playwright.deleteContext')
        pendingBrowserContextDeletions.set(seqNum, params.browserContextId);
    });

    socket.on('error', logError(logger));

    socket.on('close', (socket as any).__closeListener = () => {
      for (const [pageProxyId, s] of pageProxyIds) {
        if (s === socket)
          pageProxyIds.delete(pageProxyId);
      }
      for (const [browserContextId, s] of browserContextIds) {
        if (s === socket) {
          transport.send({
            id: ++SequenceNumberMixer._lastSequenceNumber,
            method: 'Playwright.deleteContext',
            params: { browserContextId }
          });
          browserContextIds.delete(browserContextId);
        }
      }
      sockets.delete(socket);
    });
  });

  const address = server.address();
  const wsEndpoint = typeof address === 'string' ? `${address}/${guid}` : `ws://127.0.0.1:${address.port}/${guid}`;

  return new WebSocketWrapper(wsEndpoint,
      [pendingBrowserContextCreations, pendingBrowserContextDeletions, browserContextIds, pageProxyIds, sockets]);
}

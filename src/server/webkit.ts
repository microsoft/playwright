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
import { PipeTransport } from './pipeTransport';
import { launchProcess } from './processLauncher';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as util from 'util';
import { helper, assert } from '../helper';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';
import { LaunchOptions, BrowserArgOptions, LaunchServerOptions, ConnectOptions, AbstractBrowserType } from './browserType';
import { ConnectionTransport, SequenceNumberMixer, WebSocketTransport } from '../transport';
import * as ws from 'ws';
import { LaunchType } from '../browser';
import { BrowserServer, WebSocketWrapper } from './browserServer';
import { Events } from '../events';
import { BrowserContext } from '../browserContext';
import { InnerLogger, logError, RootLogger } from '../logger';
import { BrowserDescriptor } from '../install/browserPaths';

export class WebKit extends AbstractBrowserType<WKBrowser> {
  constructor(packagePath: string, browser: BrowserDescriptor) {
    super(packagePath, browser);
  }

  async launch(options: LaunchOptions = {}): Promise<WKBrowser> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    const { browserServer, transport, downloadsPath, logger } = await this._launchServer(options, 'local');
    const browser = await WKBrowser.connect(transport!, logger,  options.slowMo, false);
    browser._ownedServer = browserServer;
    browser._downloadsPath = downloadsPath;
    return browser;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    return (await this._launchServer(options, 'server')).browserServer;
  }

  async launchPersistentContext(userDataDir: string, options: LaunchOptions = {}): Promise<BrowserContext> {
    const {
      timeout = 30000,
      slowMo = 0,
    } = options;
    const { transport, browserServer, logger } = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await WKBrowser.connect(transport!, logger, slowMo, true);
    browser._ownedServer = browserServer;
    await helper.waitWithTimeout(browser._waitForFirstPageTarget(), 'first page', timeout);
    return browser._defaultContext!;
  }

  private async _launchServer(options: LaunchServerOptions, launchType: LaunchType, userDataDir?: string): Promise<{ browserServer: BrowserServer, transport?: ConnectionTransport, downloadsPath: string, logger: InnerLogger }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      port = 0,
    } = options;
    assert(!port || launchType === 'server', 'Cannot specify a port without launching as a server.');
    const logger = new RootLogger(options.logger);

    let temporaryUserDataDir: string | null = null;
    if (!userDataDir) {
      userDataDir = await mkdtempAsync(WEBKIT_PROFILE_PATH);
      temporaryUserDataDir = userDataDir;
    }

    const webkitArguments = [];
    if (!ignoreDefaultArgs)
      webkitArguments.push(...this._defaultArgs(options, launchType, userDataDir, port));
    else if (Array.isArray(ignoreDefaultArgs))
      webkitArguments.push(...this._defaultArgs(options, launchType, userDataDir, port).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      webkitArguments.push(...args);

    const webkitExecutable = executablePath || this.executablePath();
    if (!webkitExecutable)
      throw new Error(`No executable path is specified.`);

    const { launchedProcess, gracefullyClose, downloadsPath } = await launchProcess({
      executablePath: webkitExecutable,
      args: webkitArguments,
      env: { ...env, CURL_COOKIE_JAR_PATH: path.join(userDataDir, 'cookiejar.db') },
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      logger,
      pipe: true,
      tempDir: temporaryUserDataDir || undefined,
      attemptToGracefullyClose: async () => {
        assert(transport);
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        await transport.send({method: 'Playwright.close', params: {}, id: kBrowserCloseMessageId});
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    // For local launch scenario close will terminate the browser process.
    let transport: ConnectionTransport | undefined = undefined;
    let browserServer: BrowserServer | undefined = undefined;
    const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
    transport = new PipeTransport(stdio[3], stdio[4], logger);
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, launchType === 'server' ? wrapTransportWithWebSocket(transport, logger, port || 0) : null);
    return { browserServer, transport, downloadsPath, logger };
  }

  async connect(options: ConnectOptions): Promise<WKBrowser> {
    return await WebSocketTransport.connect(options.wsEndpoint, transport => {
      return WKBrowser.connect(transport, new RootLogger(options.logger), options.slowMo);
    });
  }

  _defaultArgs(options: BrowserArgOptions = {}, launchType: LaunchType, userDataDir: string, port: number): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
    } = options;
    if (devtools)
      console.warn('devtools parameter as a launch argument in WebKit is not supported. Also starting Web Inspector manually will terminate the execution in WebKit.');
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir='));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (launchType !== 'persistent' && args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');
    const webkitArguments = ['--inspector-pipe'];
    if (headless)
      webkitArguments.push('--headless');
    if (launchType === 'persistent')
      webkitArguments.push(`--user-data-dir=${userDataDir}`);
    else
      webkitArguments.push(`--no-startup-window`);
    webkitArguments.push(...args);
    return webkitArguments;
  }
}

const mkdtempAsync = util.promisify(fs.mkdtemp);

const WEBKIT_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_dev_profile-');

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

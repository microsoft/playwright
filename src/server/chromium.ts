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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import { helper, assert } from '../helper';
import { CRBrowser } from '../chromium/crBrowser';
import * as ws from 'ws';
import { launchProcess } from './processLauncher';
import { kBrowserCloseMessageId } from '../chromium/crConnection';
import { PipeTransport } from './pipeTransport';
import { LaunchOptions, BrowserArgOptions, ConnectOptions, LaunchServerOptions, AbstractBrowserType } from './browserType';
import { LaunchType } from '../browser';
import { BrowserServer, WebSocketWrapper } from './browserServer';
import { Events } from '../events';
import { ConnectionTransport, ProtocolRequest, WebSocketTransport } from '../transport';
import { BrowserContext } from '../browserContext';
import { InnerLogger, logError, RootLogger } from '../logger';
import { BrowserDescriptor } from '../install/browserPaths';

export class Chromium extends AbstractBrowserType<CRBrowser> {
  constructor(packagePath: string, browser: BrowserDescriptor) {
    super(packagePath, browser);
  }

  async launch(options: LaunchOptions = {}): Promise<CRBrowser> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    const { browserServer, transport, downloadsPath, logger } = await this._launchServer(options, 'local');
    const browser = await CRBrowser.connect(transport!, false, logger, options);
    browser._ownedServer = browserServer;
    browser._downloadsPath = downloadsPath;
    return browser;
  }

  async launchServer(options: LaunchServerOptions = {}): Promise<BrowserServer> {
    return (await this._launchServer(options, 'server')).browserServer;
  }

  async launchPersistentContext(userDataDir: string, options: LaunchOptions = {}): Promise<BrowserContext> {
    const { transport, browserServer, logger } = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await CRBrowser.connect(transport!, true, logger, options);
    browser._ownedServer = browserServer;
    await helper.waitWithTimeout(browser._firstPagePromise, 'first page', options.timeout || 30000);
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
      userDataDir = await mkdtempAsync(CHROMIUM_PROFILE_PATH);
      temporaryUserDataDir = userDataDir;
    }

    const chromeArguments = [];
    if (!ignoreDefaultArgs)
      chromeArguments.push(...this._defaultArgs(options, launchType, userDataDir));
    else if (Array.isArray(ignoreDefaultArgs))
      chromeArguments.push(...this._defaultArgs(options, launchType, userDataDir).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      chromeArguments.push(...args);

    const chromeExecutable = executablePath || this.executablePath();
    if (!chromeExecutable)
      throw new Error(`No executable path is specified. Pass "executablePath" option directly.`);
    const { launchedProcess, gracefullyClose, downloadsPath } = await launchProcess({
      executablePath: chromeExecutable,
      args: chromeArguments,
      env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      logger,
      pipe: true,
      tempDir: temporaryUserDataDir || undefined,
      attemptToGracefullyClose: async () => {
        assert(browserServer);
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const t = transport!;
        const message: ProtocolRequest = { method: 'Browser.close', id: kBrowserCloseMessageId, params: {} };
        t.send(message);
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    let transport: PipeTransport | undefined = undefined;
    let browserServer: BrowserServer | undefined = undefined;
    const stdio = launchedProcess.stdio as unknown as [NodeJS.ReadableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.WritableStream, NodeJS.ReadableStream];
    transport = new PipeTransport(stdio[3], stdio[4], logger);
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, launchType === 'server' ? wrapTransportWithWebSocket(transport, logger, port) : null);
    return { browserServer, transport, downloadsPath, logger };
  }

  async connect(options: ConnectOptions): Promise<CRBrowser> {
    return await WebSocketTransport.connect(options.wsEndpoint, transport => {
      return CRBrowser.connect(transport, false, new RootLogger(options.logger), options);
    });
  }

  private _defaultArgs(options: BrowserArgOptions = {}, launchType: LaunchType, userDataDir: string): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
    } = options;
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    if (args.find(arg => arg.startsWith('--remote-debugging-pipe')))
      throw new Error('Playwright manages remote debugging connection itself.');
    if (launchType !== 'persistent' && args.find(arg => !arg.startsWith('-')))
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
    if (launchType === 'persistent') {
      if (args.every(arg => arg.startsWith('-')))
        chromeArguments.push('about:blank');
    } else {
      chromeArguments.push('--no-startup-window');
    }

    return chromeArguments;
  }
}

function wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper {
  const server = new ws.Server({ port });
  const guid = helper.guid();

  const awaitingBrowserTarget = new Map<number, ws>();
  const sessionToSocket = new Map<string, ws>();
  const socketToBrowserSession = new Map<ws, { sessionId?: string, queue?: ProtocolRequest[] }>();
  const browserSessions = new Set<string>();
  let lastSequenceNumber = 1;

  transport.onmessage = message => {
    if (typeof message.id === 'number' && awaitingBrowserTarget.has(message.id)) {
      const freshSocket = awaitingBrowserTarget.get(message.id)!;
      awaitingBrowserTarget.delete(message.id);

      const sessionId = message.result.sessionId;
      if (freshSocket.readyState !== ws.CLOSED && freshSocket.readyState !== ws.CLOSING) {
        sessionToSocket.set(sessionId, freshSocket);
        const { queue } = socketToBrowserSession.get(freshSocket)!;
        for (const item of queue!) {
          item.sessionId = sessionId;
          transport.send(item);
        }
        socketToBrowserSession.set(freshSocket, { sessionId });
        browserSessions.add(sessionId);
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

    const socket = sessionToSocket.get(message.sessionId);
    if (socket && socket.readyState !== ws.CLOSING) {
      if (message.method === 'Target.attachedToTarget')
        sessionToSocket.set(message.params.sessionId, socket);
      if (message.method === 'Target.detachedFromTarget')
        sessionToSocket.delete(message.params.sessionId);
      // Strip session ids from the browser sessions.
      if (browserSessions.has(message.sessionId))
        delete message.sessionId;
      socket.send(JSON.stringify(message));
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
      sessionToSocket.delete(session.sessionId);
      browserSessions.delete(session.sessionId);
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
  return new WebSocketWrapper(wsEndpoint, [awaitingBrowserTarget, sessionToSocket, socketToBrowserSession, browserSessions]);
}


const mkdtempAsync = util.promisify(fs.mkdtemp);

const CHROMIUM_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_dev_profile-');

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
  '--disable-features=TranslateUI,BlinkGenPropertyTrees',
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

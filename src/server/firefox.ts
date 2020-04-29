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
import * as ws from 'ws';
import { LaunchType } from '../browser';
import { BrowserContext } from '../browserContext';
import { TimeoutError } from '../errors';
import { Events } from '../events';
import { FFBrowser } from '../firefox/ffBrowser';
import { kBrowserCloseMessageId } from '../firefox/ffConnection';
import { helper, assert } from '../helper';
import { BrowserServer, WebSocketWrapper } from './browserServer';
import { BrowserArgOptions, LaunchOptions, LaunchServerOptions, ConnectOptions, AbstractBrowserType } from './browserType';
import { launchProcess, waitForLine } from './processLauncher';
import { ConnectionTransport, SequenceNumberMixer, WebSocketTransport } from '../transport';
import { RootLogger, InnerLogger, logError } from '../logger';
import { BrowserDescriptor } from '../install/browserPaths';

const mkdtempAsync = util.promisify(fs.mkdtemp);

export class Firefox extends AbstractBrowserType<FFBrowser> {
  constructor(packagePath: string, browser: BrowserDescriptor) {
    super(packagePath, browser);
  }

  async launch(options: LaunchOptions = {}): Promise<FFBrowser> {
    assert(!(options as any).userDataDir, 'userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    const { browserServer, downloadsPath, logger } = await this._launchServer(options, 'local');
    const browser = await WebSocketTransport.connect(browserServer.wsEndpoint()!, transport => {
      return FFBrowser.connect(transport, logger, false, options.slowMo);
    });
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
    const { browserServer, downloadsPath, logger } = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await WebSocketTransport.connect(browserServer.wsEndpoint()!, transport => {
      return FFBrowser.connect(transport, logger, true, slowMo);
    });
    browser._ownedServer = browserServer;
    browser._downloadsPath = downloadsPath;
    await helper.waitWithTimeout(browser._firstPagePromise, 'first page', timeout);
    const browserContext = browser._defaultContext!;
    return browserContext;
  }

  private async _launchServer(options: LaunchServerOptions, launchType: LaunchType, userDataDir?: string): Promise<{ browserServer: BrowserServer, downloadsPath: string, logger: InnerLogger }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      executablePath = null,
      env = process.env,
      handleSIGHUP = true,
      handleSIGINT = true,
      handleSIGTERM = true,
      timeout = 30000,
      port = 0,
    } = options;
    assert(!port || launchType === 'server', 'Cannot specify a port without launching as a server.');
    const logger = new RootLogger(options.logger);

    const firefoxArguments = [];

    let temporaryProfileDir = null;
    if (!userDataDir) {
      userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_firefox_profile-'));
      temporaryProfileDir = userDataDir;
    }

    if (!ignoreDefaultArgs)
      firefoxArguments.push(...this._defaultArgs(options, launchType, userDataDir, 0));
    else if (Array.isArray(ignoreDefaultArgs))
      firefoxArguments.push(...this._defaultArgs(options, launchType, userDataDir, 0).filter(arg => !ignoreDefaultArgs.includes(arg)));
    else
      firefoxArguments.push(...args);

    const firefoxExecutable = executablePath || this.executablePath();
    if (!firefoxExecutable)
      throw new Error(`No executable path is specified. Pass "executablePath" option directly.`);

    const { launchedProcess, gracefullyClose, downloadsPath } = await launchProcess({
      executablePath: firefoxExecutable,
      args: firefoxArguments,
      env: os.platform() === 'linux' ? {
        ...env,
        // On linux Juggler ships the libstdc++ it was linked against.
        LD_LIBRARY_PATH: `${path.dirname(firefoxExecutable)}:${process.env.LD_LIBRARY_PATH}`,
      } : env,
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      logger,
      pipe: false,
      tempDir: temporaryProfileDir || undefined,
      attemptToGracefullyClose: async () => {
        assert(browserServer);
        // We try to gracefully close to prevent crash reporting and core dumps.
        const transport = await WebSocketTransport.connect(browserWSEndpoint!, async transport => transport);
        const message = { method: 'Browser.close', params: {}, id: kBrowserCloseMessageId };
        await transport.send(message);
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to Firefox!`);
    const match = await waitForLine(launchedProcess, launchedProcess.stdout, /^Juggler listening on (ws:\/\/.*)$/, timeout, timeoutError);
    const innerEndpoint = match[1];

    let browserServer: BrowserServer | undefined = undefined;
    let browserWSEndpoint: string | undefined = undefined;
    const webSocketWrapper = launchType === 'server' ? (await WebSocketTransport.connect(innerEndpoint, t => wrapTransportWithWebSocket(t, logger, port))) : new WebSocketWrapper(innerEndpoint, []);
    browserWSEndpoint = webSocketWrapper.wsEndpoint;
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, webSocketWrapper);
    return { browserServer, downloadsPath, logger };
  }

  async connect(options: ConnectOptions): Promise<FFBrowser> {
    const logger = new RootLogger(options.logger);
    return await WebSocketTransport.connect(options.wsEndpoint, transport => {
      return FFBrowser.connect(transport, logger, false, options.slowMo);
    });
  }

  private _defaultArgs(options: BrowserArgOptions = {}, launchType: LaunchType, userDataDir: string, port: number): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
    } = options;
    if (devtools)
      console.warn('devtools parameter is not supported as a launch argument in Firefox. You can launch the devtools window manually.');
    const userDataDirArg = args.find(arg => arg.startsWith('-profile') || arg.startsWith('--profile'));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying -profile argument');
    if (args.find(arg => arg.startsWith('-juggler')))
      throw new Error('Use the port parameter instead of -juggler argument');
    if (launchType !== 'persistent' && args.find(arg => !arg.startsWith('-')))
      throw new Error('Arguments can not specify page to be opened');

    const firefoxArguments = ['-no-remote'];
    if (headless) {
      firefoxArguments.push('-headless');
    } else {
      firefoxArguments.push('-wait-for-browser');
      firefoxArguments.push('-foreground');
    }

    firefoxArguments.push(`-profile`, userDataDir);
    firefoxArguments.push('-juggler', String(port));
    firefoxArguments.push(...args);

    if (launchType === 'persistent') {
      if (args.every(arg => arg.startsWith('-')))
        firefoxArguments.push('about:blank');
    } else {
      firefoxArguments.push('-silent');
    }

    return firefoxArguments;
  }
}

function wrapTransportWithWebSocket(transport: ConnectionTransport, logger: InnerLogger, port: number): WebSocketWrapper {
  const server = new ws.Server({ port });
  const guid = helper.guid();
  const idMixer = new SequenceNumberMixer<{id: number, socket: ws}>();
  const pendingBrowserContextCreations = new Set<number>();
  const pendingBrowserContextDeletions = new Map<number, string>();
  const browserContextIds = new Map<string, ws>();
  const sessionToSocket = new Map<string, ws>();
  const sockets = new Set<ws>();

  transport.onmessage = message => {
    if (typeof message.id === 'number') {
      // Process command response.
      const seqNum = message.id;
      const value = idMixer.take(seqNum);
      if (!value)
        return;
      const { id, socket } = value;

      if (socket.readyState === ws.CLOSING) {
        if (pendingBrowserContextCreations.has(id)) {
          transport.send({
            id: ++SequenceNumberMixer._lastSequenceNumber,
            method: 'Browser.removeBrowserContext',
            params: { browserContextId: message.result.browserContextId }
          });
        }
        return;
      }

      if (pendingBrowserContextCreations.has(seqNum)) {
        // Browser.createBrowserContext response -> establish context attribution.
        browserContextIds.set(message.result.browserContextId, socket);
        pendingBrowserContextCreations.delete(seqNum);
      }

      const deletedContextId = pendingBrowserContextDeletions.get(seqNum);
      if (deletedContextId) {
        // Browser.removeBrowserContext response -> remove context attribution.
        browserContextIds.delete(deletedContextId);
        pendingBrowserContextDeletions.delete(seqNum);
      }

      message.id = id;
      socket.send(JSON.stringify(message));
      return;
    }

    // Process notification response.
    const { method, params, sessionId } = message;
    if (sessionId) {
      const socket = sessionToSocket.get(sessionId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      socket.send(JSON.stringify(message));
      return;
    }
    if (method === 'Browser.attachedToTarget') {
      const socket = browserContextIds.get(params.targetInfo.browserContextId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      sessionToSocket.set(params.sessionId, socket);
      socket.send(JSON.stringify(message));
      return;
    }
    if (method === 'Browser.detachedFromTarget') {
      const socket = sessionToSocket.get(params.sessionId);
      sessionToSocket.delete(params.sessionId);
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
      if (method === 'Browser.createBrowserContext')
        pendingBrowserContextCreations.add(seqNum);
      if (method === 'Browser.removeBrowserContext')
        pendingBrowserContextDeletions.set(seqNum, params.browserContextId);
    });

    socket.on('error', logError(logger));

    socket.on('close', (socket as any).__closeListener = () => {
      for (const [browserContextId, s] of browserContextIds) {
        if (s === socket) {
          transport.send({
            id: ++SequenceNumberMixer._lastSequenceNumber,
            method: 'Browser.removeBrowserContext',
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
      [pendingBrowserContextCreations, pendingBrowserContextDeletions, browserContextIds, sessionToSocket, sockets]);
}

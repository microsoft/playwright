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
import * as ws from 'ws';
import { ConnectOptions, LaunchType } from '../browser';
import { BrowserContext } from '../browserContext';
import { TimeoutError } from '../errors';
import { Events } from '../events';
import { FFBrowser } from '../firefox/ffBrowser';
import { kBrowserCloseMessageId } from '../firefox/ffConnection';
import { debugError, helper } from '../helper';
import * as platform from '../platform';
import { BrowserServer } from './browserServer';
import { BrowserArgOptions, BrowserType, LaunchOptions } from './browserType';
import { launchProcess, waitForLine } from './processLauncher';
import { ConnectionTransport, SequenceNumberMixer } from '../transport';

const mkdtempAsync = platform.promisify(fs.mkdtemp);

export class Firefox implements BrowserType<FFBrowser> {
  private _executablePath: (string|undefined);

  executablePath(): string {
    if (!this._executablePath)
      throw new Error('No executable path!');
    return this._executablePath;
  }

  name() {
    return 'firefox';
  }

  async launch(options?: LaunchOptions & { slowMo?: number }): Promise<FFBrowser> {
    if (options && (options as any).userDataDir)
      throw new Error('userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistentContext` instead');
    const browserServer = await this._launchServer(options, 'local');
    const browser = await platform.connectToWebsocket(browserServer.wsEndpoint()!, transport => {
      return FFBrowser.connect(transport, false, options && options.slowMo);
    });
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    browser.close = () => browserServer.close();
    (browser as any)['__server__'] = browserServer;
    return browser;
  }

  async launchServer(options?: LaunchOptions & { port?: number }): Promise<BrowserServer> {
    return await this._launchServer(options, 'server', undefined, options && options.port);
  }

  async launchPersistentContext(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext> {
    const { timeout = 30000 } = options || {};
    const browserServer = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await platform.connectToWebsocket(browserServer.wsEndpoint()!, transport => {
      return FFBrowser.connect(transport, true);
    });
    await helper.waitWithTimeout(browser._firstPagePromise, 'first page', timeout);
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    const browserContext = browser._defaultContext;
    browserContext.close = () => browserServer.close();
    return browserContext;
  }

  private async _launchServer(options: LaunchOptions = {}, launchType: LaunchType, userDataDir?: string, port?: number): Promise<BrowserServer> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGHUP = true,
      handleSIGINT = true,
      handleSIGTERM = true,
      timeout = 30000,
    } = options;

    const firefoxArguments = [];

    let temporaryProfileDir = null;
    if (!userDataDir) {
      userDataDir = await mkdtempAsync(path.join(os.tmpdir(), 'playwright_dev_firefox_profile-'));
      temporaryProfileDir = userDataDir;
    }

    if (!ignoreDefaultArgs)
      firefoxArguments.push(...this._defaultArgs(options, launchType, userDataDir!, 0));
    else if (Array.isArray(ignoreDefaultArgs))
      firefoxArguments.push(...this._defaultArgs(options, launchType, userDataDir!, 0).filter(arg => !ignoreDefaultArgs.includes(arg)));
    else
      firefoxArguments.push(...args);

    const firefoxExecutable = executablePath || this._executablePath;
    if (!firefoxExecutable)
      throw new Error(`No executable path is specified. Pass "executablePath" option directly.`);

    const { launchedProcess, gracefullyClose } = await launchProcess({
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
      dumpio,
      pipe: false,
      tempDir: temporaryProfileDir || undefined,
      attemptToGracefullyClose: async () => {
        if (!browserServer)
          return Promise.reject();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const transport = await platform.connectToWebsocket(browserWSEndpoint, async transport => transport);
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
    const browserWSEndpoint = launchType === 'server' ? (await platform.connectToWebsocket(innerEndpoint, t => wrapTransportWithWebSocket(t, port || 0))) : innerEndpoint;
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, browserWSEndpoint);
    return browserServer;
  }

  async connect(options: ConnectOptions): Promise<FFBrowser> {
    return await platform.connectToWebsocket(options.wsEndpoint, transport => {
      return FFBrowser.connect(transport, false, options.slowMo);
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

    if (args.every(arg => arg.startsWith('-')))
      firefoxArguments.push('about:blank');
    return firefoxArguments;
  }
}

function wrapTransportWithWebSocket(transport: ConnectionTransport, port: number): string {
  const server = new ws.Server({ port });
  const guid = platform.guid();
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

    socket.on('error', error => debugError(error));

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
  if (typeof address === 'string')
    return address + '/' + guid;
  return 'ws://127.0.0.1:' + address.port + '/' + guid;
}


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

import { BrowserFetcher, OnProgressCallback, BrowserFetcherOptions } from './browserFetcher';
import { DeviceDescriptors } from '../deviceDescriptors';
import { TimeoutError } from '../errors';
import * as types from '../types';
import { WKBrowser } from '../webkit/wkBrowser';
import { execSync } from 'child_process';
import { PipeTransport } from './pipeTransport';
import { launchProcess, waitForLine } from './processLauncher';
import * as fs from 'fs';
import * as path from 'path';
import * as platform from '../platform';
import * as util from 'util';
import * as os from 'os';
import { assert, helper } from '../helper';
import { kBrowserCloseMessageId } from '../webkit/wkConnection';
import { LaunchOptions, BrowserArgOptions, BrowserType } from './browserType';
import { ConnectionTransport, DeferWriteTransport } from '../transport';
import * as ws from 'ws';
import * as uuidv4 from 'uuid/v4';
import { ConnectOptions, LaunchType } from '../browser';
import { BrowserServer } from './browserServer';
import { Events } from '../events';
import { BrowserContext } from '../browserContext';

export class WebKit implements BrowserType {
  private _projectRoot: string;
  readonly _revision: string;

  constructor(projectRoot: string, preferredRevision: string) {
    this._projectRoot = projectRoot;
    this._revision = preferredRevision;
  }

  name() {
    return 'webkit';
  }

  async downloadBrowserIfNeeded(onProgress?: OnProgressCallback) {
    const fetcher = this._createBrowserFetcher();
    const revisionInfo = fetcher.revisionInfo();
    // Do nothing if the revision is already downloaded.
    if (revisionInfo.local)
      return;
    await fetcher.download(revisionInfo.revision, onProgress);
  }

  async launch(options?: LaunchOptions & { slowMo?: number }): Promise<WKBrowser> {
    if (options && (options as any).userDataDir)
      throw new Error('userDataDir option is not supported in `browserType.launch`. Use `browserType.launchPersistent` instead');
    const { browserServer, transport } = await this._launchServer(options, 'local');
    const browser = await WKBrowser.connect(transport!, options && options.slowMo);
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    browser.close = () => browserServer.close();
    (browser as any)['__server__'] = browserServer;
    return browser;
  }

  async launchServer(options?: LaunchOptions & { port?: number }): Promise<BrowserServer> {
    return (await this._launchServer(options, 'server', undefined, options && options.port)).browserServer;
  }

  async launchPersistent(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext> {
    const { timeout = 30000 } = options || {};
    const { browserServer, transport } = await this._launchServer(options, 'persistent', userDataDir);
    const browser = await WKBrowser.connect(transport!);
    await helper.waitWithTimeout(browser._waitForFirstPageTarget(), 'first page', timeout);
    // Hack: for typical launch scenario, ensure that close waits for actual process termination.
    const browserContext = browser._defaultContext;
    browserContext.close = () => browserServer.close();
    return browserContext;
  }

  private async _launchServer(options: LaunchOptions = {}, launchType: LaunchType, userDataDir?: string, port?: number): Promise<{ browserServer: BrowserServer, transport?: ConnectionTransport }> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      dumpio = false,
      executablePath = null,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
      timeout = 30000
    } = options;

    let temporaryUserDataDir: string | null = null;
    if (!userDataDir) {
      userDataDir = await mkdtempAsync(WEBKIT_PROFILE_PATH);
      temporaryUserDataDir = userDataDir!;
    }

    const webkitArguments = [];
    if (!ignoreDefaultArgs)
      webkitArguments.push(...this._defaultArgs(options, userDataDir!, port || 0));
    else if (Array.isArray(ignoreDefaultArgs))
      webkitArguments.push(...this._defaultArgs(options, userDataDir!, port || 0).filter(arg => ignoreDefaultArgs.indexOf(arg) === -1));
    else
      webkitArguments.push(...args);

    let webkitExecutable = executablePath;
    if (!executablePath) {
      const {missingText, executablePath} = this._resolveExecutablePath();
      if (missingText)
        throw new Error(missingText);
      webkitExecutable = executablePath;
    }

    let transport: ConnectionTransport | undefined = undefined;
    let browserServer: BrowserServer | undefined = undefined;
    const { launchedProcess, gracefullyClose } = await launchProcess({
      executablePath: webkitExecutable!,
      args: webkitArguments,
      env: { ...env, CURL_COOKIE_JAR_PATH: path.join(userDataDir!, 'cookiejar.db') },
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      dumpio,
      pipe: true,
      tempDir: temporaryUserDataDir || undefined,
      attemptToGracefullyClose: async () => {
        if (!transport)
          return Promise.reject();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        const message = JSON.stringify({method: 'Browser.close', params: {}, id: kBrowserCloseMessageId});
        transport.send(message);
      },
      onkill: (exitCode, signal) => {
        if (browserServer)
          browserServer.emit(Events.BrowserServer.Close, exitCode, signal);
      },
    });

    const timeoutError = new TimeoutError(`Timed out after ${timeout} ms while trying to connect to WebKit! The only WebKit revision guaranteed to work is r${this._revision}`);
    await waitForLine(launchedProcess, launchedProcess.stdout, /^Web Inspector is reading from pipe #3$/, timeout, timeoutError);
    transport = new DeferWriteTransport(new PipeTransport(launchedProcess.stdio[3] as NodeJS.WritableStream, launchedProcess.stdio[4] as NodeJS.ReadableStream));
    browserServer = new BrowserServer(launchedProcess, gracefullyClose, launchType === 'server' ? await wrapTransportWithWebSocket(transport, port || 0) : null);
    return { browserServer, transport };
  }

  async connect(options: ConnectOptions): Promise<WKBrowser> {
    const transport = new platform.WebSocketTransport(options.wsEndpoint);
    return WKBrowser.connect(transport, options.slowMo);
  }

  executablePath(): string {
    return this._resolveExecutablePath().executablePath;
  }

  get devices(): types.Devices {
    return DeviceDescriptors;
  }

  get errors(): { TimeoutError: typeof TimeoutError } {
    return { TimeoutError };
  }

  _defaultArgs(options: BrowserArgOptions = {}, userDataDir: string, port: number): string[] {
    const {
      devtools = false,
      headless = !devtools,
      args = [],
    } = options;
    if (devtools)
      throw new Error('Option "devtools" is not supported by WebKit');
    const userDataDirArg = args.find(arg => arg.startsWith('--user-data-dir='));
    if (userDataDirArg)
      throw new Error('Pass userDataDir parameter instead of specifying --user-data-dir argument');
    const webkitArguments = ['--inspector-pipe'];
    if (headless)
      webkitArguments.push('--headless');
    webkitArguments.push(`--user-data-dir=${userDataDir}`);
    webkitArguments.push(...args);
    return webkitArguments;
  }

  _createBrowserFetcher(options?: BrowserFetcherOptions): BrowserFetcher {
    const downloadURLs = {
      linux: '%s/builds/webkit/%s/minibrowser-gtk-wpe.zip',
      mac: '%s/builds/webkit/%s/minibrowser-mac-%s.zip',
      win64: '%s/builds/webkit/%s/minibrowser-win64.zip',
    };

    const defaultOptions = {
      path: path.join(this._projectRoot, '.local-webkit'),
      host: 'https://playwright.azureedge.net',
      platform: (() => {
        const platform = os.platform();
        if (platform === 'darwin')
          return 'mac';
        if (platform === 'linux')
          return 'linux';
        if (platform === 'win32')
          return 'win64';
        return platform;
      })()
    };
    options = {
      ...defaultOptions,
      ...options,
    };
    assert(!!(downloadURLs as any)[options.platform!], 'Unsupported platform: ' + options.platform);

    return new BrowserFetcher(options.path!, options.platform!, this._revision, (platform: string, revision: string) => {
      return {
        downloadUrl: (platform === 'mac') ?
          util.format(downloadURLs[platform], options!.host, revision, getMacVersion()) :
          util.format((downloadURLs as any)[platform], options!.host, revision),
        executablePath: platform.startsWith('win') ? 'MiniBrowser.exe' : 'pw_run.sh',
      };
    });
  }

  _resolveExecutablePath(): { executablePath: string; missingText: string | null; } {
    const browserFetcher = this._createBrowserFetcher();
    const revisionInfo = browserFetcher.revisionInfo();
    const missingText = !revisionInfo.local ? `WebKit revision is not downloaded. Run "npm install"` : null;
    return { executablePath: revisionInfo.executablePath, missingText };
  }
}

const mkdtempAsync = platform.promisify(fs.mkdtemp);

const WEBKIT_PROFILE_PATH = path.join(os.tmpdir(), 'playwright_dev_profile-');

let cachedMacVersion: string | undefined = undefined;

function getMacVersion(): string {
  if (!cachedMacVersion) {
    const [major, minor] = execSync('sw_vers -productVersion').toString('utf8').trim().split('.');
    assert(+major === 10 && +minor >= 14, 'Error: unsupported macOS version, macOS 10.14 and newer are supported');
    cachedMacVersion = major + '.' + minor;
  }
  return cachedMacVersion;
}

class SequenceNumberMixer<V> {
  static _lastSequenceNumber = 1;
  private _values = new Map<number, V>();

  generate(value: V): number {
    const sequenceNumber = ++SequenceNumberMixer._lastSequenceNumber;
    this._values.set(sequenceNumber, value);
    return sequenceNumber;
  }

  take(sequenceNumber: number): V | undefined {
    const value = this._values.get(sequenceNumber);
    this._values.delete(sequenceNumber);
    return value;
  }
}

async function wrapTransportWithWebSocket(transport: ConnectionTransport, port: number) {
  const server = new ws.Server({ port });
  const guid = uuidv4();
  const idMixer = new SequenceNumberMixer<{id: number, socket: ws}>();
  const pendingBrowserContextCreations = new Set<number>();
  const pendingBrowserContextDeletions = new Map<number, string>();
  const browserContextIds = new Map<string, ws>();
  const pageProxyIds = new Map<string, ws>();
  const sockets = new Set<ws>();

  transport.onmessage = message => {
    const parsedMessage = JSON.parse(message);
    if ('id' in parsedMessage) {
      if (parsedMessage.id === -9999)
        return;
      // Process command response.
      const value = idMixer.take(parsedMessage.id);
      if (!value)
        return;
      const { id, socket } = value;

      if (!socket || socket.readyState === ws.CLOSING) {
        if (pendingBrowserContextCreations.has(id)) {
          transport.send(JSON.stringify({
            id: ++SequenceNumberMixer._lastSequenceNumber,
            method: 'Browser.deleteContext',
            params: { browserContextId: parsedMessage.result.browserContextId }
          }));
        }
        return;
      }

      if (pendingBrowserContextCreations.has(parsedMessage.id)) {
        // Browser.createContext response -> establish context attribution.
        browserContextIds.set(parsedMessage.result.browserContextId, socket);
        pendingBrowserContextCreations.delete(parsedMessage.id);
      }

      const deletedContextId = pendingBrowserContextDeletions.get(parsedMessage.id);
      if (deletedContextId) {
        // Browser.deleteContext response -> remove context attribution.
        browserContextIds.delete(deletedContextId);
        pendingBrowserContextDeletions.delete(parsedMessage.id);
      }

      parsedMessage.id = id;
      socket.send(JSON.stringify(parsedMessage));
      return;
    }

    // Process notification response.
    const { method, params, pageProxyId } = parsedMessage;
    if (pageProxyId) {
      const socket = pageProxyIds.get(pageProxyId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      socket.send(message);
      return;
    }
    if (method === 'Browser.pageProxyCreated') {
      const socket = browserContextIds.get(params.pageProxyInfo.browserContextId);
      if (!socket || socket.readyState === ws.CLOSING) {
        // Drop unattributed messages on the floor.
        return;
      }
      pageProxyIds.set(params.pageProxyInfo.pageProxyId, socket);
      socket.send(message);
      return;
    }
    if (method === 'Browser.pageProxyDestroyed') {
      const socket = pageProxyIds.get(params.pageProxyId);
      pageProxyIds.delete(params.pageProxyId);
      if (socket && socket.readyState !== ws.CLOSING)
        socket.send(message);
      return;
    }
    if (method === 'Browser.provisionalLoadFailed') {
      const socket = pageProxyIds.get(params.pageProxyId);
      if (socket && socket.readyState !== ws.CLOSING)
        socket.send(message);
      return;
    }
  };

  server.on('connection', (socket: ws, req) => {
    if (req.url !== '/' + guid) {
      socket.close();
      return;
    }
    sockets.add(socket);
    // Following two messages are reporting the default browser context and the default page.
    socket.send(JSON.stringify({
      method: 'Browser.pageProxyCreated',
      params: { pageProxyInfo: { pageProxyId: '5', browserContextId: '0000000000000002' } }
    }));
    socket.send(JSON.stringify({
      method: 'Target.targetCreated',
      params: {
        targetInfo: { targetId: 'page-6', type: 'page', isPaused: false }
      },
      pageProxyId: '5'
    }));

    socket.on('message', (message: string) => {
      const parsedMessage = JSON.parse(Buffer.from(message).toString());
      const { id, method, params } = parsedMessage;
      const seqNum = idMixer.generate({ id, socket });
      transport.send(JSON.stringify({ ...parsedMessage, id: seqNum }));
      if (method === 'Browser.createContext')
        pendingBrowserContextCreations.add(seqNum);
      if (method === 'Browser.deleteContext')
        pendingBrowserContextDeletions.set(seqNum, params.browserContextId);
    });

    socket.on('close', () => {
      for (const [pageProxyId, s] of pageProxyIds) {
        if (s === socket)
          pageProxyIds.delete(pageProxyId);
      }
      for (const [browserContextId, s] of browserContextIds) {
        if (s === socket) {
          transport.send(JSON.stringify({
            id: ++SequenceNumberMixer._lastSequenceNumber,
            method: 'Browser.deleteContext',
            params: { browserContextId }
          }));
          browserContextIds.delete(browserContextId);
        }
      }
      sockets.delete(socket);
    });
  });

  transport.onclose = () => {
    for (const socket of sockets)
      socket.close(undefined, 'Browser disconnected');
    server.close();
    transport.onmessage = undefined;
    transport.onclose = undefined;
  };

  const address = server.address();
  if (typeof address === 'string')
    return address + '/' + guid;
  return 'ws://127.0.0.1:' + address.port + '/' + guid;
}

/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * `connectOverCDP('extension://chrome')` connects to the Playwright extension (packages/extension).
 *
 * An extension cannot listen on a port. Thus Playwright listens, opens the connect page of the
 * extension in the browser with the address, and the extension connects when the user allows it.
 * From then on, the WebSocket is a CDP transport: Playwright sends CDP commands and gets CDP
 * events, as with a browser that has only the tabs of this client. The extension changes them
 * into chrome.debugger and chrome.tabs calls, see packages/extension/src/clientSession.ts.
 *
 * The only time limit is the timeout of `connectOverCDP`.
 */

import { spawn } from 'child_process';
import path from 'path';

import ws from 'ws';
import { ManualPromise } from '@isomorphic/manualPromise';
import { defaultUserDataDirForChannel } from '@utils/chromiumChannels';
import { debugLogger } from '@utils/debugLogger';
import { WSServer } from '@utils/wsServer';
import { TimeoutError } from '../errors';
import { registry } from '../registry';

import { isExtensionInstalledInProfile, playwrightExtensionId, playwrightExtensionInstallUrl } from './crExtensionProfile';

import type { ExtensionURL } from './crAttachURL';
import type { Progress } from '../progress';
import type { ConnectionTransport, ProtocolRequest, ProtocolResponse } from '../transport';
import type { WebSocket } from 'ws';

// Version 3: the extension speaks CDP. The extension refuses a version that it does not support.
const protocolVersion = 3;

// The way to provide an option depends on the client: the library, the MCP server or the CLI.
const optionHint = (option: string) => `Refer to the documentation of your Playwright client (library, MCP server or CLI) for how to provide the ${option}.`;

type ExtensionConnectOptions = {
  channel: string;
  executablePath?: string;
  userDataDir?: string;
  profileDirectory?: string;
  clientName: string;
  token?: string;
  // Undefined for a client without a tab group.
  tabGroup?: { title?: string, color?: string };
  background: boolean;
};

// Opens the connect page in the browser and waits for the extension to connect.
// The URL tells which browser and profile to connect to. The other options of the connection
// are the headers of `connectOverCDP`. `headers` must have lower case names.
export async function connectToExtension(progress: Progress, extensionURL: ExtensionURL, headers: Record<string, string>): Promise<ExtensionTransport> {
  const { channel, executablePath, userDataDir: customUserDataDir } = extensionURL;
  const token = headers['x-playwright-extension-token'];
  // Custom executablePath may target a browser in a different filesystem (e.g. Windows chrome.exe from WSL2), so the local profile path is not meaningful.
  const userDataDir = customUserDataDir ?? (executablePath ? undefined : defaultUserDataDirForChannel(channel));
  const profileDirectory = extensionURL.profileDirectory ?? 'Default';
  if (userDataDir && !executablePath && !await progress.race(isExtensionInstalledInProfile(path.join(userDataDir, profileDirectory))))
    throw new Error(`Playwright Extension not found in "${path.join(userDataDir, profileDirectory)}". Install it from ${playwrightExtensionInstallUrl}, or give the browser executable in the URL to use a browser at a custom location: extension://${channel}?executablePath=<path>.`);

  const server = new ExtensionServer();
  const started = server.start();
  try {
    const endpoint = await progress.race(started);
    progress.log(`<extension> waiting for the extension at ${endpoint}`);
    openConnectPageInBrowser(endpoint, {
      channel,
      executablePath,
      userDataDir: customUserDataDir,
      profileDirectory,
      clientName: headers['x-playwright-extension-client-name'] ?? 'Playwright',
      token,
      tabGroup: headers['x-playwright-extension-tab-group'] === 'false' ? undefined : {
        title: headers['x-playwright-extension-tab-group-title'],
        color: headers['x-playwright-extension-tab-group-color'],
      },
      background: headers['x-playwright-extension-background'] === 'true',
    }, error => server.fail(error));
    const transport = await progress.race(server.transport);
    progress.log(`<extension> connected`);
    return transport;
  } catch (error) {
    // A server that is not listening yet cannot be closed.
    void started.catch(() => {}).then(() => server.stop());
    if (error instanceof TimeoutError) {
      const advice = token
        ? `Make sure the extension is installed in the Chrome profile "${profileDirectory}" and the extension token is correct. ${optionHint('extension token')}`
        : `Make sure the extension is installed in the Chrome profile "${profileDirectory}", and allow the connection on the connect page. Increase the connection timeout to have more time. ${optionHint('connection timeout')}`;
      throw new TimeoutError(`Playwright extension did not connect within ${progress.timeout / 1000}s after opening the connect page. ${advice} If the connect page asks to update the extension, update it.`);
    }
    throw error;
  }
}

// Accepts the one connection of the extension.
class ExtensionServer {
  readonly transport = new ManualPromise<ExtensionTransport>();
  private _wsServer: WSServer;
  private _path = `/extension/${crypto.randomUUID()}`;

  constructor() {
    void this.transport.catch(e => debugLogger.log('extension', e));
    this._wsServer = new WSServer({
      onRequest: (request, response) => {
        response.statusCode = 404;
        response.end();
      },
      onHeaders: () => {},
      onUpgrade: () => undefined,
      isAllowedPathname: pathname => pathname === this._path,
      onConnection: (request, url, ws) => {
        if (this.transport.isDone())
          ws.close(1000, 'Another extension connection already established');
        else
          this.transport.resolve(new ExtensionTransport(ws, () => this.stop()));
        return undefined;
      },
    });
  }

  async start(): Promise<string> {
    return await this._wsServer.listen(0, undefined, '') + this._path;
  }

  fail(error: Error) {
    if (!this.transport.isDone())
      this.transport.reject(error);
  }

  stop() {
    this.fail(new Error('Server stopped'));
    void this._wsServer.close().catch(e => debugLogger.log('extension', e));
  }
}

export class ExtensionTransport implements ConnectionTransport {
  private _ws: WebSocket;
  private _unreportedCloseReason: string | undefined;
  onmessage?: (message: ProtocolResponse) => void;
  onclose?: (reason?: string) => void;

  constructor(socket: WebSocket, onClose: () => void) {
    this._ws = socket;
    socket.on('message', data => {
      // The 'ws' module in node sometimes sends us multiple messages in a single task.
      setImmediate(() => {
        try {
          this.onmessage?.(JSON.parse(data.toString()));
        } catch (e) {
          debugLogger.log('extension', `Closing the extension connection after a bad message: ${e?.message}`);
          socket.close();
        }
      });
    });
    socket.on('close', (code, reason) => {
      debugLogger.log('extension', `Extension disconnected: code=${code} reason=${reason}`);
      onClose();
      if (this.onclose)
        this.onclose(reason.toString());
      else
        this._unreportedCloseReason = reason.toString();
    });
    socket.on('error', error => debugLogger.log('extension', error));
  }

  send(message: ProtocolRequest) {
    // The socket can close before the connection sets `onclose`.
    if (this._unreportedCloseReason !== undefined) {
      const reason = this._unreportedCloseReason;
      this._unreportedCloseReason = undefined;
      setImmediate(() => this.onclose?.(reason));
      return;
    }
    this._ws.send(JSON.stringify(message));
  }

  close() {
    this._ws.close(1000, 'Playwright client disconnected');
  }

  async closeAndWait() {
    if (this._ws.readyState === ws.CLOSED)
      return;
    const closed = new Promise(f => this._ws.once('close', f));
    this.close();
    await closed;
  }
}

function openConnectPageInBrowser(endpoint: string, options: ExtensionConnectOptions, onError: (error: Error) => void) {
  const { clientName, tabGroup, background, token } = options;
  const url = new URL(`chrome-extension://${playwrightExtensionId}/connect.html`);
  // The parameter has the name that the first versions of the extension gave it.
  url.searchParams.set('mcpRelayUrl', endpoint);
  url.searchParams.set('client', JSON.stringify({ name: clientName }));
  url.searchParams.set('protocolVersion', process.env.PWTEST_EXTENSION_PROTOCOL ?? protocolVersion.toString());
  if (!tabGroup)
    url.searchParams.set('tabGroup', 'false');
  if (tabGroup?.title)
    url.searchParams.set('tabGroupTitle', tabGroup.title);
  if (tabGroup?.color)
    url.searchParams.set('tabGroupColor', tabGroup.color);
  if (background)
    url.searchParams.set('background', 'true');
  if (token)
    url.searchParams.set('token', token);

  const channel = registry.isChromiumAlias(options.channel) ? 'chromium' : options.channel;
  let executablePath = options.executablePath;
  if (!executablePath) {
    const executableInfo = registry.findExecutable(channel);
    if (!executableInfo)
      throw new Error(`Unsupported channel: "${options.channel}"`);
    executablePath = executableInfo.executablePath();
    if (!executablePath)
      throw new Error(`"${options.channel}" executable not found. Make sure it is installed at a standard location.`);
  }

  const args: string[] = [];
  // The default profile dir is not passed explicitly, the browser resolves it on its own.
  if (options.userDataDir)
    args.push(`--user-data-dir=${options.userDataDir}`);
  if (options.profileDirectory)
    args.push(`--profile-directory=${options.profileDirectory}`);
  // Without a token, the user must see the connect page to approve the connection.
  if (background && token)
    args.push('--open-in-background');
  args.push(url.toString());
  const browserProcess = spawn(executablePath, args, {
    windowsHide: true,
    detached: true,
    shell: false,
    stdio: 'ignore',
  });
  browserProcess.on('error', error => onError(new Error(`Failed to start the browser at "${executablePath}": ${error.message}`)));
  // The browser of the user must not keep this process alive.
  browserProcess.unref();
}

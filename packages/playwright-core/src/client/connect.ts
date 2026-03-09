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

import { monotonicTime } from '../utils/isomorphic/time';
import { raceAgainstDeadline } from '../utils/isomorphic/timeoutRunner';
import { Browser } from './browser';
import { ChannelOwner } from './channelOwner';
import { Connection } from './connection';
import { Events } from './events';

import type * as playwright from '../..';
import type { Playwright } from './playwright';
import type { ConnectOptions, HeadersArray } from './types';
import type * as channels from '@protocol/channels';
import type { BrowserDescriptor } from '../serverRegistry';

export async function connectToBrowser(playwright: Playwright, params: ConnectOptions): Promise<Browser> {
  const deadline = params.timeout ? monotonicTime() + params.timeout : 0;
  const nameParam = params.browserName ? { 'x-playwright-browser': params.browserName } : {};
  const headers = { ...nameParam, ...params.headers };
  const connectParams: channels.LocalUtilsConnectParams = {
    endpoint: params.endpoint!,
    headers,
    exposeNetwork: params.exposeNetwork,
    slowMo: params.slowMo,
    timeout: params.timeout || 0,
  };
  if ((params as any).__testHookRedirectPortForwarding)
    connectParams.socksProxyRedirectPortForTest = (params as any).__testHookRedirectPortForwarding;
  const connection = await connectToEndpoint(playwright._connection, connectParams);
  let browser: Browser;
  connection.on('close', () => {
    // Emulate all pages, contexts and the browser closing upon disconnect.
    for (const context of browser?.contexts() || []) {
      for (const page of context.pages())
        page._onClose();
      context._onClose();
    }
    setTimeout(() => browser?._didClose(), 0);
  });

  const result = await raceAgainstDeadline(async () => {
    // For tests.
    if ((params as any).__testHookBeforeCreateBrowser)
      await (params as any).__testHookBeforeCreateBrowser();

    const playwright = await connection!.initializePlaywright();
    if (!playwright._initializer.preLaunchedBrowser) {
      connection.close();
      throw new Error('Malformed endpoint. Did you use BrowserType.launchServer method?');
    }
    playwright.selectors = playwright.selectors;
    browser = Browser.from(playwright._initializer.preLaunchedBrowser!);
    browser._shouldCloseConnectionOnClose = true;
    browser.on(Events.Browser.Disconnected, () => connection.close());
    return browser;
  }, deadline);
  if (!result.timedOut) {
    return result.result;
  } else {
    connection.close();
    throw new Error(`Timeout ${params.timeout}ms exceeded`);
  }
}

export async function connectToEndpoint(parentConnection: Connection, params: channels.LocalUtilsConnectParams): Promise<Connection> {
  const localUtils = parentConnection.localUtils();
  const transport = localUtils ? new JsonPipeTransport(localUtils) : new WebSocketTransport();
  const connectHeaders = await transport.connect(params);
  const connection = new Connection(parentConnection._platform, localUtils, parentConnection._instrumentation, connectHeaders);
  connection.markAsRemote();
  connection.on('close', () => transport.close());

  let closeError: string | undefined;
  const onTransportClosed = (reason?: string) => {
    connection.close(reason || closeError);
  };
  transport.onClose(reason => onTransportClosed(reason));
  connection.onmessage = message => transport.send(message).catch(() => onTransportClosed());
  transport.onMessage(message => {
    try {
      connection!.dispatch(message);
    } catch (e) {
      closeError = String(e);
      transport.close().catch(() => {});
    }
  });
  return connection;
}

export async function connectToBrowserAcrossVersions(descriptor: BrowserDescriptor): Promise<playwright.Browser> {
  const pw = require(descriptor.playwrightLib);
  const params: ConnectOptions = { endpoint: descriptor.pipeName! };
  const browser = await connectToBrowser(pw, params);
  browser._connectToBrowserType(pw[descriptor.browser.browserName], {}, undefined);
  return browser;
}

interface Transport {
  connect(params: channels.LocalUtilsConnectParams): Promise<HeadersArray>;
  send(message: any): Promise<void>;
  onMessage(callback: (message: object) => void): void;
  onClose(callback: (reason?: string) => void): void;
  close(): Promise<void>;
}

class JsonPipeTransport implements Transport {
  private _pipe: channels.JsonPipeChannel | undefined;
  private _owner: ChannelOwner<channels.LocalUtilsChannel>;

  constructor(owner: ChannelOwner<channels.LocalUtilsChannel>) {
    this._owner = owner;
  }

  async connect(params: channels.LocalUtilsConnectParams) {
    const { pipe, headers: connectHeaders } = await this._owner._channel.connect(params);
    this._pipe = pipe;
    return connectHeaders;
  }

  async send(message: object) {
    await this._pipe!.send({ message });
  }

  onMessage(callback: (message: object) => void) {
    this._pipe!.on('message', ({ message }) => callback(message));
  }

  onClose(callback: (reason?: string) => void) {
    this._pipe!.on('closed', ({ reason }) => callback(reason));
  }

  async close() {
    await this._pipe!.close().catch(() => {});
  }
}

class WebSocketTransport implements Transport {
  private _ws: WebSocket | undefined;

  async connect(params: channels.LocalUtilsConnectParams) {
    this._ws = new window.WebSocket(params.endpoint);
    return [];
  }

  async send(message: object) {
    this._ws!.send(JSON.stringify(message));
  }

  onMessage(callback: (message: object) => void) {
    this._ws!.addEventListener('message', event => callback(JSON.parse(event.data)));
  }

  onClose(callback: (reason?: string) => void) {
    this._ws!.addEventListener('close', () => callback());
  }

  async close() {
    this._ws!.close();
  }
}

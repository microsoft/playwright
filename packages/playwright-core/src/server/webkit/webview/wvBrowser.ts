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

import os from 'os';
import path from 'path';

import ws from 'ws';
import { debugLogger, RecentLogsCollector } from '@utils/debugLogger';
import { removeFolders } from '@utils/fileUtils';
import { httpHappyEyeballsAgent, httpsHappyEyeballsAgent } from '@utils/happyEyeballs';
import { headersArrayToObject } from '@isomorphic/headers';
import { Browser } from '../../browser';
import { helper } from '../../helper';
import { perMessageDeflate } from '../../transport';
import { getUserAgent } from '../../userAgent';
import { BrowserContext } from '../../browserContext';
import { DialogBridge } from './dialogBridge';
import { WVConnection } from './wvConnection';
import { WVPage } from './wvPage';

import type { BrowserOptions, BrowserProcess } from '../../browser';
import type { SdkObject } from '../../instrumentation';
import type { InitScript, Page } from '../../page';
import type { ProtocolRequest, ProtocolResponse } from '../../transport';
import type * as types from '../../types';
import type * as channels from '../../channels';
import type { Progress } from '../../progress';
import type { ConnectOverCDPTransport } from '../../../../types/types.d.ts';

type ProxyTab = {
  url: string;
  title?: string;
  webSocketDebuggerUrl: string;
};

function deriveProxyBase(endpointURL: string): string {
  const u = new URL(endpointURL);
  if (u.protocol === 'http:' || u.protocol === 'https:')
    return `${u.protocol}//${u.host}`;
  const httpProto = u.protocol === 'wss:' ? 'https:' : 'http:';
  return `${httpProto}//${u.host}`;
}

function pageIdFromWsUrl(wsUrl: string): string {
  const m = /\/devtools\/page\/([^/]+)/.exec(wsUrl);
  return m ? m[1] : wsUrl;
}

async function listTabs(proxyBase: string, headers: { [key: string]: string }): Promise<ProxyTab[]> {
  const res = await fetch(`${proxyBase}/json`, { headers });
  if (!res.ok)
    throw new Error(`ios_webkit_debug_proxy ${proxyBase}/json returned ${res.status}`);
  const data = await res.json() as ProxyTab[];
  return data.filter(t => !!t.webSocketDebuggerUrl);
}

// Local WebSocket-backed transport: defers opening the socket until `open()`
// is called, so listeners on `onmessage` are wired before the remote side
// starts emitting events.
class DeferredWebSocketTransport implements ConnectOverCDPTransport {
  private readonly _url: string;
  private readonly _headers: { [key: string]: string };
  private _ws: ws | undefined;
  private _closed = false;

  onmessage?: (message: object) => void;
  onclose?: (reason?: string) => void;

  constructor(url: string, headers: { [key: string]: string }) {
    this._url = url;
    this._headers = headers;
  }

  open(): void {
    if (this._closed)
      return;
    const url = this._url;
    this._ws = new ws(url, [], {
      maxPayload: 256 * 1024 * 1024,
      headers: this._headers,
      followRedirects: true,
      agent: (/^(https|wss):\/\//.test(url)) ? httpsHappyEyeballsAgent : httpHappyEyeballsAgent,
      perMessageDeflate,
      allowSynchronousEvents: false,
    });
    this._ws.addEventListener('message', event => {
      const eventData = event.data as string;
      let parsedJson: ProtocolResponse;
      try {
        parsedJson = JSON.parse(eventData);
        this.onmessage?.(parsedJson);
      } catch {
        this._ws?.close();
      }
    });
    this._ws.addEventListener('close', event => {
      this.onclose?.(event.reason);
    });
    this._ws.addEventListener('error', () => {});
  }

  send(message: object): void {
    this._ws?.send(JSON.stringify(message as ProtocolRequest));
  }

  close(): void {
    this._closed = true;
    this._ws?.close();
  }
}

export async function connectOverRDP(progress: Progress, parent: SdkObject, params: channels.BrowserTypeConnectOverCDPParams): Promise<Browser> {
  let headersMap: { [key: string]: string; } | undefined;
  if (params.headers)
    headersMap = headersArrayToObject(params.headers, false);
  if (!headersMap)
    headersMap = { 'User-Agent': getUserAgent() };
  else if (!Object.keys(headersMap).some(key => key.toLowerCase() === 'user-agent'))
    headersMap['User-Agent'] = getUserAgent();

  const transport = params.transport as ConnectOverCDPTransport | undefined;
  const proxyBase = transport ? '' : deriveProxyBase(params.endpointURL!);

  const artifactsDir = params.artifactsDir ?? path.join(os.tmpdir(), 'playwright-artifacts-');
  const doCleanup = async () => {
    await removeFolders([artifactsDir]);
  };

  const browser = await progress.race((async () => {
    const dialogBridge = await DialogBridge.start();
    const created = new WVBrowser(parent, proxyBase, headersMap!, dialogBridge, transport, {
      slowMo: params.slowMo,
      name: 'webkit',
      browserType: 'webkit',
      browserProcess: { close: async () => {}, kill: async () => {} } as BrowserProcess,
      protocolLogger: helper.debugProtocolLogger(),
      browserLogsCollector: new RecentLogsCollector(),
      artifactsDir,
      downloadsPath: artifactsDir,
      tracesDir: artifactsDir,
      originalLaunchOptions: {},
    });
    const shutdown = async () => {
      await created._closeAllTabs();
      await dialogBridge.close().catch(() => {});
      await doCleanup();
    };
    created.options.browserProcess = { close: shutdown, kill: shutdown };
    await created._initialize();
    return created;
  })());

  if (!params.isLocal)
    browser._isBrowserCollocatedWithServer = false;
  browser.on(Browser.Events.Disconnected, doCleanup);
  return browser;
}

type TabEntry = {
  pageId: string;
  transport: ConnectOverCDPTransport;
  connection: WVConnection;
  page: WVPage;
};

export class WVBrowser extends Browser {
  readonly _context: WVBrowserContext;
  readonly _proxyBase: string;
  readonly _headers: { [key: string]: string };
  readonly _dialogBridge: DialogBridge;
  readonly _directPageTransport: ConnectOverCDPTransport | undefined;
  readonly _tabs = new Map<string, TabEntry>();
  private _didCloseFired = false;
  // Backwards compat — old code still reads `_page` for the "primary" tab.
  _page!: WVPage;

  constructor(parent: SdkObject, proxyBase: string, headers: { [key: string]: string }, dialogBridge: DialogBridge, directPageTransport: ConnectOverCDPTransport | undefined, options: BrowserOptions) {
    super(parent, options);
    this._proxyBase = proxyBase;
    this._headers = headers;
    this._dialogBridge = dialogBridge;
    this._directPageTransport = directPageTransport;
    this._context = new WVBrowserContext(this);
  }

  async _initialize(): Promise<void> {
    await this._context.initialize();
    if (this._directPageTransport) {
      await this._attachTab('rdp-transport', this._directPageTransport);
    } else {
      await this._syncTabs();
      if (!this._tabs.size)
        throw new Error(`No Mobile Safari tabs found at ${this._proxyBase}/json — open Safari first.`);
    }
    this._page = this._firstTab().page;
  }

  private _firstTab(): TabEntry {
    return this._tabs.values().next().value as TabEntry;
  }

  async _syncTabs(): Promise<void> {
    const tabs = await listTabs(this._proxyBase, this._headers);
    const seen = new Set<string>();
    for (const tab of tabs) {
      const pageId = pageIdFromWsUrl(tab.webSocketDebuggerUrl);
      seen.add(pageId);
      if (this._tabs.has(pageId))
        continue;
      try {
        await this._attachTab(pageId, new DeferredWebSocketTransport(tab.webSocketDebuggerUrl, this._headers));
      } catch (e) {
        debugLogger.log('error', `webview: failed to attach to tab ${pageId}: ${(e as Error).message}`);
      }
    }
    // Tabs that disappeared from /json must be teared down too.
    for (const pageId of Array.from(this._tabs.keys())) {
      if (!seen.has(pageId))
        this._detachTab(pageId);
    }
  }

  private async _attachTab(pageId: string, transport: ConnectOverCDPTransport): Promise<void> {
    const connection = new WVConnection(transport, () => this._detachTab(pageId), this.options.protocolLogger, this.options.browserLogsCollector);
    const dialogEndpoint = this._dialogBridge.endpointFor(pageId);
    const page = new WVPage(this._context, connection.outerSession, dialogEndpoint);
    this._dialogBridge.registerTab(pageId, req => page.onBridgeDialog(req));
    this._tabs.set(pageId, { pageId, transport, connection, page });
    transport.open?.();
    await page.waitForInitialized();
  }

  private _detachTab(pageId: string): void {
    const entry = this._tabs.get(pageId);
    if (!entry)
      return;
    this._tabs.delete(pageId);
    this._dialogBridge.unregisterTab(pageId);
    entry.connection.close();
    entry.page.didClose();
  }

  async _closeAllTabs(): Promise<void> {
    for (const pageId of Array.from(this._tabs.keys()))
      this._detachTab(pageId);
    this._fireDidCloseOnce();
  }

  private _fireDidCloseOnce(): void {
    if (this._didCloseFired)
      return;
    this._didCloseFired = true;
    this.didClose();
  }

  async doCreateNewContext(options: types.BrowserContextOptions): Promise<BrowserContext> {
    throw new Error('Not supported');
  }

  contexts(): BrowserContext[] {
    return [this._context];
  }

  version(): string {
    return '';
  }

  userAgent(): string {
    return '';
  }

  isConnected(): boolean {
    return this._tabs.size > 0;
  }
}

export class WVBrowserContext extends BrowserContext {
  declare readonly _browser: WVBrowser;

  constructor(browser: WVBrowser) {
    super(browser, {}, '');
    this.authenticateProxyViaHeader();
  }

  override possiblyUninitializedPages(): Page[] {
    return Array.from(this._browser._tabs.values()).map(entry => entry.page._page);
  }

  override async doCreateNewPage(): Promise<Page> {
    throw new Error('Not supported');
  }

  async doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]> {
    return [];
  }

  async addCookies(cookies: channels.SetNetworkCookie[]) {
    throw new Error('Method not implemented.');
  }

  async doClearCookies() {
    throw new Error('Method not implemented.');
  }

  async doGrantPermissions(origin: string, permissions: string[]) {
    throw new Error('Method not implemented.');
  }

  async doClearPermissions() {
    throw new Error('Method not implemented.');
  }

  async setGeolocation(geolocation?: types.Geolocation): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async doUpdateExtraHTTPHeaders(): Promise<void> {
    for (const page of this.pages())
      await (page.delegate as WVPage).updateExtraHTTPHeaders();
  }

  async setUserAgent(userAgent: string | undefined): Promise<void> {
    this._options.userAgent = userAgent;
    for (const page of this.pages())
      await (page.delegate as WVPage).updateUserAgent();
  }

  async doAddInitScript(initScript: InitScript) {
    for (const page of this.pages())
      await (page.delegate as WVPage)._updateBootstrapScript();
  }

  async doRemoveInitScripts(initScripts: InitScript[]) {
    for (const page of this.pages())
      await (page.delegate as WVPage)._updateBootstrapScript();
  }

  async doUpdateRequestInterception(): Promise<void> {
    for (const page of this.pages())
      await (page.delegate as WVPage).updateRequestInterception();
  }

  override async doExposePlaywrightBinding() {
    for (const page of this.pages())
      await (page.delegate as WVPage).exposePlaywrightBinding();
  }

  override async onClosePersistent() {}
  override async doUpdateDefaultViewport() {}
  override async doUpdateDefaultEmulatedMedia() {}
  override async clearCache(): Promise<void> { throw new Error('Method not implemented.'); }
  override async doClose(reason: string | undefined): Promise<void | 'close-browser'> { throw new Error('Method not implemented.'); }
  override async cancelDownload(uuid: string) { throw new Error('Method not implemented.'); }
  protected override async doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> { throw new Error('Method not implemented.'); }
  protected override async doUpdateOffline(): Promise<void> { throw new Error('Method not implemented.'); }
}

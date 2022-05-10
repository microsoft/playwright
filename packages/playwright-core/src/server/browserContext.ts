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

import * as os from 'os';
import { TimeoutSettings } from '../common/timeoutSettings';
import { debugMode, createGuid } from '../utils';
import { mkdirIfNeeded } from '../utils/fileUtils';
import type { Browser, BrowserOptions } from './browser';
import type { Download } from './download';
import type * as frames from './frames';
import { helper } from './helper';
import * as network from './network';
import type { PageDelegate } from './page';
import { Page, PageBinding } from './page';
import type { Progress } from './progress';
import type { Selectors } from './selectors';
import type * as types from './types';
import path from 'path';
import fs from 'fs';
import type { CallMetadata } from './instrumentation';
import { serverSideCallMetadata, SdkObject } from './instrumentation';
import { Debugger } from './debugger';
import { Tracing } from './trace/recorder/tracing';
import { HarRecorder } from './har/harRecorder';
import { Recorder } from './recorder';
import * as consoleApiSource from '../generated/consoleApiSource';
import { BrowserContextAPIRequestContext } from './fetch';

export abstract class BrowserContext extends SdkObject {
  static Events = {
    Close: 'close',
    Page: 'page',
    Request: 'request',
    Response: 'response',
    RequestFailed: 'requestfailed',
    RequestFinished: 'requestfinished',
    BeforeClose: 'beforeclose',
    VideoStarted: 'videostarted',
  };

  readonly _timeoutSettings = new TimeoutSettings();
  readonly _pageBindings = new Map<string, PageBinding>();
  readonly _options: types.BrowserContextOptions;
  _requestInterceptor?: network.RouteHandler;
  private _isPersistentContext: boolean;
  private _closedStatus: 'open' | 'closing' | 'closed' = 'open';
  readonly _closePromise: Promise<Error>;
  private _closePromiseFulfill: ((error: Error) => void) | undefined;
  readonly _permissions = new Map<string, string[]>();
  readonly _downloads = new Set<Download>();
  readonly _browser: Browser;
  readonly _browserContextId: string | undefined;
  private _selectors?: Selectors;
  private _origins = new Set<string>();
  readonly _harRecorder: HarRecorder | undefined;
  readonly tracing: Tracing;
  readonly fetchRequest: BrowserContextAPIRequestContext;
  private _customCloseHandler?: () => Promise<any>;
  readonly _tempDirs: string[] = [];
  private _settingStorageState = false;
  readonly initScripts: string[] = [];

  constructor(browser: Browser, options: types.BrowserContextOptions, browserContextId: string | undefined) {
    super(browser, 'browser-context');
    this.attribution.context = this;
    this._browser = browser;
    this._options = options;
    this._browserContextId = browserContextId;
    this._isPersistentContext = !browserContextId;
    this._closePromise = new Promise(fulfill => this._closePromiseFulfill = fulfill);

    this.fetchRequest = new BrowserContextAPIRequestContext(this);

    if (this._options.recordHar)
      this._harRecorder = new HarRecorder(this, { ...this._options.recordHar, path: path.join(this._browser.options.artifactsDir, `${createGuid()}.har`) });

    this.tracing = new Tracing(this, browser.options.tracesDir);
  }

  isPersistentContext(): boolean {
    return this._isPersistentContext;
  }

  setSelectors(selectors: Selectors) {
    this._selectors = selectors;
  }

  selectors(): Selectors {
    return this._selectors || this._browser.options.selectors;
  }

  async _initialize() {
    if (this.attribution.isInternalPlaywright)
      return;
    // Debugger will pause execution upon page.pause in headed mode.
    const contextDebugger = new Debugger(this);

    // When PWDEBUG=1, show inspector for each context.
    if (debugMode() === 'inspector')
      await Recorder.show(this, { pauseOnNextStatement: true });

    // When paused, show inspector.
    if (contextDebugger.isPaused())
      Recorder.showInspector(this);
    contextDebugger.on(Debugger.Events.PausedStateChanged, () => {
      Recorder.showInspector(this);
    });

    if (debugMode() === 'console')
      await this.extendInjectedScript(consoleApiSource.source);
  }

  async _ensureVideosPath() {
    if (this._options.recordVideo)
      await mkdirIfNeeded(path.join(this._options.recordVideo.dir, 'dummy'));
  }

  _browserClosed() {
    for (const page of this.pages())
      page._didClose();
    this._didCloseInternal();
  }

  private _didCloseInternal() {
    if (this._closedStatus === 'closed') {
      // We can come here twice if we close browser context and browser
      // at the same time.
      return;
    }
    this._closedStatus = 'closed';
    this._deleteAllDownloads();
    this._downloads.clear();
    this.tracing.dispose();
    if (this._isPersistentContext)
      this.onClosePersistent();
    this._closePromiseFulfill!(new Error('Context closed'));
    this.emit(BrowserContext.Events.Close);
  }

  // BrowserContext methods.
  abstract pages(): Page[];
  abstract newPageDelegate(): Promise<PageDelegate>;
  abstract addCookies(cookies: types.SetNetworkCookieParam[]): Promise<void>;
  abstract clearCookies(): Promise<void>;
  abstract setGeolocation(geolocation?: types.Geolocation): Promise<void>;
  abstract setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void>;
  abstract setOffline(offline: boolean): Promise<void>;
  abstract cancelDownload(uuid: string): Promise<void>;
  protected abstract doGetCookies(urls: string[]): Promise<types.NetworkCookie[]>;
  protected abstract doGrantPermissions(origin: string, permissions: string[]): Promise<void>;
  protected abstract doClearPermissions(): Promise<void>;
  protected abstract doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void>;
  protected abstract doAddInitScript(expression: string): Promise<void>;
  protected abstract doRemoveInitScripts(): Promise<void>;
  protected abstract doExposeBinding(binding: PageBinding): Promise<void>;
  protected abstract doRemoveExposedBindings(): Promise<void>;
  protected abstract doUpdateRequestInterception(): Promise<void>;
  protected abstract doClose(): Promise<void>;
  protected abstract onClosePersistent(): void;

  async cookies(urls: string | string[] | undefined = []): Promise<types.NetworkCookie[]> {
    if (urls && !Array.isArray(urls))
      urls = [ urls ];
    return await this.doGetCookies(urls as string[]);
  }

  setHTTPCredentials(httpCredentials?: types.Credentials): Promise<void> {
    return this.doSetHTTPCredentials(httpCredentials);
  }

  async exposeBinding(name: string, needsHandle: boolean, playwrightBinding: frames.FunctionWithSource): Promise<void> {
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    for (const page of this.pages()) {
      if (page.getBinding(name))
        throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    const binding = new PageBinding(name, playwrightBinding, needsHandle);
    this._pageBindings.set(name, binding);
    await this.doExposeBinding(binding);
  }

  async removeExposedBindings() {
    for (const key of this._pageBindings.keys()) {
      if (!key.startsWith('__pw'))
        this._pageBindings.delete(key);
    }
    await this.doRemoveExposedBindings();
  }

  async grantPermissions(permissions: string[], origin?: string) {
    let resolvedOrigin = '*';
    if (origin) {
      const url = new URL(origin);
      resolvedOrigin = url.origin;
    }
    const existing = new Set(this._permissions.get(resolvedOrigin) || []);
    permissions.forEach(p => existing.add(p));
    const list = [...existing.values()];
    this._permissions.set(resolvedOrigin, list);
    await this.doGrantPermissions(resolvedOrigin, list);
  }

  async clearPermissions() {
    this._permissions.clear();
    await this.doClearPermissions();
  }

  setDefaultNavigationTimeout(timeout: number | undefined) {
    this._timeoutSettings.setDefaultNavigationTimeout(timeout);
  }

  setDefaultTimeout(timeout: number | undefined) {
    this._timeoutSettings.setDefaultTimeout(timeout);
  }

  async _loadDefaultContextAsIs(progress: Progress): Promise<Page[]> {
    if (!this.pages().length) {
      const waitForEvent = helper.waitForEvent(progress, this, BrowserContext.Events.Page);
      progress.cleanupWhenAborted(() => waitForEvent.dispose);
      const page = (await waitForEvent.promise) as Page;
      if (page._pageIsError)
        throw page._pageIsError;
    }
    const pages = this.pages();
    if (pages[0]._pageIsError)
      throw pages[0]._pageIsError;
    await pages[0].mainFrame()._waitForLoadState(progress, 'load');
    return pages;
  }

  async _loadDefaultContext(progress: Progress) {
    const pages = await this._loadDefaultContextAsIs(progress);
    if (this._options.isMobile || this._options.locale) {
      // Workaround for:
      // - chromium fails to change isMobile for existing page;
      // - webkit fails to change locale for existing page.
      const oldPage = pages[0];
      await this.newPage(progress.metadata);
      await oldPage.close(progress.metadata);
    }
  }

  protected _authenticateProxyViaHeader() {
    const proxy = this._options.proxy || this._browser.options.proxy || { username: undefined, password: undefined };
    const { username, password } = proxy;
    if (username) {
      this._options.httpCredentials = { username, password: password! };
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      this._options.extraHTTPHeaders = network.mergeHeaders([
        this._options.extraHTTPHeaders,
        network.singleHeader('Proxy-Authorization', `Basic ${token}`),
      ]);
    }
  }

  protected _authenticateProxyViaCredentials() {
    const proxy = this._options.proxy || this._browser.options.proxy;
    if (!proxy)
      return;
    const { username, password } = proxy;
    if (username)
      this._options.httpCredentials = { username, password: password || '' };
  }

  async addInitScript(script: string) {
    this.initScripts.push(script);
    await this.doAddInitScript(script);
  }

  async removeInitScripts(): Promise<void> {
    this.initScripts.splice(0, this.initScripts.length);
    await this.doRemoveInitScripts();
  }

  async setRequestInterceptor(handler: network.RouteHandler | undefined): Promise<void> {
    this._requestInterceptor = handler;
    await this.doUpdateRequestInterception();
  }

  isClosingOrClosed() {
    return this._closedStatus !== 'open';
  }

  private async _deleteAllDownloads(): Promise<void> {
    await Promise.all(Array.from(this._downloads).map(download => download.artifact.deleteOnContextClose()));
  }

  private async _deleteAllTempDirs(): Promise<void> {
    await Promise.all(this._tempDirs.map(async dir => await fs.promises.unlink(dir).catch(e => {})));
  }

  setCustomCloseHandler(handler: (() => Promise<any>) | undefined) {
    this._customCloseHandler = handler;
  }

  async close(metadata: CallMetadata) {
    if (this._closedStatus === 'open') {
      this.emit(BrowserContext.Events.BeforeClose);
      this._closedStatus = 'closing';

      await this._harRecorder?.flush();
      await this.tracing.flush();

      // Cleanup.
      const promises: Promise<void>[] = [];
      for (const { context, artifact } of this._browser._idToVideo.values()) {
        // Wait for the videos to finish.
        if (context === this)
          promises.push(artifact.finishedPromise());
      }

      if (this._customCloseHandler) {
        await this._customCloseHandler();
      } else if (this._isPersistentContext) {
        // Close all the pages instead of the context,
        // because we cannot close the default context.
        await Promise.all(this.pages().map(page => page.close(metadata)));
      } else {
        // Close the context.
        await this.doClose();
      }

      // We delete downloads after context closure
      // so that browser does not write to the download file anymore.
      promises.push(this._deleteAllDownloads());
      promises.push(this._deleteAllTempDirs());
      await Promise.all(promises);

      // Custom handler should trigger didCloseInternal itself.
      if (this._customCloseHandler)
        return;

      // Persistent context should also close the browser.
      if (this._isPersistentContext)
        await this._browser.close();

      // Bookkeeping.
      this._didCloseInternal();
    }
    await this._closePromise;
  }

  async newPage(metadata: CallMetadata): Promise<Page> {
    const pageDelegate = await this.newPageDelegate();
    if (metadata.isServerSide)
      pageDelegate.potentiallyUninitializedPage().markAsServerSideOnly();
    const pageOrError = await pageDelegate.pageOrError();
    if (pageOrError instanceof Page) {
      if (pageOrError.isClosed())
        throw new Error('Page has been closed.');
      return pageOrError;
    }
    throw pageOrError;
  }

  addVisitedOrigin(origin: string) {
    this._origins.add(origin);
  }

  async storageState(): Promise<types.StorageState> {
    const result: types.StorageState = {
      cookies: await this.cookies(),
      origins: []
    };
    if (this._origins.size)  {
      const internalMetadata = serverSideCallMetadata();
      const page = await this.newPage(internalMetadata);
      await page._setServerRequestInterceptor(handler => {
        handler.fulfill({ body: '<html></html>' }).catch(() => {});
      });
      for (const origin of this._origins) {
        const originStorage: types.OriginStorage = { origin, localStorage: [] };
        const frame = page.mainFrame();
        await frame.goto(internalMetadata, origin);
        const storage = await frame.evaluateExpression(`({
          localStorage: Object.keys(localStorage).map(name => ({ name, value: localStorage.getItem(name) })),
        })`, false, undefined, 'utility');
        originStorage.localStorage = storage.localStorage;
        if (storage.localStorage.length)
          result.origins.push(originStorage);
      }
      await page.close(internalMetadata);
    }
    return result;
  }

  isSettingStorageState(): boolean {
    return this._settingStorageState;
  }

  async setStorageState(metadata: CallMetadata, state: types.SetStorageState) {
    this._settingStorageState = true;
    try {
      if (state.cookies)
        await this.addCookies(state.cookies);
      if (state.origins && state.origins.length)  {
        const internalMetadata = serverSideCallMetadata();
        const page = await this.newPage(internalMetadata);
        await page._setServerRequestInterceptor(handler => {
          handler.fulfill({ body: '<html></html>' }).catch(() => {});
        });
        for (const originState of state.origins) {
          const frame = page.mainFrame();
          await frame.goto(metadata, originState.origin);
          await frame.evaluateExpression(`
            originState => {
              for (const { name, value } of (originState.localStorage || []))
                localStorage.setItem(name, value);
            }`, true, originState, 'utility');
        }
        await page.close(internalMetadata);
      }
    } finally {
      this._settingStorageState = false;
    }
  }

  async extendInjectedScript(source: string, arg?: any) {
    const installInFrame = (frame: frames.Frame) => frame.extendInjectedScript(source, arg).catch(() => {});
    const installInPage = (page: Page) => {
      page.on(Page.Events.InternalFrameNavigatedToNewDocument, installInFrame);
      return Promise.all(page.frames().map(installInFrame));
    };
    this.on(BrowserContext.Events.Page, installInPage);
    return Promise.all(this.pages().map(installInPage));
  }
}

export function assertBrowserContextIsNotOwned(context: BrowserContext) {
  for (const page of context.pages()) {
    if (page._ownedContext)
      throw new Error('Please use browser.newContext() for multi-page scripts that share the context.');
  }
}

export function validateBrowserContextOptions(options: types.BrowserContextOptions, browserOptions: BrowserOptions) {
  if (options.noDefaultViewport && options.deviceScaleFactor !== undefined)
    throw new Error(`"deviceScaleFactor" option is not supported with null "viewport"`);
  if (options.noDefaultViewport && options.isMobile !== undefined)
    throw new Error(`"isMobile" option is not supported with null "viewport"`);
  if (options.acceptDownloads === undefined)
    options.acceptDownloads = true;
  if (!options.viewport && !options.noDefaultViewport)
    options.viewport = { width: 1280, height: 720 };
  if (options.recordVideo) {
    if (!options.recordVideo.size) {
      if (options.noDefaultViewport) {
        options.recordVideo.size = { width: 800, height: 600 };
      } else {
        const size = options.viewport!;
        const scale = Math.min(1, 800 / Math.max(size.width, size.height));
        options.recordVideo.size = {
          width: Math.floor(size.width * scale),
          height: Math.floor(size.height * scale)
        };
      }
    }
    // Make sure both dimensions are odd, this is required for vp8
    options.recordVideo.size!.width &= ~1;
    options.recordVideo.size!.height &= ~1;
  }
  if (options.proxy) {
    if (!browserOptions.proxy && browserOptions.isChromium && os.platform() === 'win32')
      throw new Error(`Browser needs to be launched with the global proxy. If all contexts override the proxy, global proxy will be never used and can be any string, for example "launch({ proxy: { server: 'http://per-context' } })"`);
    options.proxy = normalizeProxySettings(options.proxy);
  }
  if (debugMode() === 'inspector')
    options.bypassCSP = true;
  verifyGeolocation(options.geolocation);
}

export function verifyGeolocation(geolocation?: types.Geolocation) {
  if (!geolocation)
    return;
  geolocation.accuracy = geolocation.accuracy || 0;
  const { longitude, latitude, accuracy } = geolocation;
  if (longitude < -180 || longitude > 180)
    throw new Error(`geolocation.longitude: precondition -180 <= LONGITUDE <= 180 failed.`);
  if (latitude < -90 || latitude > 90)
    throw new Error(`geolocation.latitude: precondition -90 <= LATITUDE <= 90 failed.`);
  if (accuracy < 0)
    throw new Error(`geolocation.accuracy: precondition 0 <= ACCURACY failed.`);
}

export function normalizeProxySettings(proxy: types.ProxySettings): types.ProxySettings {
  let { server, bypass } = proxy;
  let url;
  try {
    // new URL('127.0.0.1:8080') throws
    // new URL('localhost:8080') fails to parse host or protocol
    // In both of these cases, we need to try re-parse URL with `http://` prefix.
    url = new URL(server);
    if (!url.host || !url.protocol)
      url = new URL('http://' + server);
  } catch (e) {
    url = new URL('http://' + server);
  }
  if (url.protocol === 'socks4:' && (proxy.username || proxy.password))
    throw new Error(`Socks4 proxy protocol does not support authentication`);
  if (url.protocol === 'socks5:' && (proxy.username || proxy.password))
    throw new Error(`Browser does not support socks5 proxy authentication`);
  server = url.protocol + '//' + url.host;
  if (bypass)
    bypass = bypass.split(',').map(t => t.trim()).join(',');
  return { ...proxy, server, bypass };
}

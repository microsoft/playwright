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

import { TimeoutSettings } from '../common/timeoutSettings';
import { createGuid, debugMode } from '../utils';
import { mkdirIfNeeded } from '../utils/fileUtils';
import type { Browser, BrowserOptions } from './browser';
import type { Download } from './download';
import type * as frames from './frames';
import { helper } from './helper';
import * as network from './network';
import { InitScript } from './page';
import type { PageDelegate } from './page';
import { Page, PageBinding } from './page';
import type { Progress, ProgressController } from './progress';
import type { Selectors } from './selectors';
import type * as types from './types';
import type * as channels from '@protocol/channels';
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
import type { Artifact } from './artifact';
import { Clock } from './clock';
import { ClientCertificatesProxy } from './socksClientCertificatesInterceptor';
import { RecorderApp } from './recorder/recorderApp';

export abstract class BrowserContext extends SdkObject {
  static Events = {
    Console: 'console',
    Close: 'close',
    Dialog: 'dialog',
    Page: 'page',
    // Can't use just 'error' due to node.js special treatment of error events.
    // @see https://nodejs.org/api/events.html#events_error_events
    PageError: 'pageerror',
    Request: 'request',
    Response: 'response',
    RequestFailed: 'requestfailed',
    RequestFinished: 'requestfinished',
    RequestAborted: 'requestaborted',
    RequestFulfilled: 'requestfulfilled',
    RequestContinued: 'requestcontinued',
    BeforeClose: 'beforeclose',
    VideoStarted: 'videostarted',
  };

  readonly _timeoutSettings = new TimeoutSettings();
  readonly _pageBindings = new Map<string, PageBinding>();
  readonly _activeProgressControllers = new Set<ProgressController>();
  readonly _options: channels.BrowserNewContextParams;
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
  readonly _harRecorders = new Map<string, HarRecorder>();
  readonly tracing: Tracing;
  readonly fetchRequest: BrowserContextAPIRequestContext;
  private _customCloseHandler?: () => Promise<any>;
  readonly _tempDirs: string[] = [];
  private _settingStorageState = false;
  initScripts: InitScript[] = [];
  private _routesInFlight = new Set<network.Route>();
  private _debugger!: Debugger;
  _closeReason: string | undefined;
  readonly clock: Clock;
  _clientCertificatesProxy: ClientCertificatesProxy | undefined;

  constructor(browser: Browser, options: channels.BrowserNewContextParams, browserContextId: string | undefined) {
    super(browser, 'browser-context');
    this.attribution.context = this;
    this._browser = browser;
    this._options = options;
    this._browserContextId = browserContextId;
    this._isPersistentContext = !browserContextId;
    this._closePromise = new Promise(fulfill => this._closePromiseFulfill = fulfill);

    this.fetchRequest = new BrowserContextAPIRequestContext(this);

    if (this._options.recordHar)
      this._harRecorders.set('', new HarRecorder(this, null, this._options.recordHar));

    this.tracing = new Tracing(this, browser.options.tracesDir);
    this.clock = new Clock(this);
  }

  isPersistentContext(): boolean {
    return this._isPersistentContext;
  }

  setSelectors(selectors: Selectors) {
    this._selectors = selectors;
  }

  selectors(): Selectors {
    return this._selectors || this.attribution.playwright.selectors;
  }

  async _initialize() {
    if (this.attribution.playwright.options.isInternalPlaywright)
      return;
    // Debugger will pause execution upon page.pause in headed mode.
    this._debugger = new Debugger(this);

    // When PWDEBUG=1, show inspector for each context.
    if (debugMode() === 'inspector')
      await Recorder.show(this, RecorderApp.factory(this), { pauseOnNextStatement: true });

    // When paused, show inspector.
    if (this._debugger.isPaused())
      Recorder.showInspector(this, RecorderApp.factory(this));

    this._debugger.on(Debugger.Events.PausedStateChanged, () => {
      if (this._debugger.isPaused())
        Recorder.showInspector(this, RecorderApp.factory(this));
    });

    if (debugMode() === 'console')
      await this.extendInjectedScript(consoleApiSource.source);
    if (this._options.serviceWorkers === 'block')
      await this.addInitScript(`\nif (navigator.serviceWorker) navigator.serviceWorker.register = async () => { console.warn('Service Worker registration blocked by Playwright'); };\n`);

    if (this._options.permissions)
      await this.grantPermissions(this._options.permissions);
  }

  debugger(): Debugger {
    return this._debugger;
  }

  async _ensureVideosPath() {
    if (this._options.recordVideo)
      await mkdirIfNeeded(path.join(this._options.recordVideo.dir, 'dummy'));
  }

  canResetForReuse(): boolean {
    if (this._closedStatus !== 'open')
      return false;
    return true;
  }

  async stopPendingOperations(reason: string) {
    // When using context reuse, stop pending operations to gracefully terminate all the actions
    // with a user-friendly error message containing operation log.
    for (const controller of this._activeProgressControllers)
      controller.abort(new Error(reason));
    // Let rejections in microtask generate events before returning.
    await new Promise(f => setTimeout(f, 0));
  }

  static reusableContextHash(params: channels.BrowserNewContextForReuseParams): string {
    const paramsCopy = { ...params };

    for (const k of Object.keys(paramsCopy)) {
      const key = k as keyof channels.BrowserNewContextForReuseParams;
      if (paramsCopy[key] === defaultNewContextParamValues[key])
        delete paramsCopy[key];
    }

    for (const key of paramsThatAllowContextReuse)
      delete paramsCopy[key];
    return JSON.stringify(paramsCopy);
  }

  async resetForReuse(metadata: CallMetadata, params: channels.BrowserNewContextForReuseParams | null) {
    this.setDefaultNavigationTimeout(undefined);
    this.setDefaultTimeout(undefined);
    this.tracing.resetForReuse();

    if (params) {
      for (const key of paramsThatAllowContextReuse)
        (this._options as any)[key] = params[key];
    }

    await this._cancelAllRoutesInFlight();

    // Close extra pages early.
    let page: Page | undefined = this.pages()[0];
    const [, ...otherPages] = this.pages();
    for (const p of otherPages)
      await p.close(metadata);
    if (page && page.hasCrashed()) {
      await page.close(metadata);
      page = undefined;
    }

    // Unless dialogs are dismissed, setting extra http headers below does not respond.
    page?._frameManager.setCloseAllOpeningDialogs(true);
    await page?._frameManager.closeOpenDialogs();
    // Navigate to about:blank first to ensure no page scripts are running after this point.
    await page?.mainFrame().goto(metadata, 'about:blank', { timeout: 0 });
    page?._frameManager.setCloseAllOpeningDialogs(false);

    await this._resetStorage();
    await this._removeExposedBindings();
    await this._removeInitScripts();
    this.clock.markAsUninstalled();
    // TODO: following can be optimized to not perform noops.
    if (this._options.permissions)
      await this.grantPermissions(this._options.permissions);
    else
      await this.clearPermissions();
    await this.setExtraHTTPHeaders(this._options.extraHTTPHeaders || []);
    await this.setGeolocation(this._options.geolocation);
    await this.setOffline(!!this._options.offline);
    await this.setUserAgent(this._options.userAgent);
    await this.clearCache();
    await this._resetCookies();

    await page?.resetForReuse(metadata);
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
    this._clientCertificatesProxy?.close().catch(() => {});
    this.tracing.abort();
    if (this._isPersistentContext)
      this.onClosePersistent();
    this._closePromiseFulfill!(new Error('Context closed'));
    this.emit(BrowserContext.Events.Close);
  }

  // BrowserContext methods.
  abstract pages(): Page[];
  abstract newPageDelegate(): Promise<PageDelegate>;
  abstract addCookies(cookies: channels.SetNetworkCookie[]): Promise<void>;
  abstract setGeolocation(geolocation?: types.Geolocation): Promise<void>;
  abstract setExtraHTTPHeaders(headers: types.HeadersArray): Promise<void>;
  abstract setUserAgent(userAgent: string | undefined): Promise<void>;
  abstract setOffline(offline: boolean): Promise<void>;
  abstract cancelDownload(uuid: string): Promise<void>;
  abstract clearCache(): Promise<void>;
  protected abstract doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]>;
  protected abstract doClearCookies(): Promise<void>;
  protected abstract doGrantPermissions(origin: string, permissions: string[]): Promise<void>;
  protected abstract doClearPermissions(): Promise<void>;
  protected abstract doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void>;
  protected abstract doAddInitScript(initScript: InitScript): Promise<void>;
  protected abstract doRemoveNonInternalInitScripts(): Promise<void>;
  protected abstract doUpdateRequestInterception(): Promise<void>;
  protected abstract doClose(reason: string | undefined): Promise<void>;
  protected abstract onClosePersistent(): void;

  async cookies(urls: string | string[] | undefined = []): Promise<channels.NetworkCookie[]> {
    if (urls && !Array.isArray(urls))
      urls = [urls];
    return await this.doGetCookies(urls as string[]);
  }

  async clearCookies(options: {name?: string | RegExp, domain?: string | RegExp, path?: string | RegExp}): Promise<void> {
    const currentCookies = await this.cookies();
    await this.doClearCookies();

    const matches = (cookie: channels.NetworkCookie, prop: 'name' | 'domain' | 'path', value: string | RegExp | undefined) => {
      if (!value)
        return true;
      if (value instanceof RegExp) {
        value.lastIndex = 0;
        return value.test(cookie[prop]);
      }
      return cookie[prop] === value;
    };

    const cookiesToReadd = currentCookies.filter(cookie => {
      return !matches(cookie, 'name', options.name)
        || !matches(cookie, 'domain', options.domain)
        || !matches(cookie, 'path', options.path);
    });

    await this.addCookies(cookiesToReadd);
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
    await this.doAddInitScript(binding.initScript);
    const frames = this.pages().map(page => page.frames()).flat();
    await Promise.all(frames.map(frame => frame.evaluateExpression(binding.initScript.source).catch(e => {})));
  }

  async _removeExposedBindings() {
    for (const [key, binding] of this._pageBindings) {
      if (!binding.internal)
        this._pageBindings.delete(key);
    }
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
    const browserName = this._browser.options.name;
    if ((this._options.isMobile && browserName === 'chromium') || (this._options.locale && browserName === 'webkit')) {
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

  async addInitScript(source: string) {
    const initScript = new InitScript(source);
    this.initScripts.push(initScript);
    await this.doAddInitScript(initScript);
  }

  async _removeInitScripts(): Promise<void> {
    this.initScripts = this.initScripts.filter(script => script.internal);
    await this.doRemoveNonInternalInitScripts();
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

  async close(options: { reason?: string }) {
    if (this._closedStatus === 'open') {
      if (options.reason)
        this._closeReason = options.reason;
      this.emit(BrowserContext.Events.BeforeClose);
      this._closedStatus = 'closing';

      for (const harRecorder of this._harRecorders.values())
        await harRecorder.flush();
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
      } else {
        // Close the context.
        await this.doClose(options.reason);
      }

      // We delete downloads after context closure
      // so that browser does not write to the download file anymore.
      promises.push(this._deleteAllDownloads());
      promises.push(this._deleteAllTempDirs());
      await Promise.all(promises);

      // Custom handler should trigger didCloseInternal itself.
      if (!this._customCloseHandler)
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

  async storageState(): Promise<channels.BrowserContextStorageStateResult> {
    const result: channels.BrowserContextStorageStateResult = {
      cookies: await this.cookies(),
      origins: []
    };
    const originsToSave = new Set(this._origins);

    // First try collecting storage stage from existing pages.
    for (const page of this.pages()) {
      const origin = page.mainFrame().origin();
      if (!origin || !originsToSave.has(origin))
        continue;
      try {
        const storage = await page.mainFrame().nonStallingEvaluateInExistingContext(`({
          localStorage: Object.keys(localStorage).map(name => ({ name, value: localStorage.getItem(name) })),
        })`, 'utility');
        if (storage.localStorage.length)
          result.origins.push({ origin, localStorage: storage.localStorage } as channels.OriginStorage);
        originsToSave.delete(origin);
      } catch {
        // When failed on the live page, we'll retry on the blank page below.
      }
    }

    // If there are still origins to save, create a blank page to iterate over origins.
    if (originsToSave.size)  {
      const internalMetadata = serverSideCallMetadata();
      const page = await this.newPage(internalMetadata);
      await page._setServerRequestInterceptor(handler => {
        handler.fulfill({ body: '<html></html>', requestUrl: handler.request().url() }).catch(() => {});
        return true;
      });
      for (const origin of originsToSave) {
        const originStorage: channels.OriginStorage = { origin, localStorage: [] };
        const frame = page.mainFrame();
        await frame.goto(internalMetadata, origin);
        const storage = await frame.evaluateExpression(`({
          localStorage: Object.keys(localStorage).map(name => ({ name, value: localStorage.getItem(name) })),
        })`, { world: 'utility' });
        originStorage.localStorage = storage.localStorage;
        if (storage.localStorage.length)
          result.origins.push(originStorage);
      }
      await page.close(internalMetadata);
    }
    return result;
  }

  async _resetStorage() {
    const oldOrigins = this._origins;
    const newOrigins = new Map(this._options.storageState?.origins?.map(p => [p.origin, p]) || []);
    if (!oldOrigins.size && !newOrigins.size)
      return;
    let page = this.pages()[0];

    const internalMetadata = serverSideCallMetadata();
    page = page || await this.newPage({
      ...internalMetadata,
      // Do not mark this page as internal, because we will leave it for later reuse
      // as a user-visible page.
      isServerSide: false,
    });
    await page._setServerRequestInterceptor(handler => {
      handler.fulfill({ body: '<html></html>', requestUrl: handler.request().url() }).catch(() => {});
      return true;
    });

    for (const origin of new Set([...oldOrigins, ...newOrigins.keys()])) {
      const frame = page.mainFrame();
      await frame.goto(internalMetadata, origin);
      await frame.resetStorageForCurrentOriginBestEffort(newOrigins.get(origin));
    }

    await page._setServerRequestInterceptor(undefined);

    this._origins = new Set([...newOrigins.keys()]);
    // It is safe to not restore the URL to about:blank since we are doing it in Page::resetForReuse.
  }

  async _resetCookies() {
    await this.doClearCookies();
    if (this._options.storageState?.cookies)
      await this.addCookies(this._options.storageState?.cookies);
  }

  isSettingStorageState(): boolean {
    return this._settingStorageState;
  }

  async setStorageState(metadata: CallMetadata, state: NonNullable<channels.BrowserNewContextParams['storageState']>) {
    this._settingStorageState = true;
    try {
      if (state.cookies)
        await this.addCookies(state.cookies);
      if (state.origins && state.origins.length)  {
        const internalMetadata = serverSideCallMetadata();
        const page = await this.newPage(internalMetadata);
        await page._setServerRequestInterceptor(handler => {
          handler.fulfill({ body: '<html></html>', requestUrl: handler.request().url() }).catch(() => {});
          return true;
        });
        for (const originState of state.origins) {
          const frame = page.mainFrame();
          await frame.goto(metadata, originState.origin);
          await frame.evaluateExpression(`
            originState => {
              for (const { name, value } of (originState.localStorage || []))
                localStorage.setItem(name, value);
            }`, { isFunction: true, world: 'utility' }, originState);
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

  async safeNonStallingEvaluateInAllFrames(expression: string, world: types.World, options: { throwOnJSErrors?: boolean } = {}) {
    await Promise.all(this.pages().map(page => page.safeNonStallingEvaluateInAllFrames(expression, world, options)));
  }

  async _harStart(page: Page | null, options: channels.RecordHarOptions): Promise<string> {
    const harId = createGuid();
    this._harRecorders.set(harId, new HarRecorder(this, page, options));
    return harId;
  }

  async _harExport(harId: string | undefined): Promise<Artifact> {
    const recorder = this._harRecorders.get(harId || '')!;
    return recorder.export();
  }

  addRouteInFlight(route: network.Route) {
    this._routesInFlight.add(route);
  }

  removeRouteInFlight(route: network.Route) {
    this._routesInFlight.delete(route);
  }

  async _cancelAllRoutesInFlight() {
    await Promise.all([...this._routesInFlight].map(r => r.abort())).catch(() => {});
    this._routesInFlight.clear();
  }
}

export function assertBrowserContextIsNotOwned(context: BrowserContext) {
  for (const page of context.pages()) {
    if (page._ownedContext)
      throw new Error('Please use browser.newContext() for multi-page scripts that share the context.');
  }
}

export async function createClientCertificatesProxyIfNeeded(options: channels.BrowserNewContextOptions, browserOptions?: BrowserOptions) {
  if (!options.clientCertificates?.length)
    return;
  if ((options.proxy?.server && options.proxy?.server !== 'per-context') || (browserOptions?.proxy?.server && browserOptions?.proxy?.server !== 'http://per-context'))
    throw new Error('Cannot specify both proxy and clientCertificates');
  verifyClientCertificates(options.clientCertificates);
  const clientCertificatesProxy = new ClientCertificatesProxy(options);
  options.proxy = { server: await clientCertificatesProxy.listen() };
  options.ignoreHTTPSErrors = true;
  return clientCertificatesProxy;
}

export function validateBrowserContextOptions(options: channels.BrowserNewContextParams, browserOptions: BrowserOptions) {
  if (options.noDefaultViewport && options.deviceScaleFactor !== undefined)
    throw new Error(`"deviceScaleFactor" option is not supported with null "viewport"`);
  if (options.noDefaultViewport && !!options.isMobile)
    throw new Error(`"isMobile" option is not supported with null "viewport"`);
  if (options.acceptDownloads === undefined && browserOptions.name !== 'electron')
    options.acceptDownloads = 'accept';
  // Electron requires explicit acceptDownloads: true since we wait for
  // https://github.com/electron/electron/pull/41718 to be widely shipped.
  // In 6-12 months, we can remove this check.
  else if (options.acceptDownloads === undefined && browserOptions.name === 'electron')
    options.acceptDownloads = 'internal-browser-default';
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
  if (options.proxy)
    options.proxy = normalizeProxySettings(options.proxy);
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

export function verifyClientCertificates(clientCertificates?: channels.BrowserNewContextParams['clientCertificates']) {
  if (!clientCertificates)
    return;
  for (const cert of clientCertificates) {
    if (!cert.origin)
      throw new Error(`clientCertificates.origin is required`);
    if (!cert.cert && !cert.key && !cert.passphrase && !cert.pfx)
      throw new Error('None of cert, key, passphrase or pfx is specified');
    if (cert.cert && !cert.key)
      throw new Error('cert is specified without key');
    if (!cert.cert && cert.key)
      throw new Error('key is specified without cert');
    if (cert.pfx && (cert.cert || cert.key))
      throw new Error('pfx is specified together with cert, key or passphrase');
  }
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

const paramsThatAllowContextReuse: (keyof channels.BrowserNewContextForReuseParams)[] = [
  'colorScheme',
  'forcedColors',
  'reducedMotion',
  'screen',
  'userAgent',
  'viewport',
];

const defaultNewContextParamValues: channels.BrowserNewContextForReuseParams = {
  noDefaultViewport: false,
  ignoreHTTPSErrors: false,
  javaScriptEnabled: true,
  bypassCSP: false,
  offline: false,
  isMobile: false,
  hasTouch: false,
  acceptDownloads: 'accept',
  strictSelectors: false,
  serviceWorkers: 'allow',
  locale: 'en-US',
};

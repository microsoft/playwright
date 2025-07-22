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

import fs from 'fs';
import path from 'path';

import { createGuid } from './utils/crypto';
import { debugMode } from './utils/debug';
import { Clock } from './clock';
import { Debugger } from './debugger';
import { DialogManager } from './dialog';
import { BrowserContextAPIRequestContext } from './fetch';
import { mkdirIfNeeded } from './utils/fileUtils';
import { HarRecorder } from './har/harRecorder';
import { helper } from './helper';
import { SdkObject } from './instrumentation';
import * as network from './network';
import { InitScript } from './page';
import { Page, PageBinding } from './page';
import { RecorderApp } from './recorder/recorderApp';
import { Selectors } from './selectors';
import { Tracing } from './trace/recorder/tracing';
import * as rawStorageSource from '../generated/storageScriptSource';

import type { Artifact } from './artifact';
import type { Browser, BrowserOptions } from './browser';
import type { Download } from './download';
import type * as frames from './frames';
import type { Progress } from './progress';
import type { ClientCertificatesProxy } from './socksClientCertificatesInterceptor';
import type { SerializedStorage } from '@injected/storageScript';
import type * as types from './types';
import type * as channels from '@protocol/channels';

export abstract class BrowserContext extends SdkObject {
  static Events = {
    Console: 'console',
    Close: 'close',
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
    RecorderEvent: 'recorderevent',
  };

  readonly _pageBindings = new Map<string, PageBinding>();
  readonly _options: types.BrowserContextOptions;
  readonly requestInterceptors: network.RouteHandler[] = [];
  private _isPersistentContext: boolean;
  private _closedStatus: 'open' | 'closing' | 'closed' = 'open';
  readonly _closePromise: Promise<Error>;
  private _closePromiseFulfill: ((error: Error) => void) | undefined;
  readonly _permissions = new Map<string, string[]>();
  readonly _downloads = new Set<Download>();
  readonly _browser: Browser;
  readonly _browserContextId: string | undefined;
  private _selectors: Selectors;
  private _origins = new Set<string>();
  readonly _harRecorders = new Map<string, HarRecorder>();
  readonly tracing: Tracing;
  readonly fetchRequest: BrowserContextAPIRequestContext;
  private _customCloseHandler?: () => Promise<any>;
  readonly _tempDirs: string[] = [];
  private _settingStorageState = false;
  bindingsInitScript?: InitScript;
  initScripts: InitScript[] = [];
  private _routesInFlight = new Set<network.Route>();
  private _debugger!: Debugger;
  _closeReason: string | undefined;
  readonly clock: Clock;
  _clientCertificatesProxy: ClientCertificatesProxy | undefined;
  private _playwrightBindingExposed = false;
  readonly dialogManager: DialogManager;

  constructor(browser: Browser, options: types.BrowserContextOptions, browserContextId: string | undefined) {
    super(browser, 'browser-context');
    this.attribution.context = this;
    this._browser = browser;
    this._options = options;
    this._browserContextId = browserContextId;
    this._isPersistentContext = !browserContextId;
    this._closePromise = new Promise(fulfill => this._closePromiseFulfill = fulfill);
    this._selectors = new Selectors(options.selectorEngines || [], options.testIdAttributeName);

    this.fetchRequest = new BrowserContextAPIRequestContext(this);
    this.tracing = new Tracing(this, browser.options.tracesDir);
    this.clock = new Clock(this);
    this.dialogManager = new DialogManager(this.instrumentation);
  }

  isPersistentContext(): boolean {
    return this._isPersistentContext;
  }

  selectors(): Selectors {
    return this._selectors;
  }

  async _initialize() {
    if (this.attribution.playwright.options.isInternalPlaywright)
      return;
    // Debugger will pause execution upon page.pause in headed mode.
    this._debugger = new Debugger(this);

    // When PWDEBUG=1, show inspector for each context.
    if (debugMode() === 'inspector')
      await RecorderApp.show(this, { pauseOnNextStatement: true });

    // When paused, show inspector.
    if (this._debugger.isPaused())
      RecorderApp.showInspectorNoReply(this);

    this._debugger.on(Debugger.Events.PausedStateChanged, () => {
      if (this._debugger.isPaused())
        RecorderApp.showInspectorNoReply(this);
    });

    if (debugMode() === 'console') {
      await this.extendInjectedScript(`
        function installConsoleApi(injectedScript) { injectedScript.consoleApi.install(); }
        module.exports = { default: () => installConsoleApi };
      `);
    }
    if (this._options.serviceWorkers === 'block')
      await this.addInitScript(undefined, `\nif (navigator.serviceWorker) navigator.serviceWorker.register = async () => { console.warn('Service Worker registration blocked by Playwright'); };\n`);

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

  static reusableContextHash(params: channels.BrowserNewContextForReuseParams): string {
    const paramsCopy = { ...params };

    if (paramsCopy.selectorEngines?.length === 0)
      delete paramsCopy.selectorEngines;

    for (const k of Object.keys(paramsCopy)) {
      const key = k as keyof channels.BrowserNewContextForReuseParams;
      if (paramsCopy[key] === defaultNewContextParamValues[key])
        delete paramsCopy[key];
    }

    for (const key of paramsThatAllowContextReuse)
      delete paramsCopy[key];
    return JSON.stringify(paramsCopy);
  }

  async resetForReuse(progress: Progress, params: channels.BrowserNewContextForReuseParams | null) {
    await this.tracing.resetForReuse(progress);

    if (params) {
      for (const key of paramsThatAllowContextReuse)
        (this._options as any)[key] = params[key];
      if (params.testIdAttributeName)
        this.selectors().setTestIdAttributeName(params.testIdAttributeName);
    }

    // Close extra pages early.
    let page: Page | undefined = this.pages()[0];
    const otherPages = this.possiblyUninitializedPages().filter(p => p !== page);
    for (const p of otherPages)
      await p.close();
    if (page && page.hasCrashed()) {
      await page.close();
      page = undefined;
    }

    // Navigate to about:blank first to ensure no page scripts are running after this point.
    await page?.mainFrame().gotoImpl(progress, 'about:blank', {});

    // Note: we only need to reset properties from the "paramsThatAllowContextReuse" list.
    // All other properties force a new context.
    await this._resetStorage(progress);
    await progress.race(this.clock.resetForReuse());
    await progress.race(this.setUserAgent(this._options.userAgent));
    await progress.race(this.clearCache());
    await progress.race(this.doClearCookies());
    await progress.race(this.doUpdateDefaultEmulatedMedia());
    await progress.race(this.doUpdateDefaultViewport());
    if (this._options.storageState?.cookies)
      await progress.race(this.addCookies(this._options.storageState?.cookies));

    await page?.resetForReuse(progress);
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

  pages(): Page[] {
    return this.possiblyUninitializedPages().filter(page => page.initializedOrUndefined());
  }

  // BrowserContext methods.
  abstract possiblyUninitializedPages(): Page[];
  abstract doCreateNewPage(markAsServerSideOnly?: boolean): Promise<Page>;
  abstract addCookies(cookies: channels.SetNetworkCookie[]): Promise<void>;
  abstract setGeolocation(geolocation?: types.Geolocation): Promise<void>;
  abstract setUserAgent(userAgent: string | undefined): Promise<void>;
  abstract cancelDownload(uuid: string): Promise<void>;
  abstract clearCache(): Promise<void>;
  protected abstract doGetCookies(urls: string[]): Promise<channels.NetworkCookie[]>;
  protected abstract doClearCookies(): Promise<void>;
  protected abstract doGrantPermissions(origin: string, permissions: string[]): Promise<void>;
  protected abstract doClearPermissions(): Promise<void>;
  protected abstract doSetHTTPCredentials(httpCredentials?: types.Credentials): Promise<void>;
  protected abstract doAddInitScript(initScript: InitScript): Promise<void>;
  protected abstract doRemoveInitScripts(initScripts: InitScript[]): Promise<void>;
  protected abstract doUpdateExtraHTTPHeaders(): Promise<void>;
  protected abstract doUpdateOffline(): Promise<void>;
  protected abstract doUpdateRequestInterception(): Promise<void>;
  protected abstract doUpdateDefaultViewport(): Promise<void>;
  protected abstract doUpdateDefaultEmulatedMedia(): Promise<void>;
  protected abstract doExposePlaywrightBinding(): Promise<void>;
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

  getBindingClient(name: string): unknown | undefined {
    return this._pageBindings.get(name)?.forClient;
  }

  async exposePlaywrightBindingIfNeeded() {
    if (this._playwrightBindingExposed)
      return;
    this._playwrightBindingExposed = true;
    await this.doExposePlaywrightBinding();

    this.bindingsInitScript = PageBinding.createInitScript();
    this.initScripts.push(this.bindingsInitScript);
    await this.doAddInitScript(this.bindingsInitScript);
    await this.safeNonStallingEvaluateInAllFrames(this.bindingsInitScript.source, 'main');
  }

  needsPlaywrightBinding() {
    return this._playwrightBindingExposed;
  }

  async exposeBinding(progress: Progress, name: string, needsHandle: boolean, playwrightBinding: frames.FunctionWithSource, forClient?: unknown): Promise<PageBinding> {
    if (this._pageBindings.has(name))
      throw new Error(`Function "${name}" has been already registered`);
    for (const page of this.pages()) {
      if (page.getBinding(name))
        throw new Error(`Function "${name}" has been already registered in one of the pages`);
    }
    await progress.race(this.exposePlaywrightBindingIfNeeded());
    const binding = new PageBinding(name, playwrightBinding, needsHandle);
    binding.forClient = forClient;
    this._pageBindings.set(name, binding);
    progress.cleanupWhenAborted(() => this._pageBindings.delete(name));
    await progress.race(this.doAddInitScript(binding.initScript));
    await progress.race(this.safeNonStallingEvaluateInAllFrames(binding.initScript.source, 'main'));
    return binding;
  }

  async removeExposedBindings(bindings: PageBinding[]) {
    bindings = bindings.filter(binding => this._pageBindings.get(binding.name) === binding);
    for (const binding of bindings)
      this._pageBindings.delete(binding.name);
    await this.doRemoveInitScripts(bindings.map(binding => binding.initScript));
    const cleanup = bindings.map(binding => `{ ${binding.cleanupScript} };\n`).join('');
    await this.safeNonStallingEvaluateInAllFrames(cleanup, 'main');
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

  async setExtraHTTPHeaders(progress: Progress, headers: types.HeadersArray) {
    const oldHeaders = this._options.extraHTTPHeaders;
    this._options.extraHTTPHeaders = headers;
    progress.cleanupWhenAborted(async () => {
      this._options.extraHTTPHeaders = oldHeaders;
      await this.doUpdateExtraHTTPHeaders();
    });
    await progress.race(this.doUpdateExtraHTTPHeaders());
  }

  async setOffline(progress: Progress, offline: boolean) {
    const oldOffline = this._options.offline;
    this._options.offline = offline;
    progress.cleanupWhenAborted(async () => {
      this._options.offline = oldOffline;
      await this.doUpdateOffline();
    });
    await progress.race(this.doUpdateOffline());
  }

  async _loadDefaultContextAsIs(progress: Progress): Promise<Page | undefined> {
    if (!this.possiblyUninitializedPages().length) {
      const waitForEvent = helper.waitForEvent(progress, this, BrowserContext.Events.Page);
      // Race against BrowserContext.close
      await Promise.race([waitForEvent.promise, this._closePromise]);
    }
    const page = this.possiblyUninitializedPages()[0];
    if (!page)
      return;
    const pageOrError = await progress.race(page.waitForInitializedOrError());
    if (pageOrError instanceof Error)
      throw pageOrError;
    await page.mainFrame()._waitForLoadState(progress, 'load');
    return page;
  }

  async _loadDefaultContext(progress: Progress) {
    const defaultPage = await this._loadDefaultContextAsIs(progress);
    if (!defaultPage)
      return;
    const browserName = this._browser.options.name;
    if ((this._options.isMobile && browserName === 'chromium') || (this._options.locale && browserName === 'webkit')) {
      // Workaround for:
      // - chromium fails to change isMobile for existing page;
      // - webkit fails to change locale for existing page.
      await this.newPage(progress, false);
      await defaultPage.close();
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

  async addInitScript(progress: Progress | undefined, source: string) {
    const initScript = new InitScript(source);
    this.initScripts.push(initScript);
    progress?.cleanupWhenAborted(() => this.removeInitScripts([initScript]));
    const promise = this.doAddInitScript(initScript);
    if (progress)
      await progress.race(promise);
    else
      await promise;
    return initScript;
  }

  async removeInitScripts(initScripts: InitScript[]) {
    const set = new Set(initScripts);
    this.initScripts = this.initScripts.filter(script => !set.has(script));
    await this.doRemoveInitScripts(initScripts);
  }

  async addRequestInterceptor(progress: Progress, handler: network.RouteHandler): Promise<void> {
    // Note: progress is intentionally ignored, because this operation is not cancellable and should not block in the browser anyway.
    this.requestInterceptors.push(handler);
    await this.doUpdateRequestInterception();
  }

  async removeRequestInterceptor(handler: network.RouteHandler): Promise<void> {
    const index = this.requestInterceptors.indexOf(handler);
    if (index === -1)
      return;
    this.requestInterceptors.splice(index, 1);
    await this.notifyRoutesInFlightAboutRemovedHandler(handler);
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

  async newPage(progress: Progress, isServerSide: boolean): Promise<Page> {
    const page = await progress.raceWithCleanup(this.doCreateNewPage(isServerSide), page => page.close());
    const pageOrError = await progress.race(page.waitForInitializedOrError());
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

  async storageState(progress: Progress, indexedDB = false): Promise<channels.BrowserContextStorageStateResult> {
    const result: channels.BrowserContextStorageStateResult = {
      cookies: await this.cookies(),
      origins: []
    };
    const originsToSave = new Set(this._origins);

    const collectScript = `(() => {
      const module = {};
      ${rawStorageSource.source}
      const script = new (module.exports.StorageScript())(${this._browser.options.name === 'firefox'});
      return script.collect(${indexedDB});
    })()`;

    // First try collecting storage stage from existing pages.
    for (const page of this.pages()) {
      const origin = page.mainFrame().origin();
      if (!origin || !originsToSave.has(origin))
        continue;
      try {
        const storage: SerializedStorage = await page.mainFrame().nonStallingEvaluateInExistingContext(collectScript, 'utility');
        if (storage.localStorage.length || storage.indexedDB?.length)
          result.origins.push({ origin, localStorage: storage.localStorage, indexedDB: storage.indexedDB });
        originsToSave.delete(origin);
      } catch {
        // When failed on the live page, we'll retry on the blank page below.
      }
    }

    // If there are still origins to save, create a blank page to iterate over origins.
    if (originsToSave.size)  {
      const page = await this.newPage(progress, true);
      await page.addRequestInterceptor(progress, route => {
        route.fulfill({ body: '<html></html>' }).catch(() => {});
      }, 'prepend');
      for (const origin of originsToSave) {
        const frame = page.mainFrame();
        await frame.gotoImpl(progress, origin, {});
        const storage: SerializedStorage = await progress.race(frame.evaluateExpression(collectScript, { world: 'utility' }));
        if (storage.localStorage.length || storage.indexedDB?.length)
          result.origins.push({ origin, localStorage: storage.localStorage, indexedDB: storage.indexedDB });
      }
      await page.close();
    }
    return result;
  }

  async _resetStorage(progress: Progress) {
    const oldOrigins = this._origins;
    const newOrigins = new Map(this._options.storageState?.origins?.map(p => [p.origin, p]) || []);
    if (!oldOrigins.size && !newOrigins.size)
      return;
    let page = this.pages()[0];

    // Do not mark this page as internal, because we will leave it for later reuse
    // as a user-visible page.
    page = page || await this.newPage(progress, false);
    const interceptor = (route: network.Route) => {
      route.fulfill({ body: '<html></html>' }).catch(() => {});
    };

    progress.cleanupWhenAborted(() => page.removeRequestInterceptor(interceptor));
    await page.addRequestInterceptor(progress, interceptor, 'prepend');

    for (const origin of new Set([...oldOrigins, ...newOrigins.keys()])) {
      const frame = page.mainFrame();
      await frame.gotoImpl(progress, origin, {});
      await progress.race(frame.resetStorageForCurrentOriginBestEffort(newOrigins.get(origin)));
    }

    await page.removeRequestInterceptor(interceptor);

    this._origins = new Set([...newOrigins.keys()]);
    // It is safe to not restore the URL to about:blank since we are doing it in Page::resetForReuse.
  }

  isSettingStorageState(): boolean {
    return this._settingStorageState;
  }

  async setStorageState(progress: Progress, state: NonNullable<channels.BrowserNewContextParams['storageState']>) {
    this._settingStorageState = true;
    try {
      if (state.cookies)
        await progress.race(this.addCookies(state.cookies));
      if (state.origins && state.origins.length)  {
        const page = await this.newPage(progress, true);
        await page.addRequestInterceptor(progress, route => {
          route.fulfill({ body: '<html></html>' }).catch(() => {});
        }, 'prepend');
        for (const originState of state.origins) {
          const frame = page.mainFrame();
          await frame.gotoImpl(progress, originState.origin, {});
          const restoreScript = `(() => {
            const module = {};
            ${rawStorageSource.source}
            const script = new (module.exports.StorageScript())(${this._browser.options.name === 'firefox'});
            return script.restore(${JSON.stringify(originState)});
          })()`;
          await progress.race(frame.evaluateExpression(restoreScript, { world: 'utility' }));
        }
        await page.close();
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

  harStart(page: Page | null, options: channels.RecordHarOptions): string {
    const harId = createGuid();
    this._harRecorders.set(harId, new HarRecorder(this, page, options));
    return harId;
  }

  async harExport(harId: string | undefined): Promise<Artifact> {
    const recorder = this._harRecorders.get(harId || '')!;
    return recorder.export();
  }

  addRouteInFlight(route: network.Route) {
    this._routesInFlight.add(route);
  }

  removeRouteInFlight(route: network.Route) {
    this._routesInFlight.delete(route);
  }

  async notifyRoutesInFlightAboutRemovedHandler(handler: network.RouteHandler): Promise<void> {
    await Promise.all([...this._routesInFlight].map(route => route.removeHandler(handler)));
  }
}

export function validateBrowserContextOptions(options: types.BrowserContextOptions, browserOptions: BrowserOptions) {
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

export function verifyGeolocation(geolocation?: types.Geolocation): asserts geolocation is types.Geolocation {
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

export function verifyClientCertificates(clientCertificates?: types.BrowserContextOptions['clientCertificates']) {
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
  'contrast',
  'screen',
  'userAgent',
  'viewport',
  'testIdAttributeName',
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

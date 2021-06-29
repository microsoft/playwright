/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {EventEmitter} = ChromeUtils.import('resource://gre/modules/EventEmitter.jsm');
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {SimpleChannel} = ChromeUtils.import('chrome://juggler/content/SimpleChannel.js');
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {Preferences} = ChromeUtils.import("resource://gre/modules/Preferences.jsm");
const {ContextualIdentityService} = ChromeUtils.import("resource://gre/modules/ContextualIdentityService.jsm");
const {NetUtil} = ChromeUtils.import('resource://gre/modules/NetUtil.jsm');
const {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");
const {OS} = ChromeUtils.import("resource://gre/modules/osfile.jsm");

const Cr = Components.results;

const helper = new Helper();

const IDENTITY_NAME = 'JUGGLER ';
const HUNDRED_YEARS = 60 * 60 * 24 * 365 * 100;

const ALL_PERMISSIONS = [
  'geo',
  'desktop-notification',
];

class DownloadInterceptor {
  constructor(registry) {
    this._registry = registry
    this._handlerToUuid = new Map();
    this._uuidToHandler = new Map();
  }

  //
  // nsIDownloadInterceptor implementation.
  //
  interceptDownloadRequest(externalAppHandler, request, browsingContext, outFile) {
    if (!(request instanceof Ci.nsIChannel))
      return false;
    const channel = request.QueryInterface(Ci.nsIChannel);
    let pageTarget = this._registry._browserBrowsingContextToTarget.get(channel.loadInfo.browsingContext);
    if (!pageTarget)
      return false;

    const browserContext = pageTarget.browserContext();
    const options = browserContext.downloadOptions;
    if (!options)
      return false;

    const uuid = helper.generateId();
    let file = null;
    if (options.behavior === 'saveToDisk') {
      file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(options.downloadsDir);
      file.append(uuid);

      try {
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
      } catch (e) {
        dump(`interceptDownloadRequest failed to create file: ${e}\n`);
        return false;
      }
    }
    outFile.value = file;
    this._handlerToUuid.set(externalAppHandler, uuid);
    this._uuidToHandler.set(uuid, externalAppHandler);
    const downloadInfo = {
      uuid,
      browserContextId: browserContext.browserContextId,
      pageTargetId: pageTarget.id(),
      url: request.name,
      suggestedFileName: externalAppHandler.suggestedFileName,
    };
    this._registry.emit(TargetRegistry.Events.DownloadCreated, downloadInfo);
    return true;
  }

  onDownloadComplete(externalAppHandler, canceled, errorName) {
    const uuid = this._handlerToUuid.get(externalAppHandler);
    if (!uuid)
      return;
    this._handlerToUuid.delete(externalAppHandler);
    this._uuidToHandler.delete(uuid);
    const downloadInfo = {
      uuid,
      error: errorName,
    };
    if (canceled === 'NS_BINDING_ABORTED') {
      downloadInfo.canceled = true;
    }
    this._registry.emit(TargetRegistry.Events.DownloadFinished, downloadInfo);
  }

  async cancelDownload(uuid) {
    const externalAppHandler = this._uuidToHandler.get(uuid);
    if (!externalAppHandler) {
      return;
    }
    await externalAppHandler.cancel(Cr.NS_BINDING_ABORTED);
  }
}

const screencastService = Cc['@mozilla.org/juggler/screencast;1'].getService(Ci.nsIScreencastService);

class TargetRegistry {
  constructor() {
    EventEmitter.decorate(this);

    this._browserContextIdToBrowserContext = new Map();
    this._userContextIdToBrowserContext = new Map();
    this._browserToTarget = new Map();
    this._browserBrowsingContextToTarget = new Map();

    this._browserProxy = null;

    // Cleanup containers from previous runs (if any)
    for (const identity of ContextualIdentityService.getPublicIdentities()) {
      if (identity.name && identity.name.startsWith(IDENTITY_NAME)) {
        ContextualIdentityService.remove(identity.userContextId);
        ContextualIdentityService.closeContainerTabs(identity.userContextId);
      }
    }

    this._defaultContext = new BrowserContext(this, undefined, undefined);

    Services.obs.addObserver({
      observe: (subject, topic, data) => {
        const browser = subject.ownerElement;
        if (!browser)
          return;
        const target = this._browserToTarget.get(browser);
        if (!target)
          return;
        target.emit(PageTarget.Events.Crashed);
        target.dispose();
      }
    }, 'oop-frameloader-crashed');

    Services.mm.addMessageListener('juggler:content-ready', {
      receiveMessage: message => {
        const linkedBrowser = message.target;
        const target = this._browserToTarget.get(linkedBrowser);
        if (!target)
          return;

        return {
          scriptsToEvaluateOnNewDocument: target.browserContext().scriptsToEvaluateOnNewDocument,
          bindings: target.browserContext().bindings,
          settings: target.browserContext().settings,
        };
      },
    });

    const onTabOpenListener = (appWindow, window, event) => {
      const tab = event.target;
      const userContextId = tab.userContextId;
      const browserContext = this._userContextIdToBrowserContext.get(userContextId);
      const hasExplicitSize = appWindow && (appWindow.chromeFlags & Ci.nsIWebBrowserChrome.JUGGLER_WINDOW_EXPLICIT_SIZE) !== 0;
      const openerContext = tab.linkedBrowser.browsingContext.opener;
      let openerTarget;
      if (openerContext) {
        // Popups usually have opener context.
        openerTarget = this._browserBrowsingContextToTarget.get(openerContext);
      } else if (tab.openerTab) {
        // Noopener popups from the same window have opener tab instead.
        openerTarget = this._browserToTarget.get(tab.openerTab.linkedBrowser);
      }
      if (!browserContext)
        throw new Error(`Internal error: cannot find context for userContextId=${userContextId}`);
      const target = new PageTarget(this, window, tab, browserContext, openerTarget);
      target.updateUserAgent();
      target.updateTouchOverride();
      target.updateColorSchemeOverride();
      target.updateReducedMotionOverride();
      target.updateForcedColorsOverride();
      if (!hasExplicitSize)
        target.updateViewportSize();
      if (browserContext.videoRecordingOptions)
        target._startVideoRecording(browserContext.videoRecordingOptions);
    };

    const onTabCloseListener = event => {
      const tab = event.target;
      const linkedBrowser = tab.linkedBrowser;
      const target = this._browserToTarget.get(linkedBrowser);
      if (target)
          target.dispose();
    };

    const domWindowTabListeners = new Map();

    const onOpenWindow = async (appWindow) => {

      let domWindow;
      if (appWindow instanceof Ci.nsIAppWindow) {
        domWindow = appWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
      } else {
        domWindow = appWindow;
        appWindow = null;
      }
      if (!(domWindow instanceof Ci.nsIDOMChromeWindow))
        return;
      // In persistent mode, window might be opened long ago and might be
      // already initialized.
      //
      // In this case, we want to keep this callback synchronous so that we will call
      // `onTabOpenListener` synchronously and before the sync IPc message `juggler:content-ready`.
      if (domWindow.document.readyState === 'uninitialized' || domWindow.document.readyState === 'loading') {
        // For non-initialized windows, DOMContentLoaded initializes gBrowser
        // and starts tab loading (see //browser/base/content/browser.js), so we
        // are guaranteed to call `onTabOpenListener` before the sync IPC message
        // `juggler:content-ready`.
        await helper.awaitEvent(domWindow, 'DOMContentLoaded');
      }

      if (!domWindow.gBrowser)
        return;
      const tabContainer = domWindow.gBrowser.tabContainer;
      domWindowTabListeners.set(domWindow, [
        helper.addEventListener(tabContainer, 'TabOpen', event => onTabOpenListener(appWindow, domWindow, event)),
        helper.addEventListener(tabContainer, 'TabClose', onTabCloseListener),
      ]);
      for (const tab of domWindow.gBrowser.tabs)
        onTabOpenListener(appWindow, domWindow, { target: tab });
    };

    const onCloseWindow = window => {
      const domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
      if (!(domWindow instanceof Ci.nsIDOMChromeWindow))
        return;
      if (!domWindow.gBrowser)
        return;

      const listeners = domWindowTabListeners.get(domWindow) || [];
      domWindowTabListeners.delete(domWindow);
      helper.removeListeners(listeners);
      for (const tab of domWindow.gBrowser.tabs)
        onTabCloseListener({ target: tab });
    };

    const extHelperAppSvc = Cc["@mozilla.org/uriloader/external-helper-app-service;1"].getService(Ci.nsIExternalHelperAppService);
    this._downloadInterceptor = new DownloadInterceptor(this);
    extHelperAppSvc.setDownloadInterceptor(this._downloadInterceptor);

    Services.wm.addListener({ onOpenWindow, onCloseWindow });
    for (const win of Services.wm.getEnumerator(null))
      onOpenWindow(win);
  }

  async cancelDownload(options) {
    this._downloadInterceptor.cancelDownload(options.uuid);
  }

  setBrowserProxy(proxy) {
    this._browserProxy = proxy;
  }

  getProxyInfo(channel) {
    const originAttributes = channel.loadInfo && channel.loadInfo.originAttributes;
    const browserContext = originAttributes ? this.browserContextForUserContextId(originAttributes.userContextId) : null;
    // Prefer context proxy and fallback to browser-level proxy.
    const proxyInfo = (browserContext && browserContext._proxy) || this._browserProxy;
    if (!proxyInfo || proxyInfo.bypass.some(domainSuffix => channel.URI.host.endsWith(domainSuffix)))
      return null;
    return proxyInfo;
  }

  defaultContext() {
    return this._defaultContext;
  }

  createBrowserContext(removeOnDetach) {
    return new BrowserContext(this, helper.generateId(), removeOnDetach);
  }

  browserContextForId(browserContextId) {
    return this._browserContextIdToBrowserContext.get(browserContextId);
  }

  browserContextForUserContextId(userContextId) {
    return this._userContextIdToBrowserContext.get(userContextId);
  }

  async newPage({browserContextId}) {
    const browserContext = this.browserContextForId(browserContextId);
    const features = "chrome,dialog=no,all";
    // See _callWithURIToLoad in browser.js for the structure of window.arguments
    // window.arguments[1]: unused (bug 871161)
    //                 [2]: referrerInfo (nsIReferrerInfo)
    //                 [3]: postData (nsIInputStream)
    //                 [4]: allowThirdPartyFixup (bool)
    //                 [5]: userContextId (int)
    //                 [6]: originPrincipal (nsIPrincipal)
    //                 [7]: originStoragePrincipal (nsIPrincipal)
    //                 [8]: triggeringPrincipal (nsIPrincipal)
    //                 [9]: allowInheritPrincipal (bool)
    //                 [10]: csp (nsIContentSecurityPolicy)
    //                 [11]: nsOpenWindowInfo
    const args = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    const urlSupports = Cc["@mozilla.org/supports-string;1"].createInstance(
      Ci.nsISupportsString
    );
    urlSupports.data = 'about:blank';
    args.appendElement(urlSupports); // 0
    args.appendElement(undefined); // 1
    args.appendElement(undefined); // 2
    args.appendElement(undefined); // 3
    args.appendElement(undefined); // 4
    const userContextIdSupports = Cc[
      "@mozilla.org/supports-PRUint32;1"
    ].createInstance(Ci.nsISupportsPRUint32);
    userContextIdSupports.data = browserContext.userContextId;
    args.appendElement(userContextIdSupports); // 5
    args.appendElement(undefined); // 6
    args.appendElement(undefined); // 7
    args.appendElement(Services.scriptSecurityManager.getSystemPrincipal()); // 8

    const window = Services.ww.openWindow(null, AppConstants.BROWSER_CHROME_URL, '_blank', features, args);
    await waitForWindowReady(window);
    if (window.gBrowser.browsers.length !== 1)
      throw new Error(`Unexpected number of tabs in the new window: ${window.gBrowser.browsers.length}`);
    const browser = window.gBrowser.browsers[0];
    const target = this._browserToTarget.get(browser);
    browser.focus();
    if (browserContext.settings.timezoneId) {
      if (await target.hasFailedToOverrideTimezone())
        throw new Error('Failed to override timezone');
    }
    return target.id();
  }

  targets() {
    return Array.from(this._browserToTarget.values());
  }

  targetForBrowser(browser) {
    return this._browserToTarget.get(browser);
  }
}

class PageTarget {
  constructor(registry, win, tab, browserContext, opener) {
    EventEmitter.decorate(this);

    this._targetId = helper.generateId();
    this._registry = registry;
    this._window = win;
    this._gBrowser = win.gBrowser;
    this._tab = tab;
    this._linkedBrowser = tab.linkedBrowser;
    this._browserContext = browserContext;
    this._viewportSize = undefined;
    this._initialDPPX = this._linkedBrowser.browsingContext.overrideDPPX;
    this._url = 'about:blank';
    this._openerId = opener ? opener.id() : undefined;
    this._channel = SimpleChannel.createForMessageManager(`browser::page[${this._targetId}]`, this._linkedBrowser.messageManager);
    this._videoRecordingInfo = undefined;
    this._screencastRecordingInfo = undefined;
    this._dialogs = new Map();
    this.forcedColors = 'no-override';

    const navigationListener = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
      onLocationChange: (aWebProgress, aRequest, aLocation) => this._onNavigated(aLocation),
    };
    this._eventListeners = [
      helper.addObserver(this._updateModalDialogs.bind(this), 'tabmodal-dialog-loaded'),
      helper.addProgressListener(tab.linkedBrowser, navigationListener, Ci.nsIWebProgress.NOTIFY_LOCATION),
      helper.addEventListener(this._linkedBrowser, 'DOMModalDialogClosed', event => this._updateModalDialogs()),
    ];

    this._disposed = false;
    browserContext.pages.add(this);
    this._registry._browserToTarget.set(this._linkedBrowser, this);
    this._registry._browserBrowsingContextToTarget.set(this._linkedBrowser.browsingContext, this);

    this._registry.emit(TargetRegistry.Events.TargetCreated, this);
  }

  dialog(dialogId) {
    return this._dialogs.get(dialogId);
  }

  dialogs() {
    return [...this._dialogs.values()];
  }

  async windowReady() {
    await waitForWindowReady(this._window);
  }

  linkedBrowser() {
    return this._linkedBrowser;
  }

  browserContext() {
    return this._browserContext;
  }

  updateTouchOverride() {
    this._linkedBrowser.browsingContext.touchEventsOverride = this._browserContext.touchOverride ? 'enabled' : 'none';
  }

  updateUserAgent() {
    this._linkedBrowser.browsingContext.customUserAgent = this._browserContext.defaultUserAgent;
  }

  _updateModalDialogs() {
    const prompts = new Set(this._linkedBrowser.tabModalPromptBox ? this._linkedBrowser.tabModalPromptBox.listPrompts() : []);
    for (const dialog of this._dialogs.values()) {
      if (!prompts.has(dialog.prompt())) {
        this._dialogs.delete(dialog.id());
        this.emit(PageTarget.Events.DialogClosed, dialog);
      } else {
        prompts.delete(dialog.prompt());
      }
    }
    for (const prompt of prompts) {
      const dialog = Dialog.createIfSupported(prompt);
      if (!dialog)
        continue;
      this._dialogs.set(dialog.id(), dialog);
      this.emit(PageTarget.Events.DialogOpened, dialog);
    }
  }

  async updateViewportSize() {
    // Viewport size is defined by three arguments:
    // 1. default size. Could be explicit if set as part of `window.open` call, e.g.
    //   `window.open(url, title, 'width=400,height=400')`
    // 2. page viewport size
    // 3. browserContext viewport size
    //
    // The "default size" (1) is only respected when the page is opened.
    // Otherwise, explicitly set page viewport prevales over browser context
    // default viewport.
    const viewportSize = this._viewportSize || this._browserContext.defaultViewportSize;
    const actualSize = await setViewportSizeForBrowser(viewportSize, this._linkedBrowser, this._window);
    this._linkedBrowser.browsingContext.overrideDPPX = this._browserContext.deviceScaleFactor || this._initialDPPX;
    await this._channel.connect('').send('awaitViewportDimensions', {
      width: actualSize.width,
      height: actualSize.height,
      deviceSizeIsPageSize: !!this._browserContext.deviceScaleFactor,
    });
  }

  setEmulatedMedia(mediumOverride) {
    this._linkedBrowser.browsingContext.mediumOverride = mediumOverride || '';
  }

  setColorScheme(colorScheme) {
    this.colorScheme = fromProtocolColorScheme(colorScheme);
    this.updateColorSchemeOverride();
  }

  updateColorSchemeOverride() {
    this._linkedBrowser.browsingContext.prefersColorSchemeOverride = this.colorScheme || this._browserContext.colorScheme || 'none';
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = fromProtocolReducedMotion(reducedMotion);
    this.updateReducedMotionOverride();
  }

  updateReducedMotionOverride() {
    this._linkedBrowser.browsingContext.prefersReducedMotionOverride = this.reducedMotion || this._browserContext.reducedMotion || 'none';
  }

  setForcedColors(forcedColors) {
    this.forcedColors = fromProtocolForcedColors(forcedColors);
    this.updateForcedColorsOverride();
  }

  updateForcedColorsOverride() {
    this._linkedBrowser.browsingContext.forcedColorsOverride = (this.forcedColors !== 'no-override' ? this.forcedColors : this._browserContext.forcedColors) || 'no-override';
  }

  async setViewportSize(viewportSize) {
    this._viewportSize = viewportSize;
    await this.updateViewportSize();
  }

  close(runBeforeUnload = false) {
    this._gBrowser.removeTab(this._tab, {
      skipPermitUnload: !runBeforeUnload,
    });
  }

  channel() {
    return this._channel;
  }

  id() {
    return this._targetId;
  }

  info() {
    return {
      targetId: this.id(),
      type: 'page',
      browserContextId: this._browserContext.browserContextId,
      openerId: this._openerId,
    };
  }

  _onNavigated(aLocation) {
    this._url = aLocation.spec;
    this._browserContext.grantPermissionsToOrigin(this._url);
  }

  async ensurePermissions() {
    await this._channel.connect('').send('ensurePermissions', {}).catch(e => void e);
  }

  async addScriptToEvaluateOnNewDocument(script) {
    await this._channel.connect('').send('addScriptToEvaluateOnNewDocument', script).catch(e => void e);
  }

  async addBinding(worldName, name, script) {
    await this._channel.connect('').send('addBinding', { worldName, name, script }).catch(e => void e);
  }

  async applyContextSetting(name, value) {
    await this._channel.connect('').send('applyContextSetting', { name, value }).catch(e => void e);
  }

  async hasFailedToOverrideTimezone() {
    return await this._channel.connect('').send('hasFailedToOverrideTimezone').catch(e => true);
  }

  async _startVideoRecording({width, height, dir}) {
    // On Mac the window may not yet be visible when TargetCreated and its
    // NSWindow.windowNumber may be -1, so we wait until the window is known
    // to be initialized and visible.
    await this.windowReady();
    const file = OS.Path.join(dir, helper.generateId() + '.webm');
    if (width < 10 || width > 10000 || height < 10 || height > 10000)
      throw new Error("Invalid size");

    const docShell = this._gBrowser.ownerGlobal.docShell;
    // Exclude address bar and navigation control from the video.
    const rect = this.linkedBrowser().getBoundingClientRect();
    const devicePixelRatio = this._window.devicePixelRatio;
    let sessionId;
    const registry = this._registry;
    const screencastClient = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIScreencastServiceClient]),
      screencastFrame(data, deviceWidth, deviceHeight) {
      },
      screencastStopped() {
        registry.emit(TargetRegistry.Events.ScreencastStopped, sessionId);
      },
    };
    const viewport = this._viewportSize || this._browserContext.defaultViewportSize || { width: 0, height: 0 };
    sessionId = screencastService.startVideoRecording(screencastClient, docShell, true, file, width, height, 0, viewport.width, viewport.height, devicePixelRatio * rect.top);
    this._videoRecordingInfo = { sessionId, file };
    this.emit(PageTarget.Events.ScreencastStarted);
  }

  _stopVideoRecording() {
    if (!this._videoRecordingInfo)
      throw new Error('No video recording in progress');
    const videoRecordingInfo = this._videoRecordingInfo;
    this._videoRecordingInfo = undefined;
    screencastService.stopVideoRecording(videoRecordingInfo.sessionId);
  }

  videoRecordingInfo() {
    return this._videoRecordingInfo;
  }

  async startScreencast({ width, height, quality }) {
    // On Mac the window may not yet be visible when TargetCreated and its
    // NSWindow.windowNumber may be -1, so we wait until the window is known
    // to be initialized and visible.
    await this.windowReady();
    if (width < 10 || width > 10000 || height < 10 || height > 10000)
      throw new Error("Invalid size");

    const docShell = this._gBrowser.ownerGlobal.docShell;
    // Exclude address bar and navigation control from the video.
    const rect = this.linkedBrowser().getBoundingClientRect();
    const devicePixelRatio = this._window.devicePixelRatio;

    const self = this;
    const screencastClient = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIScreencastServiceClient]),
      screencastFrame(data, deviceWidth, deviceHeight) {
        if (self._screencastRecordingInfo)
          self.emit(PageTarget.Events.ScreencastFrame, { data, deviceWidth, deviceHeight });
      },
      screencastStopped() {
      },
    };
    const viewport = this._viewportSize || this._browserContext.defaultViewportSize || { width: 0, height: 0 };
    const screencastId = screencastService.startVideoRecording(screencastClient, docShell, false, '', width, height, quality || 90, viewport.width, viewport.height, devicePixelRatio * rect.top);
    this._screencastRecordingInfo = { screencastId };
    return { screencastId };
  }

  screencastFrameAck({ screencastId }) {
    if (!this._screencastRecordingInfo || this._screencastRecordingInfo.screencastId !== screencastId)
      return;
    screencastService.screencastFrameAck(screencastId);
  }

  stopScreencast() {
    if (!this._screencastRecordingInfo)
      throw new Error('No screencast in progress');
    const { screencastId } = this._screencastRecordingInfo;
    this._screencastRecordingInfo = undefined;
    screencastService.stopVideoRecording(screencastId);
  }

  dispose() {
    this._disposed = true;
    if (this._videoRecordingInfo)
      this._stopVideoRecording();
    if (this._screencastRecordingInfo)
      this.stopScreencast();
    this._browserContext.pages.delete(this);
    this._registry._browserToTarget.delete(this._linkedBrowser);
    this._registry._browserBrowsingContextToTarget.delete(this._linkedBrowser.browsingContext);
    try {
      helper.removeListeners(this._eventListeners);
    } catch (e) {
      // In some cases, removing listeners from this._linkedBrowser fails
      // because it is already half-destroyed.
      if (e)
        dump(e.message + '\n' + e.stack + '\n');
    }
    this._registry.emit(TargetRegistry.Events.TargetDestroyed, this);
  }
}

PageTarget.Events = {
  ScreencastStarted: Symbol('PageTarget.ScreencastStarted'),
  ScreencastFrame: Symbol('PageTarget.ScreencastFrame'),
  Crashed: Symbol('PageTarget.Crashed'),
  DialogOpened: Symbol('PageTarget.DialogOpened'),
  DialogClosed: Symbol('PageTarget.DialogClosed'),
};

function fromProtocolColorScheme(colorScheme) {
  if (colorScheme === 'light' || colorScheme === 'dark')
    return colorScheme;
  if (colorScheme === null || colorScheme === 'no-preference')
    return undefined;
  throw new Error('Unknown color scheme: ' + colorScheme);
}

function fromProtocolReducedMotion(reducedMotion) {
  if (reducedMotion === 'reduce' || reducedMotion === 'no-preference')
    return reducedMotion;
  if (reducedMotion === null)
    return undefined;
  throw new Error('Unknown reduced motion: ' + reducedMotion);
}

function fromProtocolForcedColors(forcedColors) {
  if (forcedColors === 'active' || forcedColors === 'none')
    return forcedColors;
  if (forcedColors === null)
    return undefined;
  throw new Error('Unknown forced colors: ' + forcedColors);
}

class BrowserContext {
  constructor(registry, browserContextId, removeOnDetach) {
    this._registry = registry;
    this.browserContextId = browserContextId;
    // Default context has userContextId === 0, but we pass undefined to many APIs just in case.
    this.userContextId = 0;
    if (browserContextId !== undefined) {
      const identity = ContextualIdentityService.create(IDENTITY_NAME + browserContextId);
      this.userContextId = identity.userContextId;
    }
    this._principals = [];
    // Maps origins to the permission lists.
    this._permissions = new Map();
    this._registry._browserContextIdToBrowserContext.set(this.browserContextId, this);
    this._registry._userContextIdToBrowserContext.set(this.userContextId, this);
    this._proxy = null;
    this.removeOnDetach = removeOnDetach;
    this.extraHTTPHeaders = undefined;
    this.httpCredentials = undefined;
    this.requestInterceptionEnabled = undefined;
    this.ignoreHTTPSErrors = undefined;
    this.downloadOptions = undefined;
    this.defaultViewportSize = undefined;
    this.deviceScaleFactor = undefined;
    this.defaultUserAgent = null;
    this.touchOverride = false;
    this.colorScheme = 'none';
    this.forcedColors = 'no-override';
    this.reducedMotion = 'none';
    this.videoRecordingOptions = undefined;
    this.scriptsToEvaluateOnNewDocument = [];
    this.bindings = [];
    this.settings = {};
    this.pages = new Set();
  }

  setColorScheme(colorScheme) {
    this.colorScheme = fromProtocolColorScheme(colorScheme);
    for (const page of this.pages)
      page.updateColorSchemeOverride();
  }

  setReducedMotion(reducedMotion) {
    this.reducedMotion = fromProtocolReducedMotion(reducedMotion);
    for (const page of this.pages)
      page.updateReducedMotionOverride();
  }

  setForcedColors(forcedColors) {
    this.forcedColors = fromProtocolForcedColors(forcedColors);
    for (const page of this.pages)
      page.updateForcedColorsOverride();
  }

  async destroy() {
    if (this.userContextId !== 0) {
      ContextualIdentityService.remove(this.userContextId);
      for (const page of this.pages)
        page.close();
      if (this.pages.size) {
        await new Promise(f => {
          const listener = helper.on(this._registry, TargetRegistry.Events.TargetDestroyed, () => {
            if (!this.pages.size) {
              helper.removeListeners([listener]);
              f();
            }
          });
        });
      }
    }
    this._registry._browserContextIdToBrowserContext.delete(this.browserContextId);
    this._registry._userContextIdToBrowserContext.delete(this.userContextId);
  }

  setProxy(proxy) {
    // Clear AuthCache.
    Services.obs.notifyObservers(null, "net:clear-active-logins");
    this._proxy = proxy;
  }

  setIgnoreHTTPSErrors(ignoreHTTPSErrors) {
    if (this.ignoreHTTPSErrors === ignoreHTTPSErrors)
      return;
    this.ignoreHTTPSErrors = ignoreHTTPSErrors;
    const certOverrideService = Cc[
      "@mozilla.org/security/certoverride;1"
    ].getService(Ci.nsICertOverrideService);
    if (ignoreHTTPSErrors) {
      Preferences.set("network.stricttransportsecurity.preloadlist", false);
      Preferences.set("security.cert_pinning.enforcement_level", 0);
      certOverrideService.setDisableAllSecurityChecksAndLetAttackersInterceptMyData(true, this.userContextId);
    } else {
      certOverrideService.setDisableAllSecurityChecksAndLetAttackersInterceptMyData(false, this.userContextId);
    }
  }

  async setDefaultUserAgent(userAgent) {
    this.defaultUserAgent = userAgent;
    for (const page of this.pages)
      page.updateUserAgent();
  }

  setTouchOverride(touchOverride) {
    this.touchOverride = touchOverride;
    for (const page of this.pages)
      page.updateTouchOverride();
  }

  async setDefaultViewport(viewport) {
    this.defaultViewportSize = viewport ? viewport.viewportSize : undefined;
    this.deviceScaleFactor = viewport ? viewport.deviceScaleFactor : undefined;
    await Promise.all(Array.from(this.pages).map(page => page.updateViewportSize()));
  }

  async addScriptToEvaluateOnNewDocument(script) {
    this.scriptsToEvaluateOnNewDocument.push(script);
    await Promise.all(Array.from(this.pages).map(page => page.addScriptToEvaluateOnNewDocument(script)));
  }

  async addBinding(worldName, name, script) {
    this.bindings.push({ worldName, name, script });
    await Promise.all(Array.from(this.pages).map(page => page.addBinding(worldName, name, script)));
  }

  async applySetting(name, value) {
    this.settings[name] = value;
    await Promise.all(Array.from(this.pages).map(page => page.applyContextSetting(name, value)));
  }

  async grantPermissions(origin, permissions) {
    this._permissions.set(origin, permissions);
    const promises = [];
    for (const page of this.pages) {
      if (origin === '*' || page._url.startsWith(origin)) {
        this.grantPermissionsToOrigin(page._url);
        promises.push(page.ensurePermissions());
      }
    }
    await Promise.all(promises);
  }

  resetPermissions() {
    for (const principal of this._principals) {
      for (const permission of ALL_PERMISSIONS)
        Services.perms.removeFromPrincipal(principal, permission);
    }
    this._principals = [];
    this._permissions.clear();
  }

  grantPermissionsToOrigin(url) {
    let origin = Array.from(this._permissions.keys()).find(key => url.startsWith(key));
    if (!origin)
      origin = '*';

    const permissions = this._permissions.get(origin);
    if (!permissions)
      return;

    const attrs = { userContextId: this.userContextId || undefined };
    const principal = Services.scriptSecurityManager.createContentPrincipal(NetUtil.newURI(url), attrs);
    this._principals.push(principal);
    for (const permission of ALL_PERMISSIONS) {
      const action = permissions.includes(permission) ? Ci.nsIPermissionManager.ALLOW_ACTION : Ci.nsIPermissionManager.DENY_ACTION;
      Services.perms.addFromPrincipal(principal, permission, action, Ci.nsIPermissionManager.EXPIRE_NEVER, 0 /* expireTime */);
    }
  }

  setCookies(cookies) {
    const protocolToSameSite = {
      [undefined]: Ci.nsICookie.SAMESITE_NONE,
      'Lax': Ci.nsICookie.SAMESITE_LAX,
      'Strict': Ci.nsICookie.SAMESITE_STRICT,
    };
    for (const cookie of cookies) {
      const uri = cookie.url ? NetUtil.newURI(cookie.url) : null;
      let domain = cookie.domain;
      if (!domain) {
        if (!uri)
          throw new Error('At least one of the url and domain needs to be specified');
        domain = uri.host;
      }
      let path = cookie.path;
      if (!path)
        path = uri ? dirPath(uri.filePath) : '/';
      let secure = false;
      if (cookie.secure !== undefined)
        secure = cookie.secure;
      else if (uri && uri.scheme === 'https')
        secure = true;
      Services.cookies.add(
        domain,
        path,
        cookie.name,
        cookie.value,
        secure,
        cookie.httpOnly || false,
        cookie.expires === undefined || cookie.expires === -1 /* isSession */,
        cookie.expires === undefined ? Date.now() + HUNDRED_YEARS : cookie.expires,
        { userContextId: this.userContextId || undefined } /* originAttributes */,
        protocolToSameSite[cookie.sameSite],
        Ci.nsICookie.SCHEME_UNSET
      );
    }
  }

  clearCookies() {
    Services.cookies.removeCookiesWithOriginAttributes(JSON.stringify({ userContextId: this.userContextId || undefined }));
  }

  getCookies() {
    const result = [];
    const sameSiteToProtocol = {
      [Ci.nsICookie.SAMESITE_NONE]: 'None',
      [Ci.nsICookie.SAMESITE_LAX]: 'Lax',
      [Ci.nsICookie.SAMESITE_STRICT]: 'Strict',
    };
    for (let cookie of Services.cookies.cookies) {
      if (cookie.originAttributes.userContextId !== this.userContextId)
        continue;
      if (cookie.host === 'addons.mozilla.org')
        continue;
      result.push({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.host,
        path: cookie.path,
        expires: cookie.isSession ? -1 : cookie.expiry,
        size: cookie.name.length + cookie.value.length,
        httpOnly: cookie.isHttpOnly,
        secure: cookie.isSecure,
        session: cookie.isSession,
        sameSite: sameSiteToProtocol[cookie.sameSite],
      });
    }
    return result;
  }

  async setVideoRecordingOptions(options) {
    this.videoRecordingOptions = options;
    if (!options)
      return;
    const promises = [];
    for (const page of this.pages)
      promises.push(page._startVideoRecording(options));
    await Promise.all(promises);
  }
}

class Dialog {
  static createIfSupported(prompt) {
    const type = prompt.args.promptType;
    switch (type) {
      case 'alert':
      case 'alertCheck':
        return new Dialog(prompt, 'alert');
      case 'prompt':
        return new Dialog(prompt, 'prompt');
      case 'confirm':
      case 'confirmCheck':
        return new Dialog(prompt, 'confirm');
      case 'confirmEx':
        return new Dialog(prompt, 'beforeunload');
      default:
        return null;
    };
  }

  constructor(prompt, type) {
    this._id = helper.generateId();
    this._type = type;
    this._prompt = prompt;
  }

  id() {
    return this._id;
  }

  message() {
    return this._prompt.ui.infoBody.textContent;
  }

  type() {
    return this._type;
  }

  prompt() {
    return this._prompt;
  }

  dismiss() {
    if (this._prompt.ui.button1)
      this._prompt.ui.button1.click();
    else
      this._prompt.ui.button0.click();
  }

  defaultValue() {
    return this._prompt.ui.loginTextbox.value;
  }

  accept(promptValue) {
    if (typeof promptValue === 'string' && this._type === 'prompt')
      this._prompt.ui.loginTextbox.value = promptValue;
    this._prompt.ui.button0.click();
  }
}


function dirPath(path) {
  return path.substring(0, path.lastIndexOf('/') + 1);
}

async function waitForWindowReady(window) {
  if (window.delayedStartupPromise) {
    await window.delayedStartupPromise;
  } else {
    await new Promise((resolve => {
      Services.obs.addObserver(function observer(aSubject, aTopic) {
        if (window == aSubject) {
          Services.obs.removeObserver(observer, aTopic);
          resolve();
        }
      }, "browser-delayed-startup-finished");
    }));
  }
  if (window.document.readyState !== 'complete')
    await helper.awaitEvent(window, 'load');
}

async function setViewportSizeForBrowser(viewportSize, browser, window) {
  await waitForWindowReady(window);
  if (viewportSize) {
    const {width, height} = viewportSize;
    const rect = browser.getBoundingClientRect();
    window.resizeBy(width - rect.width, height - rect.height);
    browser.style.setProperty('min-width', width + 'px');
    browser.style.setProperty('min-height', height + 'px');
    browser.style.setProperty('max-width', width + 'px');
    browser.style.setProperty('max-height', height + 'px');
  } else {
    browser.style.removeProperty('min-width');
    browser.style.removeProperty('min-height');
    browser.style.removeProperty('max-width');
    browser.style.removeProperty('max-height');
  }
  const rect = browser.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

TargetRegistry.Events = {
  TargetCreated: Symbol('TargetRegistry.Events.TargetCreated'),
  TargetDestroyed: Symbol('TargetRegistry.Events.TargetDestroyed'),
  DownloadCreated: Symbol('TargetRegistry.Events.DownloadCreated'),
  DownloadFinished: Symbol('TargetRegistry.Events.DownloadFinished'),
  ScreencastStopped: Symbol('TargetRegistry.ScreencastStopped'),
};

var EXPORTED_SYMBOLS = ['TargetRegistry', 'PageTarget'];
this.TargetRegistry = TargetRegistry;
this.PageTarget = PageTarget;

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
const {PageHandler} = ChromeUtils.import("chrome://juggler/content/protocol/PageHandler.js");
const {NetworkHandler} = ChromeUtils.import("chrome://juggler/content/protocol/NetworkHandler.js");
const {RuntimeHandler} = ChromeUtils.import("chrome://juggler/content/protocol/RuntimeHandler.js");
const {AccessibilityHandler} = ChromeUtils.import("chrome://juggler/content/protocol/AccessibilityHandler.js");
const {AppConstants} = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");

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
    helper.addObserver(this._onRequest.bind(this), 'http-on-modify-request');
  }

  _onRequest(httpChannel, topic) {
    let loadContext = helper.getLoadContext(httpChannel);
    if (!loadContext)
      return;
    if (!loadContext.topFrameElement)
      return;
    const target = this._registry.targetForBrowser(loadContext.topFrameElement);
    if (!target)
      return;
    target._channelIds.add(httpChannel.channelId);
  }

  //
  // nsIDownloadInterceptor implementation.
  //
  interceptDownloadRequest(externalAppHandler, request, browsingContext, outFile) {
    let pageTarget = this._registry._browserBrowsingContextToTarget.get(browsingContext);
    // New page downloads won't have browsing contex.
    if (!pageTarget)
      pageTarget = this._registry._targetForChannel(request);
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
    const downloadInfo = {
      uuid,
    };
    if (errorName === 'NS_BINDING_ABORTED') {
      downloadInfo.canceled = true;
    } else {
      downloadInfo.error = errorName;
    }
    this._registry.emit(TargetRegistry.Events.DownloadFinished, downloadInfo);
  }
}

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
        target.emit('crashed');
        target.dispose();
        this.emit(TargetRegistry.Events.TargetDestroyed, target);
      }
    }, 'oop-frameloader-crashed');

    Services.mm.addMessageListener('juggler:content-ready', {
      receiveMessage: message => {
        const linkedBrowser = message.target;
        if (this._browserToTarget.has(linkedBrowser))
          throw new Error(`Internal error: two targets per linkedBrowser`);

        let tab;
        let gBrowser;
        const windowsIt = Services.wm.getEnumerator('navigator:browser');
        let window;
        while (windowsIt.hasMoreElements()) {
          window = windowsIt.getNext();
          // gBrowser is always created before tabs. If gBrowser is not
          // initialized yet the browser belongs to another window.
          if (!window.gBrowser)
            continue;
          tab = window.gBrowser.getTabForBrowser(linkedBrowser);
          if (tab) {
            gBrowser = window.gBrowser;
            break;
          }
        }
        if (!tab)
          return;

        const { userContextId } = message.data;
        const openerContext = linkedBrowser.browsingContext.opener;
        let openerTarget;
        if (openerContext) {
          // Popups usually have opener context.
          openerTarget = this._browserBrowsingContextToTarget.get(openerContext);
        } else if (tab.openerTab) {
          // Noopener popups from the same window have opener tab instead.
          openerTarget = this._browserToTarget.get(tab.openerTab.linkedBrowser);
        }
        const browserContext = this._userContextIdToBrowserContext.get(userContextId);
        const target = new PageTarget(this, window, gBrowser, tab, linkedBrowser, browserContext, openerTarget);

        const sessions = [];
        const readyData = { sessions, target };
        this.emit(TargetRegistry.Events.TargetCreated, readyData);
        sessions.forEach(session => target._initSession(session));
        return {
          scriptsToEvaluateOnNewDocument: browserContext ? browserContext.scriptsToEvaluateOnNewDocument : [],
          bindings: browserContext ? browserContext.bindings : [],
          settings: browserContext ? browserContext.settings : {},
          sessionIds: sessions.map(session => session.sessionId()),
        };
      },
    });

    const onTabOpenListener = (window, event) => {
      const tab = event.target;
      const userContextId = tab.userContextId;
      const browserContext = this._userContextIdToBrowserContext.get(userContextId);
      if (browserContext && browserContext.defaultViewportSize)
        setViewportSizeForBrowser(browserContext.defaultViewportSize, tab.linkedBrowser, window);
    };

    const onTabCloseListener = event => {
      const tab = event.target;
      const linkedBrowser = tab.linkedBrowser;
      const target = this._browserToTarget.get(linkedBrowser);
      if (target) {
        target.dispose();
        this.emit(TargetRegistry.Events.TargetDestroyed, target);
      }
    };

    Services.wm.addListener({
      onOpenWindow: async window => {
        const domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
        if (!(domWindow instanceof Ci.nsIDOMChromeWindow))
          return;
        if (domWindow.document.readyState !== 'uninitialized')
          throw new Error('DOMWindow should not be loaded yet');
        await new Promise(fulfill => {
          domWindow.addEventListener('DOMContentLoaded', function listener() {
            domWindow.removeEventListener('DOMContentLoaded', listener);
            fulfill();
          });
        });
        if (!domWindow.gBrowser)
          return;
        domWindow.gBrowser.tabContainer.addEventListener('TabOpen', event => onTabOpenListener(domWindow, event));
        domWindow.gBrowser.tabContainer.addEventListener('TabClose', onTabCloseListener);
      },
      onCloseWindow: window => {
        const domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
        if (!(domWindow instanceof Ci.nsIDOMChromeWindow))
          return;
        if (!domWindow.gBrowser)
          return;
        domWindow.gBrowser.tabContainer.removeEventListener('TabOpen', onTabOpenListener);
        domWindow.gBrowser.tabContainer.removeEventListener('TabClose', onTabCloseListener);
        for (const tab of domWindow.gBrowser.tabs)
          onTabCloseListener({ target: tab });
      },
    });

    const extHelperAppSvc = Cc["@mozilla.org/uriloader/external-helper-app-service;1"].getService(Ci.nsIExternalHelperAppService);
    extHelperAppSvc.setDownloadInterceptor(new DownloadInterceptor(this));
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
      throw new Error(`Unexpcted number of tabs in the new window: ${window.gBrowser.browsers.length}`);
    const browser = window.gBrowser.browsers[0];
    const target = this._browserToTarget.get(browser) || await new Promise(fulfill => {
      const listener = helper.on(this, TargetRegistry.Events.TargetCreated, ({target}) => {
        if (target._linkedBrowser === browser) {
          helper.removeListeners([listener]);
          fulfill(target);
        }
      });
    });
    if (browserContext && browserContext.defaultViewportSize)
      setViewportSizeForBrowser(browserContext.defaultViewportSize, browser, window);
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

  _targetForChannel(channel) {
    const channelId = channel.channelId;
    for (const target of this._browserToTarget.values()) {
      if (target._channelIds.has(channelId))
        return target;
    }
    return null;
  }
}

class PageTarget {
  constructor(registry, win, gBrowser, tab, linkedBrowser, browserContext, opener) {
    EventEmitter.decorate(this);

    this._targetId = helper.generateId();
    this._registry = registry;
    this._window = win;
    this._gBrowser = gBrowser;
    this._tab = tab;
    this._linkedBrowser = linkedBrowser;
    this._browserContext = browserContext;
    this._viewportSize = undefined;
    this._url = 'about:blank';
    this._openerId = opener ? opener.id() : undefined;
    this._channel = SimpleChannel.createForMessageManager(`browser::page[${this._targetId}]`, this._linkedBrowser.messageManager);
    this._channelIds = new Set();

    const navigationListener = {
      QueryInterface: ChromeUtils.generateQI([Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference]),
      onLocationChange: (aWebProgress, aRequest, aLocation) => this._onNavigated(aLocation),
    };
    this._eventListeners = [
      helper.addProgressListener(tab.linkedBrowser, navigationListener, Ci.nsIWebProgress.NOTIFY_LOCATION),
    ];

    this._disposed = false;
    if (browserContext) {
      browserContext.pages.add(this);
      browserContext._firstPageCallback();
    }
    this._registry._browserToTarget.set(this._linkedBrowser, this);
    this._registry._browserBrowsingContextToTarget.set(this._linkedBrowser.browsingContext, this);
  }

  linkedBrowser() {
    return this._linkedBrowser;
  }

  browserContext() {
    return this._browserContext;
  }

  async setViewportSize(viewportSize) {
    this._viewportSize = viewportSize;
    const actualSize = setViewportSizeForBrowser(viewportSize, this._linkedBrowser, this._window);
    await this._channel.connect('').send('awaitViewportDimensions', {
      width: actualSize.width,
      height: actualSize.height
    });
  }

  connectSession(session) {
    this._initSession(session);
    this._channel.connect('').send('attach', { sessionId: session.sessionId() });
  }

  disconnectSession(session) {
    if (!this._disposed)
      this._channel.connect('').emit('detach', { sessionId: session.sessionId() });
  }

  async close(runBeforeUnload = false) {
    await this._gBrowser.removeTab(this._tab, {
      skipPermitUnload: !runBeforeUnload,
    });
  }

  _initSession(session) {
    const pageHandler = new PageHandler(this, session, this._channel);
    const networkHandler = new NetworkHandler(this, session, this._channel);
    session.registerHandler('Page', pageHandler);
    session.registerHandler('Network', networkHandler);
    session.registerHandler('Runtime', new RuntimeHandler(session, this._channel));
    session.registerHandler('Accessibility', new AccessibilityHandler(session, this._channel));
    pageHandler.enable();
    networkHandler.enable();
  }

  id() {
    return this._targetId;
  }

  info() {
    return {
      targetId: this.id(),
      type: 'page',
      browserContextId: this._browserContext ? this._browserContext.browserContextId : undefined,
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

  async addBinding(name, script) {
    await this._channel.connect('').send('addBinding', { name, script }).catch(e => void e);
  }

  async applyContextSetting(name, value) {
    await this._channel.connect('').send('applyContextSetting', { name, value }).catch(e => void e);
  }

  async hasFailedToOverrideTimezone() {
    return await this._channel.connect('').send('hasFailedToOverrideTimezone').catch(e => true);
  }

  dispose() {
    this._disposed = true;
    if (this._browserContext)
      this._browserContext.pages.delete(this);
    this._registry._browserToTarget.delete(this._linkedBrowser);
    this._registry._browserBrowsingContextToTarget.delete(this._linkedBrowser.browsingContext);
    helper.removeListeners(this._eventListeners);
  }
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
    this.scriptsToEvaluateOnNewDocument = [];
    this.bindings = [];
    this.settings = {};
    this.pages = new Set();
    this._firstPagePromise = new Promise(f => this._firstPageCallback = f);
  }

  async destroy() {
    if (this.userContextId !== 0) {
      ContextualIdentityService.remove(this.userContextId);
      ContextualIdentityService.closeContainerTabs(this.userContextId);
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

  async setDefaultViewport(viewport) {
    this.defaultViewportSize = viewport ? viewport.viewportSize : undefined;
    if (!this.userContextId) {
      // First page in the default context comes before onTabOpenListener
      // so we don't set default viewport. Wait for it here and ensure the viewport.
      await this._firstPagePromise;
    }
    const promises = Array.from(this.pages).map(async page => {
      // Resize to new default, unless the page has a custom viewport.
      if (!page._viewportSize)
        await page.setViewportSize(this.defaultViewportSize);
    });
    await Promise.all([
      this.applySetting('deviceScaleFactor', viewport ? viewport.deviceScaleFactor : undefined),
      ...promises,
    ]);
  }

  async addScriptToEvaluateOnNewDocument(script) {
    this.scriptsToEvaluateOnNewDocument.push(script);
    await Promise.all(Array.from(this.pages).map(page => page.addScriptToEvaluateOnNewDocument(script)));
  }

  async addBinding(name, script) {
    this.bindings.push({ name, script });
    await Promise.all(Array.from(this.pages).map(page => page.addBinding(name, script)));
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
  if (window.document.readyState !== 'complete') {
    await new Promise(fulfill => {
      window.addEventListener('load', function listener() {
        window.removeEventListener('load', listener);
        fulfill();
      });
    });
  }
}

function setViewportSizeForBrowser(viewportSize, browser, window) {
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
};

var EXPORTED_SYMBOLS = ['TargetRegistry'];
this.TargetRegistry = TargetRegistry;

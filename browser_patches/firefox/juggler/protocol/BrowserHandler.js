/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
const {TargetRegistry} = ChromeUtils.import("chrome://juggler/content/TargetRegistry.js");
const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');

const helper = new Helper();

class BrowserHandler {
  constructor(session, dispatcher, targetRegistry, onclose) {
    this._session = session;
    this._dispatcher = dispatcher;
    this._targetRegistry = targetRegistry;
    this._enabled = false;
    this._attachToDefaultContext = false;
    this._eventListeners = [];
    this._createdBrowserContextIds = new Set();
    this._attachedSessions = new Map();
    this._onclose = onclose;
  }

  async enable({attachToDefaultContext}) {
    if (this._enabled)
      return;
    this._enabled = true;
    this._attachToDefaultContext = attachToDefaultContext;

    for (const target of this._targetRegistry.targets()) {
      if (!this._shouldAttachToTarget(target))
        continue;
      const session = this._dispatcher.createSession();
      target.connectSession(session);
      this._attachedSessions.set(target, session);
      this._session.emitEvent('Browser.attachedToTarget', {
        sessionId: session.sessionId(),
        targetInfo: target.info()
      });
    }

    this._eventListeners = [
      helper.on(this._targetRegistry, TargetRegistry.Events.TargetCreated, this._onTargetCreated.bind(this)),
      helper.on(this._targetRegistry, TargetRegistry.Events.TargetDestroyed, this._onTargetDestroyed.bind(this)),
      helper.on(this._targetRegistry, TargetRegistry.Events.DownloadCreated, this._onDownloadCreated.bind(this)),
      helper.on(this._targetRegistry, TargetRegistry.Events.DownloadFinished, this._onDownloadFinished.bind(this)),
    ];
  }

  async createBrowserContext({removeOnDetach}) {
    if (!this._enabled)
      throw new Error('Browser domain is not enabled');
    const browserContext = this._targetRegistry.createBrowserContext(removeOnDetach);
    this._createdBrowserContextIds.add(browserContext.browserContextId);
    return {browserContextId: browserContext.browserContextId};
  }

  async removeBrowserContext({browserContextId}) {
    if (!this._enabled)
      throw new Error('Browser domain is not enabled');
    await this._targetRegistry.browserContextForId(browserContextId).destroy();
    this._createdBrowserContextIds.delete(browserContextId);
  }

  dispose() {
    helper.removeListeners(this._eventListeners);
    for (const [target, session] of this._attachedSessions) {
      target.disconnectSession(session);
      this._dispatcher.destroySession(session);
    }
    this._attachedSessions.clear();
    for (const browserContextId of this._createdBrowserContextIds) {
      const browserContext = this._targetRegistry.browserContextForId(browserContextId);
      if (browserContext.removeOnDetach)
        browserContext.destroy();
    }
    this._createdBrowserContextIds.clear();
  }

  _shouldAttachToTarget(target) {
    if (!target._browserContext)
      return false;
    if (this._createdBrowserContextIds.has(target._browserContext.browserContextId))
      return true;
    return this._attachToDefaultContext && target._browserContext === this._targetRegistry.defaultContext();
  }

  _onTargetCreated({sessions, target}) {
    if (!this._shouldAttachToTarget(target))
      return;
    const session = this._dispatcher.createSession();
    this._attachedSessions.set(target, session);
    this._session.emitEvent('Browser.attachedToTarget', {
      sessionId: session.sessionId(),
      targetInfo: target.info()
    });
    sessions.push(session);
  }

  _onTargetDestroyed(target) {
    const session = this._attachedSessions.get(target);
    if (!session)
      return;
    this._attachedSessions.delete(target);
    this._dispatcher.destroySession(session);
    this._session.emitEvent('Browser.detachedFromTarget', {
      sessionId: session.sessionId(),
      targetId: target.id(),
    });
  }

  _onDownloadCreated(downloadInfo) {
    this._session.emitEvent('Browser.downloadCreated', downloadInfo);
  }

  _onDownloadFinished(downloadInfo) {
    this._session.emitEvent('Browser.downloadFinished', downloadInfo);
  }

  async newPage({browserContextId}) {
    const targetId = await this._targetRegistry.newPage({browserContextId});
    return {targetId};
  }

  async close() {
    let browserWindow = Services.wm.getMostRecentWindow(
      "navigator:browser"
    );
    if (browserWindow && browserWindow.gBrowserInit) {
      await browserWindow.gBrowserInit.idleTasksFinishedPromise;
    }
    this._onclose();
    Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
  }

  async grantPermissions({browserContextId, origin, permissions}) {
    await this._targetRegistry.browserContextForId(browserContextId).grantPermissions(origin, permissions);
  }

  resetPermissions({browserContextId}) {
    this._targetRegistry.browserContextForId(browserContextId).resetPermissions();
  }

  setExtraHTTPHeaders({browserContextId, headers}) {
    this._targetRegistry.browserContextForId(browserContextId).extraHTTPHeaders = headers;
  }

  setHTTPCredentials({browserContextId, credentials}) {
    this._targetRegistry.browserContextForId(browserContextId).httpCredentials = nullToUndefined(credentials);
  }

  async setProxy({browserContextId, type, host, port, bypass}) {
    this._targetRegistry.browserContextForId(browserContextId).proxy = { type, host, port, bypass };
  }

  async setGlobalProxy({type, host, port, bypass}) {
    this._targetRegistry.setGlobalProxy({ type, host, port, bypass });
  }

  setRequestInterception({browserContextId, enabled}) {
    this._targetRegistry.browserContextForId(browserContextId).requestInterceptionEnabled = enabled;
  }

  setIgnoreHTTPSErrors({browserContextId, ignoreHTTPSErrors}) {
    this._targetRegistry.browserContextForId(browserContextId).setIgnoreHTTPSErrors(nullToUndefined(ignoreHTTPSErrors));
  }

  setDownloadOptions({browserContextId, downloadOptions}) {
    this._targetRegistry.browserContextForId(browserContextId).downloadOptions = nullToUndefined(downloadOptions);
  }

  async setGeolocationOverride({browserContextId, geolocation}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('geolocation', nullToUndefined(geolocation));
  }

  async setOnlineOverride({browserContextId, override}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('onlineOverride', nullToUndefined(override));
  }

  async setColorScheme({browserContextId, colorScheme}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('colorScheme', nullToUndefined(colorScheme));
  }

  async setUserAgentOverride({browserContextId, userAgent}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('userAgent', nullToUndefined(userAgent));
  }

  async setBypassCSP({browserContextId, bypassCSP}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('bypassCSP', nullToUndefined(bypassCSP));
  }

  async setJavaScriptDisabled({browserContextId, javaScriptDisabled}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('javaScriptDisabled', nullToUndefined(javaScriptDisabled));
  }

  async setLocaleOverride({browserContextId, locale}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('locale', nullToUndefined(locale));
  }

  async setTimezoneOverride({browserContextId, timezoneId}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('timezoneId', nullToUndefined(timezoneId));
  }

  async setTouchOverride({browserContextId, hasTouch}) {
    await this._targetRegistry.browserContextForId(browserContextId).applySetting('hasTouch', nullToUndefined(hasTouch));
  }

  async setDefaultViewport({browserContextId, viewport}) {
    await this._targetRegistry.browserContextForId(browserContextId).setDefaultViewport(nullToUndefined(viewport));
  }

  async addScriptToEvaluateOnNewDocument({browserContextId, script}) {
    await this._targetRegistry.browserContextForId(browserContextId).addScriptToEvaluateOnNewDocument(script);
  }

  async addBinding({browserContextId, name, script}) {
    await this._targetRegistry.browserContextForId(browserContextId).addBinding(name, script);
  }

  setCookies({browserContextId, cookies}) {
    this._targetRegistry.browserContextForId(browserContextId).setCookies(cookies);
  }

  clearCookies({browserContextId}) {
    this._targetRegistry.browserContextForId(browserContextId).clearCookies();
  }

  getCookies({browserContextId}) {
    const cookies = this._targetRegistry.browserContextForId(browserContextId).getCookies();
    return {cookies};
  }

  async getInfo() {
    const version = Components.classes["@mozilla.org/xre/app-info;1"]
                              .getService(Components.interfaces.nsIXULAppInfo)
                              .version;
    const userAgent = Components.classes["@mozilla.org/network/protocol;1?name=http"]
                                .getService(Components.interfaces.nsIHttpProtocolHandler)
                                .userAgent;
    return {version: 'Firefox/' + version, userAgent};
  }
}

function nullToUndefined(value) {
  return value === null ? undefined : value;
}

var EXPORTED_SYMBOLS = ['BrowserHandler'];
this.BrowserHandler = BrowserHandler;

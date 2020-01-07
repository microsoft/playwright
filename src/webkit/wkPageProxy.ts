// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.


import { BrowserContext } from '../browserContext';
import { Page } from '../page';
import { Protocol } from './protocol';
import { WKPageProxySession, WKPageProxySessionEvents, WKTargetSession } from './wkConnection';
import { WKPage } from './wkPage';
import { WKBrowser } from './wkBrowser';
import { RegisteredListener, helper, assert, debugError } from '../helper';
import { Events } from '../events';

export class WKPageProxy {
  private readonly _browser: WKBrowser;
  private readonly _pageProxySession: WKPageProxySession;
  readonly _browserContext: BrowserContext;
  private _pagePromise: Promise<Page> | null = null;
  private _wkPage: WKPage | null = null;
  private readonly _firstTargetPromise: Promise<void>;
  private _firstTargetCallback: () => void;
  private readonly _targetSessions = new Map<string, WKTargetSession>();
  private readonly _eventListeners: RegisteredListener[];

  constructor(browser: WKBrowser, session: WKPageProxySession, browserContext: BrowserContext) {
    this._browser = browser;
    this._pageProxySession = session;
    this._browserContext = browserContext;
    this._firstTargetPromise = new Promise(r => this._firstTargetCallback = r);
    this._eventListeners = [
      helper.addEventListener(this._pageProxySession, WKPageProxySessionEvents.TargetCreated, this._onTargetCreated.bind(this)),
      helper.addEventListener(this._pageProxySession, WKPageProxySessionEvents.TargetDestroyed, this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._pageProxySession, WKPageProxySessionEvents.DidCommitProvisionalTarget, this._onProvisionalTargetCommitted.bind(this))
    ];

    // Intercept provisional targets during cross-process navigation.
    this._pageProxySession.send('Target.setPauseOnStart', { pauseOnStart: true }).catch(e => {
      debugError(e);
      throw e;
    });
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }

  async page(): Promise<Page> {
    if (!this._pagePromise)
      this._pagePromise = this._initializeWKPage();
    return this._pagePromise;
  }

  onPopupCreated(popupPageProxy: WKPageProxy) {
    if (!this._wkPage)
      return;
    if (!this._wkPage._page.listenerCount(Events.Page.Popup))
      return;
    popupPageProxy.page().then(page => this._wkPage._page.emit(Events.Page.Popup, page));
  }

  private async _initializeWKPage(): Promise<Page> {
    await this._firstTargetPromise;
    let session: WKTargetSession;
    for (const targetSession of this._targetSessions.values()) {
      if (!targetSession.isProvisional()) {
        session = targetSession;
        break;
      }
    }
    assert(session, 'One non-provisional target session must exist');
    this._wkPage = new WKPage(this._browser, this._browserContext);
    this._wkPage.setSession(session);
    await this._initializeSession(session);
    return this._wkPage._page;
  }

  private _initializeSession(session: WKTargetSession) : Promise<void> {
    return this._wkPage._initializeSession(session).catch(e => {
      if (session.isClosed())
        return;
      // Swallow initialization errors due to newer target swap in,
      // since we will reinitialize again.
      if (this._wkPage._session === session)
        throw e;
    });
  }

  private _onTargetCreated(session: WKTargetSession, targetInfo: Protocol.Target.TargetInfo) {
    assert(targetInfo.type === 'page', 'Only page targets are expected in WebKit, received: ' + targetInfo.type);
    this._targetSessions.set(targetInfo.targetId, session);
    if (this._firstTargetCallback) {
      this._firstTargetCallback();
      this._firstTargetCallback = null;
    }
    if (targetInfo.isProvisional && this._wkPage)
      this._initializeSession(session);
    if (targetInfo.isPaused)
      this._pageProxySession.send('Target.resume', { targetId: targetInfo.targetId }).catch(debugError);
  }

  private _onTargetDestroyed({targetId, crashed}) {
    const targetSession = this._targetSessions.get(targetId);
    this._targetSessions.delete(targetId);
    if (!this._wkPage)
      return;
    if (this._wkPage._session === targetSession)
      this._wkPage.didClose(crashed);
  }

  private _onProvisionalTargetCommitted({oldTargetId, newTargetId}) {
    const newTargetSession = this._targetSessions.get(newTargetId);
    this._wkPage.setSession(newTargetSession);
  }
}

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

import { Page } from '../page';
import { Protocol } from './protocol';
import { WKSession } from './wkConnection';
import { WKPage } from './wkPage';
import { RegisteredListener, helper, assert, debugError } from '../helper';
import { Events } from '../events';
import { WKBrowserContext } from './wkBrowser';

const isPovisionalSymbol = Symbol('isPovisional');

export class WKPageProxy {
  private readonly _pageProxySession: WKSession;
  readonly _browserContext: WKBrowserContext;
  private readonly _opener: WKPageProxy | null;
  private readonly _pagePromise: Promise<Page | null>;
  private _pagePromiseFulfill: (page: Page | null) => void = () => {};
  private _pagePromiseReject: (error: Error) => void = () => {};
  private readonly _wkPage: WKPage;
  private _initialized = false;
  private readonly _sessions = new Map<string, WKSession>();
  private readonly _eventListeners: RegisteredListener[];

  constructor(pageProxySession: WKSession, browserContext: WKBrowserContext, opener: WKPageProxy | null) {
    this._pageProxySession = pageProxySession;
    this._browserContext = browserContext;
    this._opener = opener;
    this._eventListeners = [
      helper.addEventListener(this._pageProxySession, 'Target.targetCreated', this._onTargetCreated.bind(this)),
      helper.addEventListener(this._pageProxySession, 'Target.targetDestroyed', this._onTargetDestroyed.bind(this)),
      helper.addEventListener(this._pageProxySession, 'Target.dispatchMessageFromTarget', this._onDispatchMessageFromTarget.bind(this)),
      helper.addEventListener(this._pageProxySession, 'Target.didCommitProvisionalTarget', this._onDidCommitProvisionalTarget.bind(this)),
    ];
    this._pagePromise = new Promise((f, r) => {
      this._pagePromiseFulfill = f;
      this._pagePromiseReject = r;
    });
    this._wkPage = new WKPage(this._browserContext, this._pageProxySession, this._opener);
  }

  didClose() {
    if (this._initialized)
      this._wkPage.didClose(false);
  }

  dispose() {
    this._pageProxySession.dispose();
    helper.removeEventListeners(this._eventListeners);
    for (const session of this._sessions.values())
      session.dispose();
    this._sessions.clear();
    this._wkPage.dispose();
  }

  dispatchMessageToSession(message: any) {
    this._pageProxySession.dispatchMessage(message);
  }

  private _isProvisionalCrossProcessLoadInProgress(): boolean {
    for (const anySession of this._sessions.values()) {
      if ((anySession as any)[isPovisionalSymbol])
        return true;
    }
    return false;
  }

  handleProvisionalLoadFailed(event: Protocol.Browser.provisionalLoadFailedPayload) {
    if (!this._initialized)
      return;
    if (!this._isProvisionalCrossProcessLoadInProgress())
      return;
    let errorText = event.error;
    if (errorText.includes('cancelled'))
      errorText += '; maybe frame was detached?';
    this._wkPage._page._frameManager.provisionalLoadFailed(this._wkPage._page.mainFrame(), event.loaderId, errorText);
  }

  async page(): Promise<Page | null> {
    return this._pagePromise;
  }

  existingPage(): Page | undefined {
    return this._initialized ? this._wkPage._page : undefined;
  }

  private async _onTargetCreated(event: Protocol.Target.targetCreatedPayload) {
    const { targetInfo } = event;
    const session = new WKSession(this._pageProxySession.connection, targetInfo.targetId, `The ${targetInfo.type} has been closed.`, (message: any) => {
      this._pageProxySession.send('Target.sendMessageToTarget', {
        message: JSON.stringify(message), targetId: targetInfo.targetId
      }).catch(e => {
        session.dispatchMessage({ id: message.id, error: { message: e.message } });
      });
    });
    assert(targetInfo.type === 'page', 'Only page targets are expected in WebKit, received: ' + targetInfo.type);
    this._sessions.set(targetInfo.targetId, session);

    if (!this._initialized) {
      assert(!targetInfo.isProvisional);
      this._initialized = true;
      let page: Page | null = null;
      let error: Error | undefined;
      try {
        await this._wkPage.initialize(session);
        page = this._wkPage._page;
      } catch (e) {
        if (!this._pageProxySession.isDisposed())
          error = e;
      }
      if (error)
        this._pagePromiseReject(error);
      else
        this._pagePromiseFulfill(page);
      if (targetInfo.isPaused)
        this._resumeTarget(targetInfo.targetId);
      if (page && this._opener) {
        this._opener.page().then(openerPage => {
          if (!openerPage || page!.isClosed())
            return;
          openerPage.emit(Events.Page.Popup, page);
        });
      }
    } else {
      assert(targetInfo.isProvisional);
      (session as any)[isPovisionalSymbol] = true;
      const provisionalPageInitialized = this._wkPage.initializeProvisionalPage(session);
      if (targetInfo.isPaused)
        provisionalPageInitialized.then(() => this._resumeTarget(targetInfo.targetId));
    }
  }

  private _resumeTarget(targetId: string) {
    this._pageProxySession.send('Target.resume', { targetId }).catch(debugError);
  }

  private _onTargetDestroyed(event: Protocol.Target.targetDestroyedPayload) {
    const { targetId, crashed } = event;
    const session = this._sessions.get(targetId);
    assert(session, 'Unknown target destroyed: ' + targetId);
    session.dispose();
    this._sessions.delete(targetId);
    this._wkPage.onSessionDestroyed(session, crashed);
  }

  private _onDispatchMessageFromTarget(event: Protocol.Target.dispatchMessageFromTargetPayload) {
    const { targetId, message } = event;
    const session = this._sessions.get(targetId);
    assert(session, 'Unknown target: ' + targetId);
    session.dispatchMessage(JSON.parse(message));
  }

  private _onDidCommitProvisionalTarget(event: Protocol.Target.didCommitProvisionalTargetPayload) {
    const { oldTargetId, newTargetId } = event;
    const newSession = this._sessions.get(newTargetId);
    assert(newSession, 'Unknown new target: ' + newTargetId);
    const oldSession = this._sessions.get(oldTargetId);
    assert(oldSession, 'Unknown old target: ' + oldTargetId);
    // TODO: make some calls like screenshot catch swapped out error and retry.
    oldSession.errorText = 'Target was swapped out.';
    (newSession as any)[isPovisionalSymbol] = undefined;
    this._wkPage.onProvisionalLoadCommitted(newSession);
  }
}

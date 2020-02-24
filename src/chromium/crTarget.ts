/**
 * Copyright 2019 Google Inc. All rights reserved.
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

import { CRBrowser, CRBrowserContext } from './crBrowser';
import { CRSession, CRSessionEvents } from './crConnection';
import { Events } from '../events';
import { Page, Worker } from '../page';
import { Protocol } from './protocol';
import { debugError } from '../helper';
import { CRPage } from './crPage';
import { CRExecutionContext } from './crExecutionContext';

const targetSymbol = Symbol('target');

export class CRTarget {
  private _targetInfo: Protocol.Target.TargetInfo;
  private readonly _browser: CRBrowser;
  private readonly _browserContext: CRBrowserContext;
  readonly _targetId: string;
  private _sessionFactory: () => Promise<CRSession>;
  private _pagePromise: Promise<Page> | null = null;
  _crPage: CRPage | null = null;
  private _workerPromise: Promise<Worker> | null = null;
  readonly _initializedPromise: Promise<boolean>;
  _initializedCallback: (success: boolean) => void = () => {};
  _isInitialized: boolean;

  static fromPage(page: Page): CRTarget {
    return (page as any)[targetSymbol];
  }

  constructor(
    browser: CRBrowser,
    targetInfo: Protocol.Target.TargetInfo,
    browserContext: CRBrowserContext,
    sessionFactory: () => Promise<CRSession>) {
    this._targetInfo = targetInfo;
    this._browser = browser;
    this._browserContext = browserContext;
    this._targetId = targetInfo.targetId;
    this._sessionFactory = sessionFactory;
    this._initializedPromise = new Promise(fulfill => this._initializedCallback = fulfill).then(async success => {
      if (!success)
        return false;
      const opener = this.opener();
      if (!opener || !opener._pagePromise || this.type() !== 'page')
        return true;
      const openerPage = await opener._pagePromise;
      if (!openerPage.listenerCount(Events.Page.Popup))
        return true;
      const popupPage = await this.page();
      openerPage.emit(Events.Page.Popup, popupPage);
      return true;
    });
    this._isInitialized = this._targetInfo.type !== 'page' || this._targetInfo.url !== '';
    if (this._isInitialized)
      this._initializedCallback(true);
  }

  _didClose() {
    if (this._crPage)
      this._crPage.didClose();
  }

  async page(): Promise<Page | null> {
    if ((this._targetInfo.type === 'page' || this._targetInfo.type === 'background_page') && !this._pagePromise) {
      this._pagePromise = this._sessionFactory().then(async client => {
        this._crPage = new CRPage(client, this._browser, this._browserContext);
        const page = this._crPage.page();
        (page as any)[targetSymbol] = this;
        client.once(CRSessionEvents.Disconnected, () => page._didDisconnect());
        await this._crPage.initialize();
        return page;
      });
    }
    return this._pagePromise;
  }

  async serviceWorker(): Promise<Worker | null> {
    if (this._targetInfo.type !== 'service_worker')
      return null;
    if (!this._workerPromise) {
      // TODO(einbinder): Make workers send their console logs.
      this._workerPromise = this._sessionFactory().then(session => {
        const worker = new Worker(this._targetInfo.url);
        session.once('Runtime.executionContextCreated', async event => {
          worker._createExecutionContext(new CRExecutionContext(session, event.context));
        });
        // This might fail if the target is closed before we recieve all execution contexts.
        session.send('Runtime.enable', {}).catch(debugError);
        return worker;
      });
    }
    return this._workerPromise;
  }

  url(): string {
    return this._targetInfo.url;
  }

  type(): 'page' | 'background_page' | 'service_worker' | 'shared_worker' | 'other' | 'browser' {
    const type = this._targetInfo.type;
    if (type === 'page' || type === 'background_page' || type === 'service_worker' || type === 'shared_worker' || type === 'browser')
      return type;
    return 'other';
  }

  context(): CRBrowserContext {
    return this._browserContext;
  }

  opener(): CRTarget | null {
    const { openerId } = this._targetInfo;
    if (!openerId)
      return null;
    return this._browser._targets.get(openerId)!;
  }

  createCDPSession(): Promise<CRSession> {
    return this._sessionFactory();
  }

  _targetInfoChanged(targetInfo: Protocol.Target.TargetInfo) {
    this._targetInfo = targetInfo;

    if (!this._isInitialized && (this._targetInfo.type !== 'page' || this._targetInfo.url !== '')) {
      this._isInitialized = true;
      this._initializedCallback(true);
      return;
    }
  }
}

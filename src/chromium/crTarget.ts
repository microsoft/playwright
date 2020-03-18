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
import { Page, Worker } from '../page';
import { Protocol } from './protocol';
import { debugError, assert } from '../helper';
import { CRPage } from './crPage';
import { CRExecutionContext } from './crExecutionContext';

const targetSymbol = Symbol('target');

export class CRTarget {
  private readonly _targetInfo: Protocol.Target.TargetInfo;
  private readonly _browser: CRBrowser;
  private readonly _browserContext: CRBrowserContext;
  readonly _targetId: string;
  readonly sessionFactory: () => Promise<CRSession>;
  private readonly _pagePromise: Promise<Page | Error> | null = null;
  readonly _crPage: CRPage | null = null;
  _initializedPage: Page | null = null;
  private _workerPromise: Promise<Worker> | null = null;

  static fromPage(page: Page): CRTarget {
    return (page as any)[targetSymbol];
  }

  static isPageType(type: string): boolean {
    return type === 'page' || type === 'background_page';
  }

  constructor(
    browser: CRBrowser,
    targetInfo: Protocol.Target.TargetInfo,
    browserContext: CRBrowserContext,
    session: CRSession | null,
    sessionFactory: () => Promise<CRSession>) {
    this._targetInfo = targetInfo;
    this._browser = browser;
    this._browserContext = browserContext;
    this._targetId = targetInfo.targetId;
    this.sessionFactory = sessionFactory;
    if (CRTarget.isPageType(targetInfo.type)) {
      assert(session, 'Page target must be created with existing session');
      this._crPage = new CRPage(session, this._browser, this._browserContext);
      const page = this._crPage.page();
      (page as any)[targetSymbol] = this;
      session.once(CRSessionEvents.Disconnected, () => page._didDisconnect());
      this._pagePromise = this._crPage.initialize().then(() => this._initializedPage = page).catch(e => e);
    }
  }

  _didClose() {
    if (this._crPage)
      this._crPage.didClose();
  }

  async pageOrError(): Promise<Page | Error> {
    if (CRTarget.isPageType(this.type()))
      return this._pagePromise!;
    throw new Error('Not a page.');
  }

  async serviceWorker(): Promise<Worker | null> {
    if (this._targetInfo.type !== 'service_worker')
      return null;
    if (!this._workerPromise) {
      // TODO(einbinder): Make workers send their console logs.
      this._workerPromise = this.sessionFactory().then(session => {
        const worker = new Worker(this._targetInfo.url);
        session.once('Runtime.executionContextCreated', async event => {
          worker._createExecutionContext(new CRExecutionContext(session, event.context));
        });
        // This might fail if the target is closed before we receive all execution contexts.
        session.send('Runtime.enable', {}).catch(debugError);
        return worker;
      });
    }
    return this._workerPromise;
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
}

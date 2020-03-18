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

import { assert, helper } from '../helper';
import { Page, Worker } from '../page';
import { CRBrowser, CRBrowserContext } from './crBrowser';
import { CRSession, CRSessionEvents } from './crConnection';
import { CRExecutionContext } from './crExecutionContext';
import { CRPage } from './crPage';
import { Protocol } from './protocol';

const targetSymbol = Symbol('target');

export class CRTarget {
  private readonly _targetInfo: Protocol.Target.TargetInfo;
  private readonly _browser: CRBrowser;
  private readonly _browserContext: CRBrowserContext;
  readonly _targetId: string;
  private readonly _pagePromise: Promise<Page | Error> | null = null;
  readonly _crPage: CRPage | null = null;
  _initializedPage: Page | null = null;
  private readonly _workerPromise: Promise<Worker | Error> | null = null;
  _initializedWorker: Worker | null = null;

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
    session: CRSession,
    hasInitialAboutBlank: boolean) {
    this._targetInfo = targetInfo;
    this._browser = browser;
    this._browserContext = browserContext;
    this._targetId = targetInfo.targetId;
    if (CRTarget.isPageType(targetInfo.type)) {
      this._crPage = new CRPage(session, this._browser, this._browserContext);
      helper.addEventListener(session, 'Page.windowOpen', event => browser._onWindowOpen(targetInfo.targetId, event));
      const page = this._crPage.page();
      (page as any)[targetSymbol] = this;
      session.once(CRSessionEvents.Disconnected, () => page._didDisconnect());
      this._pagePromise = this._crPage.initialize(hasInitialAboutBlank).then(() => this._initializedPage = page).catch(e => e);
    } else if (targetInfo.type === 'service_worker') {
      this._workerPromise = this._initializeServiceWorker(session);
    } else {
      assert(false, 'Unsupported target type: ' + targetInfo.type);
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

  private async _initializeServiceWorker(session: CRSession): Promise<Worker | Error> {
    const worker = new Worker(this._targetInfo.url);
    session.once('Runtime.executionContextCreated', event => {
      worker._createExecutionContext(new CRExecutionContext(session, event.context));
    });
    try {
      // This might fail if the target is closed before we receive all execution contexts.
      await session.send('Runtime.enable', {});
      await session.send('Runtime.runIfWaitingForDebugger');
      this._initializedWorker = worker;
      return worker;
    } catch (error) {
      return error;
    }
  }

  serviceWorkerOrError(): Promise<Worker | Error> {
    if (this.type() === 'service_worker')
      return this._workerPromise!;
    throw new Error('Not a service worker.');
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

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
import { Worker } from '../page';
import { CRExecutionContext } from './crExecutionContext';
import { CRNetworkManager } from './crNetworkManager';
import { BrowserContext } from '../browserContext';
import * as network from '../network';

import type { CRBrowserContext } from './crBrowser';
import type { CRSession } from './crConnection';

export class CRServiceWorker extends Worker {
  readonly browserContext: CRBrowserContext;
  private readonly _networkManager?: CRNetworkManager;
  private _session: CRSession;

  constructor(browserContext: CRBrowserContext, session: CRSession, url: string) {
    super(browserContext, url);
    this._session = session;
    this.browserContext = browserContext;
    if (!!process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS)
      this._networkManager = new CRNetworkManager(null, this);
    session.once('Runtime.executionContextCreated', event => {
      this.createExecutionContext(new CRExecutionContext(session, event.context));
    });

    if (this._networkManager && this._isNetworkInspectionEnabled()) {
      this.updateRequestInterception();
      this.updateExtraHTTPHeaders();
      this.updateHttpCredentials();
      this.updateOffline();
      this._networkManager.addSession(session, undefined, true /* isMain */).catch(() => {});
    }

    session.send('Runtime.enable', {}).catch(e => { });
    session.send('Runtime.runIfWaitingForDebugger').catch(e => { });
    session.on('Inspector.targetReloadedAfterCrash', () => {
      // Resume service worker after restart.
      session._sendMayFail('Runtime.runIfWaitingForDebugger', {});
    });
  }

  override didClose() {
    this._networkManager?.removeSession(this._session);
    this._session.dispose();
    super.didClose();
  }

  async updateOffline(): Promise<void> {
    if (!this._isNetworkInspectionEnabled())
      return;
    await this._networkManager?.setOffline(!!this.browserContext._options.offline).catch(() => {});
  }

  async updateHttpCredentials(): Promise<void> {
    if (!this._isNetworkInspectionEnabled())
      return;
    await this._networkManager?.authenticate(this.browserContext._options.httpCredentials || null).catch(() => {});
  }

  async updateExtraHTTPHeaders(): Promise<void> {
    if (!this._isNetworkInspectionEnabled())
      return;
    await this._networkManager?.setExtraHTTPHeaders(this.browserContext._options.extraHTTPHeaders || []).catch(() => {});
  }

  async updateRequestInterception(): Promise<void> {
    if (!this._isNetworkInspectionEnabled())
      return;
    await this._networkManager?.setRequestInterception(this.needsRequestInterception()).catch(() => {});
  }

  needsRequestInterception(): boolean {
    return this._isNetworkInspectionEnabled() && this.browserContext.requestInterceptors.length > 0;
  }

  reportRequestFinished(request: network.Request, response: network.Response | null) {
    this.browserContext.emit(BrowserContext.Events.RequestFinished, { request, response });
  }

  requestFailed(request: network.Request, _canceled: boolean) {
    this.browserContext.emit(BrowserContext.Events.RequestFailed, request);
  }

  requestReceivedResponse(response: network.Response) {
    this.browserContext.emit(BrowserContext.Events.Response, response);
  }

  requestStarted(request: network.Request, route?: network.RouteDelegate) {
    this.browserContext.emit(BrowserContext.Events.Request, request);
    if (route)
      new network.Route(request, route).handle(this.browserContext.requestInterceptors);
  }

  private _isNetworkInspectionEnabled(): boolean {
    return this.browserContext._options.serviceWorkers !== 'block';
  }
}

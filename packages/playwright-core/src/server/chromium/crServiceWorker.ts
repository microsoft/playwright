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
import type { CRBrowserContext } from './crBrowser';
import type { CRSession } from './crConnection';
import { CRExecutionContext } from './crExecutionContext';
import { CRNetworkManager } from './crNetworkManager';
import * as network from '../network';
import { BrowserContext } from '../browserContext';

export class CRServiceWorker extends Worker {
  readonly _browserContext: CRBrowserContext;
  readonly _networkManager: CRNetworkManager;

  constructor(browserContext: CRBrowserContext, session: CRSession, url: string) {
    super(browserContext, url);
    this._browserContext = browserContext;
    this._networkManager = new CRNetworkManager(session, null, this, null);
    session.once('Runtime.executionContextCreated', event => {
      this._createExecutionContext(new CRExecutionContext(session, event.context));
    });

    if (this._isNetworkInspectionEnabled()) {
      this._networkManager.initialize().catch(() => {});
      this.updateRequestInterception();
    }

    session.send('Runtime.enable', {}).catch(e => { });
    session.send('Runtime.runIfWaitingForDebugger').catch(e => { });
  }

  updateRequestInterception(): Promise<void> {
    return this._networkManager.setRequestInterception(this.needsRequestInterception()).catch(e => { });
  }

  needsRequestInterception(): boolean {
    return this._isNetworkInspectionEnabled() && !!this._browserContext._requestInterceptor;
  }

  reportRequestFinished(request: network.Request, response: network.Response | null) {
    this._browserContext.emit(BrowserContext.Events.RequestFinished, { request, response });
  }

  requestFailed(request: network.Request, _canceled: boolean) {
    this._browserContext.emit(BrowserContext.Events.RequestFailed, request);
  }

  requestReceivedResponse(response: network.Response) {
    this._browserContext.emit(BrowserContext.Events.Response, response);
  }

  requestStarted(request: network.Request, route?: network.RouteDelegate) {
    this._browserContext.emit(BrowserContext.Events.Request, request);
    if (route) {
      const r = new network.Route(request, route);
      if (this._browserContext._requestInterceptor) {
        this._browserContext._requestInterceptor(r, request);
        return;
      }
      r.continue();
    }
  }

  private _isNetworkInspectionEnabled(): boolean {
    return this._browserContext._options.serviceWorkerPolicy === 'inspected';
  }
}

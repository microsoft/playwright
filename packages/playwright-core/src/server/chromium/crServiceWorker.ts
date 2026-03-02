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
import { createHandle, CRExecutionContext } from './crExecutionContext';
import { CRNetworkManager } from './crNetworkManager';
import { BrowserContext } from '../browserContext';
import * as network from '../network';
import { ConsoleMessage } from '../console';
import { toConsoleMessageLocation } from './crProtocolHelper';

import type { CRBrowserContext } from './crBrowser';
import type { CRSession } from './crConnection';
import type { Protocol } from './protocol';

export class CRServiceWorker extends Worker {
  readonly browserContext: CRBrowserContext;
  private readonly _networkManager?: CRNetworkManager;
  private _session: CRSession;
  private readonly _targetId: string;
  private _currentContextId: number | undefined;
  private _currentContextDestroyed = false;

  constructor(browserContext: CRBrowserContext, session: CRSession, url: string, targetId: string) {
    super(browserContext, url);
    this._session = session;
    this._targetId = targetId;
    this.browserContext = browserContext;
    if (!process.env.PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK)
      this._networkManager = new CRNetworkManager(null, this);

    // Track execution context destruction so we can detect service worker
    // restarts. Chrome reuses the same target ID and may reuse context ID=1
    // in the fresh V8 isolate.
    session.on('Runtime.executionContextDestroyed', (event: Protocol.Runtime.executionContextDestroyedPayload) => {
      if (event.executionContextId === this._currentContextId)
        this._currentContextDestroyed = true;
    });
    session.on('Runtime.executionContextsCleared', () => {
      if (this._currentContextId !== undefined)
        this._currentContextDestroyed = true;
    });

    const onExecutionContextCreated = (event: Protocol.Runtime.executionContextCreatedPayload) => {
      // Ignore duplicate notifications for the same live context (e.g. from Runtime.enable).
      if (!this._currentContextDestroyed && event.context.id === this._currentContextId)
        return;

      // A new context arriving after we already have one means the SW restarted.
      if (this.existingExecutionContext !== null || this._currentContextDestroyed) {
        session.off('Runtime.executionContextCreated', onExecutionContextCreated);
        this._handleRestart(event);
        return;
      }

      this._currentContextId = event.context.id;
      this.createExecutionContext(new CRExecutionContext(session, event.context));
    };
    session.on('Runtime.executionContextCreated', onExecutionContextCreated);
    if (this.browserContext._browser.majorVersion() >= 143)
      session.on('Inspector.workerScriptLoaded', () => this.workerScriptLoaded());
    else
      this.workerScriptLoaded();

    if (this._networkManager && this._isNetworkInspectionEnabled()) {
      this.updateRequestInterception();
      this.updateExtraHTTPHeaders();
      this.updateHttpCredentials();
      this.updateOffline();
      this._networkManager.addSession(session, undefined, true /* isMain */).catch(() => {});
    }

    session.on('Runtime.consoleAPICalled', event => {
      if (!this.existingExecutionContext || process.env.PLAYWRIGHT_DISABLE_SERVICE_WORKER_CONSOLE)
        return;
      const args = event.args.map(o => createHandle(this.existingExecutionContext!, o));
      const message = new ConsoleMessage(null, this, event.type, undefined, args, toConsoleMessageLocation(event.stackTrace), event.timestamp);
      this.browserContext.emit(BrowserContext.Events.Console, message);
    });

    session.send('Runtime.enable', {}).catch(e => {});
    session.send('Runtime.runIfWaitingForDebugger').catch(e => {});
    session.on('Inspector.targetReloadedAfterCrash', () => {
      // Resume service worker after restart.
      session._sendMayFail('Runtime.runIfWaitingForDebugger', {});
    });
  }

  private _handleRestart(contextEvent: Protocol.Runtime.executionContextCreatedPayload) {
    const browser = this.browserContext._browser;
    browser._serviceWorkers.delete(this._targetId);

    // Close this Worker WITHOUT disposing the session — the new worker reuses it.
    this._networkManager?.removeSession(this._session);
    if (this.existingExecutionContext)
      this.existingExecutionContext.contextDestroyed('Service worker restarted');
    this.existingExecutionContext = null;
    this.emit(Worker.Events.Close, this);
    this.openScope.close(new Error('Service worker restarted'));

    const newWorker = new CRServiceWorker(this.browserContext, this._session, this.url, this._targetId);
    newWorker._currentContextId = contextEvent.context.id;
    browser._serviceWorkers.set(this._targetId, newWorker);
    this.browserContext.emit('serviceworker' as any, newWorker);
    newWorker.createExecutionContext(new CRExecutionContext(this._session, contextEvent.context));
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

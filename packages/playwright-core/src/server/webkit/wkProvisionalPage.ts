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

import type { WKSession } from './wkConnection';
import type { WKPage } from './wkPage';
import type { RegisteredListener } from '../../utils/eventsHelper';
import { eventsHelper } from '../../utils/eventsHelper';
import type { Protocol } from './protocol';
import { assert } from '../../utils';
import type * as network from '../network';

export class WKProvisionalPage {
  readonly _session: WKSession;
  private readonly _wkPage: WKPage;
  private _coopNavigationRequest: network.Request | undefined;
  private _sessionListeners: RegisteredListener[] = [];
  private _mainFrameId: string | null = null;
  readonly initializationPromise: Promise<void>;

  constructor(session: WKSession, page: WKPage) {
    this._session = session;
    this._wkPage = page;
    // Cross-Origin-Opener-Policy (COOP) request starts in one process and once response headers
    // have been received, continues in another.
    //
    // Network.requestWillBeSent and requestIntercepted (if intercepting) from the original web process
    // will always come before a provisional page is created based on the response COOP headers.
    // Thereafter we'll receive targetCreated (provisional) and later on in some order loadingFailed from the
    // original process and requestWillBeSent from the provisional one. We should ignore loadingFailed
    // as the original request continues in the provisional process. But if the provisional load is later
    // canceled we should dispatch loadingFailed to the client.
    this._coopNavigationRequest = page._page.mainFrame().pendingDocument()?.request;

    const overrideFrameId = (handler: (p: any) => void) => {
      return (payload: any) => {
        // Pretend that the events happened in the same process.
        if (payload.frameId)
          payload.frameId = this._wkPage._page._frameManager.mainFrame()._id;
        handler(payload);
      };
    };
    const wkPage = this._wkPage;

    this._sessionListeners = [
      eventsHelper.addEventListener(session, 'Network.requestWillBeSent', overrideFrameId(e => this._onRequestWillBeSent(e))),
      eventsHelper.addEventListener(session, 'Network.requestIntercepted', overrideFrameId(e => wkPage._onRequestIntercepted(session, e))),
      eventsHelper.addEventListener(session, 'Network.responseReceived', overrideFrameId(e => wkPage._onResponseReceived(session, e))),
      eventsHelper.addEventListener(session, 'Network.loadingFinished', overrideFrameId(e => this._onLoadingFinished(e))),
      eventsHelper.addEventListener(session, 'Network.loadingFailed', overrideFrameId(e => this._onLoadingFailed(e))),
    ];

    this.initializationPromise = this._wkPage._initializeSession(session, true, ({ frameTree }) => this._handleFrameTree(frameTree));
  }

  coopNavigationRequest(): network.Request | undefined {
    return this._coopNavigationRequest;
  }

  dispose() {
    eventsHelper.removeEventListeners(this._sessionListeners);
  }

  commit() {
    assert(this._mainFrameId);
    this._wkPage._onFrameAttached(this._mainFrameId, null);
  }

  private _onRequestWillBeSent(event: Protocol.Network.requestWillBeSentPayload) {
    if (this._coopNavigationRequest && this._coopNavigationRequest.url() === event.request.url) {
      // If it's a continuation of the main frame navigation request after COOP headers were received,
      // take over original request, and replace its request id with the new one.
      this._wkPage._adoptRequestFromNewProcess(this._coopNavigationRequest, this._session, event.requestId);
      // Simply ignore this event as it has already been dispatched from the original process
      // and there will ne no requestIntercepted event from the provisional process as it resumes
      // existing network load (that has already received reponse headers).
      return;
    }
    this._wkPage._onRequestWillBeSent(this._session, event);
  }

  private _onLoadingFinished(event: Protocol.Network.loadingFinishedPayload): void {
    this._coopNavigationRequest = undefined;
    this._wkPage._onLoadingFinished(event);
  }

  private _onLoadingFailed(event: Protocol.Network.loadingFailedPayload) {
    this._coopNavigationRequest = undefined;
    this._wkPage._onLoadingFailed(this._session, event);
  }

  private _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    assert(!frameTree.frame.parentId);
    this._mainFrameId = frameTree.frame.id;
  }
}
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

import { eventsHelper } from '@utils/eventsHelper';
import { assert } from '@isomorphic/assert';

import type { Protocol } from './protocol';
import type { WVSession } from './wvConnection';
import type { WVPage } from './wvPage';
import type { RegisteredListener } from '@utils/eventsHelper';

export class WVProvisionalPage {
  readonly _session: WVSession;
  private readonly _wvPage: WVPage;
  private _sessionListeners: RegisteredListener[] = [];
  private _mainFrameId: string | null = null;
  readonly initializationPromise: Promise<void>;

  constructor(session: WVSession, page: WVPage) {
    this._session = session;
    this._wvPage = page;

    const overrideFrameId = (handler: (p: any) => void) => {
      return (payload: any) => {
        // Pretend that the events happened in the same process.
        if (payload.frameId)
          payload.frameId = this._wvPage._page.frameManager.mainFrame()._id;
        handler(payload);
      };
    };
    const wvPage = this._wvPage;

    this._sessionListeners = [
      eventsHelper.addEventListener(session, 'Network.requestWillBeSent', overrideFrameId(e => wvPage._onRequestWillBeSent(session, e))),
      eventsHelper.addEventListener(session, 'Network.requestIntercepted', overrideFrameId(e => wvPage._onRequestIntercepted(session, e))),
      eventsHelper.addEventListener(session, 'Network.responseReceived', overrideFrameId(e => wvPage._onResponseReceived(session, e))),
      eventsHelper.addEventListener(session, 'Network.loadingFinished', overrideFrameId(e => wvPage._onLoadingFinished(e))),
      eventsHelper.addEventListener(session, 'Network.loadingFailed', overrideFrameId(e => wvPage._onLoadingFailed(session, e))),
    ];

    this.initializationPromise = this._wvPage._initializeSession(session, true, ({ frameTree }) => this._handleFrameTree(frameTree));
  }

  dispose() {
    eventsHelper.removeEventListeners(this._sessionListeners);
  }

  commit() {
    assert(this._mainFrameId);
    this._wvPage._onFrameAttached(this._mainFrameId, null);
  }

  private _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    assert(!frameTree.frame.parentId);
    this._mainFrameId = frameTree.frame.id;
  }
}

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

import { WKSession } from './wkConnection';
import { WKPage } from './wkPage';
import { RegisteredListener, helper, assert } from '../helper';
import { Protocol } from './protocol';

export class WKProvisionalPage {
  readonly _session: WKSession;
  private readonly _wkPage: WKPage;
  private _sessionListeners: RegisteredListener[] = [];
  private _mainFrameId: string | null = null;

  constructor(session: WKSession, page: WKPage) {
    this._session = session;
    this._wkPage = page;

    this._sessionListeners = [
      'Network.requestWillBeSent',
      'Network.requestIntercepted',
      'Network.responseReceived',
      'Network.loadingFinished',
      'Network.loadingFailed',
    ].map(name => helper.addEventListener(this._session, name, args => this._onNetworkEvent(name, args)));

    this._wkPage._initializeSession(session, ({frameTree}) => this._handleFrameTree(frameTree));
  }

  dispose() {
    helper.removeEventListeners(this._sessionListeners);
  }

  commit() {
    assert(this._mainFrameId);
    this._wkPage._onFrameAttached(this._mainFrameId!, null);
  }

  private _onNetworkEvent(eventName: string, payload: any) {
    // Pretend that the events happened in the same process.
    if (payload.frameId)
      payload.frameId = this._wkPage._page._frameManager.mainFrame()._id;
    this._wkPage._session.emit(eventName, payload, this._session);
  }

  private _handleFrameTree(frameTree: Protocol.Page.FrameResourceTree) {
    assert(!frameTree.frame.parentId);
    this._mainFrameId = frameTree.frame.id;
  }
}
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

import { helper, RegisteredListener } from '../helper';
import { JugglerSessionEvents } from './Connection';
import { FrameManagerEvents, FrameManager } from './FrameManager';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';
import * as frames from '../frames';
import * as network from '../network';

export class NextNavigationWatchdog {
  private _frameManager: FrameManager;
  private _navigatedFrame: frames.Frame;
  private _promise: Promise<unknown>;
  private _resolveCallback: (value?: unknown) => void;
  private _navigation: {navigationId: number|null, url?: string} = null;
  private _eventListeners: RegisteredListener[];

  constructor(frameManager: FrameManager, navigatedFrame: frames.Frame) {
    this._frameManager = frameManager;
    this._navigatedFrame = navigatedFrame;
    this._promise = new Promise(x => this._resolveCallback = x);
    this._eventListeners = [
      helper.addEventListener(frameManager._session, 'Page.navigationStarted', this._onNavigationStarted.bind(this)),
      helper.addEventListener(frameManager._session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)),
    ];
  }

  promise() {
    return this._promise;
  }

  navigation() {
    return this._navigation;
  }

  _onNavigationStarted(params) {
    if (params.frameId === this._frameManager._frameData(this._navigatedFrame).frameId) {
      this._navigation = {
        navigationId: params.navigationId,
        url: params.url,
      };
      this._resolveCallback();
    }
  }

  _onSameDocumentNavigation(params) {
    if (params.frameId === this._frameManager._frameData(this._navigatedFrame).frameId) {
      this._navigation = {
        navigationId: null,
      };
      this._resolveCallback();
    }
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }
}

export class NavigationWatchdog {
  private _frameManager: FrameManager;
  private _navigatedFrame: frames.Frame;
  private _targetNavigationId: any;
  private _firedEvents: frames.LifecycleEvent[];
  private _targetURL: any;
  private _promise: Promise<unknown>;
  private _resolveCallback: (value?: unknown) => void;
  private _navigationRequest: network.Request | null;
  private _eventListeners: RegisteredListener[];

  constructor(frameManager: FrameManager, navigatedFrame: frames.Frame, networkManager: NetworkManager, targetNavigationId, targetURL, firedEvents: frames.LifecycleEvent[]) {
    this._frameManager = frameManager;
    this._navigatedFrame = navigatedFrame;
    this._targetNavigationId = targetNavigationId;
    this._firedEvents = firedEvents;
    this._targetURL = targetURL;

    this._promise = new Promise(x => this._resolveCallback = x);
    this._navigationRequest = null;

    const check = this._checkNavigationComplete.bind(this);
    this._eventListeners = [
      helper.addEventListener(frameManager._session, JugglerSessionEvents.Disconnected, () => this._resolveCallback(new Error('Navigation failed because browser has disconnected!'))),
      helper.addEventListener(frameManager._session, 'Page.eventFired', check),
      helper.addEventListener(frameManager._session, 'Page.frameAttached', check),
      helper.addEventListener(frameManager._session, 'Page.frameDetached', check),
      helper.addEventListener(frameManager._session, 'Page.navigationStarted', check),
      helper.addEventListener(frameManager._session, 'Page.navigationCommitted', check),
      helper.addEventListener(frameManager._session, 'Page.navigationAborted', this._onNavigationAborted.bind(this)),
      helper.addEventListener(networkManager, NetworkManagerEvents.Request, this._onRequest.bind(this)),
      helper.addEventListener(frameManager, FrameManagerEvents.FrameDetached, check),
    ];
    check();
  }

  _onRequest(request) {
    if (request.frame() !== this._navigatedFrame || !request.isNavigationRequest())
      return;
    this._navigationRequest = request;
  }

  navigationResponse(): network.Response | null {
    return this._navigationRequest ? this._navigationRequest.response() : null;
  }

  _checkNavigationComplete() {
    const checkFiredEvents = (frame: frames.Frame, firedEvents: frames.LifecycleEvent[]) => {
      for (const subframe of frame.childFrames()) {
        if (!checkFiredEvents(subframe, firedEvents))
          return false;
      }
      return firedEvents.every(event => frame._firedLifecycleEvents.has(event));
    };

    if (this._navigatedFrame.isDetached())
      this._resolveCallback(new Error('Navigating frame was detached'));
    else if (this._frameManager._frameData(this._navigatedFrame).lastCommittedNavigationId === this._targetNavigationId
        && checkFiredEvents(this._navigatedFrame, this._firedEvents))
      this._resolveCallback(null);
  }

  _onNavigationAborted(params) {
    if (params.frameId === this._frameManager._frameData(this._navigatedFrame).frameId && params.navigationId === this._targetNavigationId)
      this._resolveCallback(new Error('Navigation to ' + this._targetURL + ' failed: ' + params.errorText));
  }

  promise() {
    return this._promise;
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }
}

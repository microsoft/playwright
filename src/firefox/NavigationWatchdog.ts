import { helper, RegisteredListener } from '../helper';
import { JugglerSessionEvents } from './Connection';
import { Frame, FrameManagerEvents, FrameManager } from './FrameManager';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';

export class NextNavigationWatchdog {
  private _frameManager: FrameManager;
  private _navigatedFrame: Frame;
  private _promise: Promise<unknown>;
  private _resolveCallback: (value?: unknown) => void;
  private _navigation: {navigationId: number|null, url?: string} = null;
  private _eventListeners: RegisteredListener[];

  constructor(frameManager: FrameManager, navigatedFrame: Frame) {
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
  private _navigatedFrame: Frame;
  private _targetNavigationId: any;
  private _firedEvents: any;
  private _targetURL: any;
  private _promise: Promise<unknown>;
  private _resolveCallback: (value?: unknown) => void;
  private _navigationRequest: any;
  private _eventListeners: RegisteredListener[];

  constructor(frameManager: FrameManager, navigatedFrame: Frame, networkManager: NetworkManager, targetNavigationId, targetURL, firedEvents) {
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

  navigationResponse() {
    return this._navigationRequest ? this._navigationRequest.response() : null;
  }

  _checkNavigationComplete() {
    const checkFiredEvents = (frame: Frame, firedEvents) => {
      for (const subframe of frame.childFrames()) {
        if (!checkFiredEvents(subframe, firedEvents))
          return false;
      }
      return firedEvents.every(event => this._frameManager._frameData(frame).firedEvents.has(event));
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

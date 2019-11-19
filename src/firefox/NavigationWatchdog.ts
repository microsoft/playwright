import { helper, RegisteredListener } from '../helper';
import { JugglerSession, JugglerSessionEvents } from './Connection';
import { Frame, FrameManagerEvents } from './FrameManager';
import { NetworkManager, NetworkManagerEvents } from './NetworkManager';

export class NextNavigationWatchdog {
  private _navigatedFrame: Frame;
  private _promise: Promise<unknown>;
  private _resolveCallback: (value?: unknown) => void;
  private _navigation: {navigationId: number|null, url?: string} = null;
  private _eventListeners: RegisteredListener[];
  constructor(session : JugglerSession, navigatedFrame : Frame) {
    this._navigatedFrame = navigatedFrame;
    this._promise = new Promise(x => this._resolveCallback = x);
    this._eventListeners = [
      helper.addEventListener(session, 'Page.navigationStarted', this._onNavigationStarted.bind(this)),
      helper.addEventListener(session, 'Page.sameDocumentNavigation', this._onSameDocumentNavigation.bind(this)),
    ];
  }

  promise() {
    return this._promise;
  }

  navigation() {
    return this._navigation;
  }

  _onNavigationStarted(params) {
    if (params.frameId === this._navigatedFrame._frameId) {
      this._navigation = {
        navigationId: params.navigationId,
        url: params.url,
      };
      this._resolveCallback();
    }
  }

  _onSameDocumentNavigation(params) {
    if (params.frameId === this._navigatedFrame._frameId) {
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
  private _navigatedFrame: Frame;
  private _targetNavigationId: any;
  private _firedEvents: any;
  private _targetURL: any;
  private _promise: Promise<unknown>;
  private _resolveCallback: (value?: unknown) => void;
  private _navigationRequest: any;
  private _eventListeners: RegisteredListener[];
  constructor(session : JugglerSession, navigatedFrame : Frame, networkManager : NetworkManager, targetNavigationId, targetURL, firedEvents) {
    this._navigatedFrame = navigatedFrame;
    this._targetNavigationId = targetNavigationId;
    this._firedEvents = firedEvents;
    this._targetURL = targetURL;

    this._promise = new Promise(x => this._resolveCallback = x);
    this._navigationRequest = null;

    const check = this._checkNavigationComplete.bind(this);
    this._eventListeners = [
      helper.addEventListener(session, JugglerSessionEvents.Disconnected, () => this._resolveCallback(new Error('Navigation failed because browser has disconnected!'))),
      helper.addEventListener(session, 'Page.eventFired', check),
      helper.addEventListener(session, 'Page.frameAttached', check),
      helper.addEventListener(session, 'Page.frameDetached', check),
      helper.addEventListener(session, 'Page.navigationStarted', check),
      helper.addEventListener(session, 'Page.navigationCommitted', check),
      helper.addEventListener(session, 'Page.navigationAborted', this._onNavigationAborted.bind(this)),
      helper.addEventListener(networkManager, NetworkManagerEvents.Request, this._onRequest.bind(this)),
      helper.addEventListener(navigatedFrame._frameManager, FrameManagerEvents.FrameDetached, check),
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
    if (this._navigatedFrame.isDetached())
      this._resolveCallback(new Error('Navigating frame was detached'));
    else if (this._navigatedFrame._lastCommittedNavigationId === this._targetNavigationId
        && checkFiredEvents(this._navigatedFrame, this._firedEvents))
      this._resolveCallback(null);


    function checkFiredEvents(frame, firedEvents) {
      for (const subframe of frame._children) {
        if (!checkFiredEvents(subframe, firedEvents))
          return false;
      }
      return firedEvents.every(event => frame._firedEvents.has(event));
    }
  }

  _onNavigationAborted(params) {
    if (params.frameId === this._navigatedFrame._frameId && params.navigationId === this._targetNavigationId)
      this._resolveCallback(new Error('Navigation to ' + this._targetURL + ' failed: ' + params.errorText));
  }

  promise() {
    return this._promise;
  }

  dispose() {
    helper.removeEventListeners(this._eventListeners);
  }
}

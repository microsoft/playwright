/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {NetworkObserver, PageNetwork} = ChromeUtils.import('chrome://juggler/content/NetworkObserver.js');

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const XUL_NS = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
const helper = new Helper();

class NetworkHandler {
  constructor(target, session, contentChannel) {
    this._session = session;
    this._contentPage = contentChannel.connect(session.sessionId() + 'page');
    this._httpActivity = new Map();
    this._enabled = false;
    this._pageNetwork = NetworkObserver.instance().pageNetworkForTarget(target);
    this._requestInterception = false;
    this._eventListeners = [];
    this._pendingRequstWillBeSentEvents = new Set();
    this._requestIdToFrameId = new Map();
  }

  async enable() {
    if (this._enabled)
      return;
    this._enabled = true;
    this._eventListeners = [
      helper.on(this._pageNetwork, PageNetwork.Events.Request, this._onRequest.bind(this)),
      helper.on(this._pageNetwork, PageNetwork.Events.Response, this._onResponse.bind(this)),
      helper.on(this._pageNetwork, PageNetwork.Events.RequestFinished, this._onRequestFinished.bind(this)),
      helper.on(this._pageNetwork, PageNetwork.Events.RequestFailed, this._onRequestFailed.bind(this)),
      this._pageNetwork.addSession(),
    ];
  }

  async getResponseBody({requestId}) {
    return this._pageNetwork.getResponseBody(requestId);
  }

  async setExtraHTTPHeaders({headers}) {
    this._pageNetwork.setExtraHTTPHeaders(headers);
  }

  async setRequestInterception({enabled}) {
    if (enabled)
      this._pageNetwork.enableRequestInterception();
    else
    this._pageNetwork.disableRequestInterception();
    // Right after we enable/disable request interception we need to await all pending
    // requestWillBeSent events before successfully returning from the method.
    await Promise.all(Array.from(this._pendingRequstWillBeSentEvents));
  }

  async resumeInterceptedRequest({requestId, method, headers, postData}) {
    this._pageNetwork.resumeInterceptedRequest(requestId, method, headers, postData);
  }

  async abortInterceptedRequest({requestId, errorCode}) {
    this._pageNetwork.abortInterceptedRequest(requestId, errorCode);
  }

  async fulfillInterceptedRequest({requestId, status, statusText, headers, base64body}) {
    this._pageNetwork.fulfillInterceptedRequest(requestId, status, statusText, headers, base64body);
  }

  dispose() {
    this._contentPage.dispose();
    helper.removeListeners(this._eventListeners);
  }

  _ensureHTTPActivity(requestId) {
    let activity = this._httpActivity.get(requestId);
    if (!activity) {
      activity = {
        _id: requestId,
        _lastSentEvent: null,
        request: null,
        response: null,
        complete: null,
        failed: null,
      };
      this._httpActivity.set(requestId, activity);
    }
    return activity;
  }

  _reportHTTPAcitivityEvents(activity) {
    // State machine - sending network events.
    if (!activity._lastSentEvent && activity.request) {
      this._session.emitEvent('Network.requestWillBeSent', activity.request);
      activity._lastSentEvent = 'requestWillBeSent';
    }
    if (activity._lastSentEvent === 'requestWillBeSent' && activity.response) {
      this._session.emitEvent('Network.responseReceived', activity.response);
      activity._lastSentEvent = 'responseReceived';
    }
    if (activity._lastSentEvent === 'responseReceived' && activity.complete) {
      this._session.emitEvent('Network.requestFinished', activity.complete);
      activity._lastSentEvent = 'requestFinished';
    }
    if (activity._lastSentEvent && activity.failed) {
      this._session.emitEvent('Network.requestFailed', activity.failed);
      activity._lastSentEvent = 'requestFailed';
    }

    // Clean up if request lifecycle is over.
    if (activity._lastSentEvent === 'requestFinished' || activity._lastSentEvent === 'requestFailed')
      this._httpActivity.delete(activity._id);
  }

  async _onRequest(eventDetails, channelId) {
    let pendingRequestCallback;
    let pendingRequestPromise = new Promise(x => pendingRequestCallback = x);
    this._pendingRequstWillBeSentEvents.add(pendingRequestPromise);
    let details = null;
    try {
      details = await this._contentPage.send('requestDetails', {channelId});
    } catch (e) {
      pendingRequestCallback();
      this._pendingRequstWillBeSentEvents.delete(pendingRequestPromise);
      return;
    }
    // Inherit frameId for redirects when details are not available.
    const frameId = details ? details.frameId : (eventDetails.redirectedFrom ? this._requestIdToFrameId.get(eventDetails.redirectedFrom) : undefined);
    this._requestIdToFrameId.set(eventDetails.requestId, frameId);
    const activity = this._ensureHTTPActivity(eventDetails.requestId);
    activity.request = {
      frameId,
      ...eventDetails,
    };
    this._reportHTTPAcitivityEvents(activity);
    pendingRequestCallback();
    this._pendingRequstWillBeSentEvents.delete(pendingRequestPromise);
  }

  async _onResponse(eventDetails) {
    const activity = this._ensureHTTPActivity(eventDetails.requestId);
    activity.response = eventDetails;
    this._reportHTTPAcitivityEvents(activity);
  }

  async _onRequestFinished(eventDetails) {
    const activity = this._ensureHTTPActivity(eventDetails.requestId);
    activity.complete = eventDetails;
    this._reportHTTPAcitivityEvents(activity);
  }

  async _onRequestFailed(eventDetails) {
    const activity = this._ensureHTTPActivity(eventDetails.requestId);
    activity.failed = eventDetails;
    this._reportHTTPAcitivityEvents(activity);
  }
}

var EXPORTED_SYMBOLS = ['NetworkHandler'];
this.NetworkHandler = NetworkHandler;

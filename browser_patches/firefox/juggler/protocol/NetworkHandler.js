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
    this._enabled = false;
    this._pageNetwork = NetworkObserver.instance().pageNetworkForTarget(target);
    this._eventListeners = [];
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
    helper.removeListeners(this._eventListeners);
  }

  async _onRequest(eventDetails, channelKey) {
    this._session.emitEvent('Network.requestWillBeSent', eventDetails);
  }

  async _onResponse(eventDetails) {
    this._session.emitEvent('Network.responseReceived', eventDetails);
  }

  async _onRequestFinished(eventDetails) {
    this._session.emitEvent('Network.requestFinished', eventDetails);
  }

  async _onRequestFailed(eventDetails) {
    this._session.emitEvent('Network.requestFailed', eventDetails);
  }
}

var EXPORTED_SYMBOLS = ['NetworkHandler'];
this.NetworkHandler = NetworkHandler;

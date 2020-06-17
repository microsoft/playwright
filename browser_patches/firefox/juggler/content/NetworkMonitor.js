/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');

const helper = new Helper();

class NetworkMonitor {
  constructor(rootDocShell, frameTree) {
    this._frameTree = frameTree;
    this._requestDetails = new Map();

    this._eventListeners = [
      helper.addObserver(this._onRequest.bind(this), 'http-on-opening-request'),
    ];
  }

  _onRequest(channel) {
    if (!(channel instanceof Ci.nsIHttpChannel))
      return;
    const httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);
    const loadContext = helper.getLoadContext(httpChannel);
    if (!loadContext)
      return;
    try {
      const window = loadContext.associatedWindow;
      const frame = this._frameTree.frameForDocShell(window.docShell);
      if (!frame)
        return;
      this._requestDetails.set(httpChannel.channelId, {
        frameId: frame.id(),
      });
    } catch (e) {
      // Accessing loadContext.associatedWindow sometimes throws.
    }
  }

  requestDetails(channelId) {
    return this._requestDetails.get(channelId) || null;
  }

  dispose() {
    this._requestDetails.clear();
    helper.removeListeners(this._eventListeners);
  }
}

var EXPORTED_SYMBOLS = ['NetworkMonitor'];
this.NetworkMonitor = NetworkMonitor;


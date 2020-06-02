/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class AccessibilityHandler {
  constructor(session, contentChannel) {
    this._contentPage = contentChannel.connect(session.sessionId() + 'page');
  }

  async getFullAXTree(params) {
    return await this._contentPage.send('getFullAXTree', params);
  }

  dispose() {
    this._contentPage.dispose();
  }
}

var EXPORTED_SYMBOLS = ['AccessibilityHandler'];
this.AccessibilityHandler = AccessibilityHandler;

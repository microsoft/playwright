/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;
const Cc = Components.classes;

const {Helper} = ChromeUtils.import('chrome://juggler/content/Helper.js');
const {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");

const HIDDEN_SCROLLBARS = Services.io.newURI('chrome://juggler/content/content/hidden-scrollbars.css');
const FLOATING_SCROLLBARS = Services.io.newURI('chrome://juggler/content/content/floating-scrollbars.css');

const isHeadless = Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo).isHeadless;
const helper = new Helper();

class ScrollbarManager {
  constructor(docShell) {
    this._docShell = docShell;
    this._customScrollbars = null;
    this._contentViewerScrollBars = new Map();

    if (isHeadless)
      this._setCustomScrollbars(HIDDEN_SCROLLBARS);

    const webProgress = this._docShell.QueryInterface(Ci.nsIInterfaceRequestor)
                                .getInterface(Ci.nsIWebProgress);

    this.QueryInterface = ChromeUtils.generateQI(['nsIWebProgressListener', 'nsISupportsWeakReference']);
    this._eventListeners = [
      helper.addProgressListener(webProgress, this, Ci.nsIWebProgress.NOTIFY_ALL),
    ];
  }

  onLocationChange(webProgress, request, URI, flags) {
    if (flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT)
      return;
    this._updateAllDocShells();
  }

  setFloatingScrollbars(enabled) {
    if (this._customScrollbars === HIDDEN_SCROLLBARS)
      return;
    this._setCustomScrollbars(enabled ? FLOATING_SCROLLBARS : null);
  }

  _setCustomScrollbars(customScrollbars) {
    if (this._customScrollbars === customScrollbars)
      return;
    this._customScrollbars = customScrollbars;
    this._updateAllDocShells();
  }

  _updateAllDocShells() {
    const allDocShells = [this._docShell];
    for (let i = 0; i < this._docShell.childCount; i++)
      allDocShells.push(this._docShell.getChildAt(i).QueryInterface(Ci.nsIDocShell));
    // At this point, a content viewer might not be loaded for certain docShells.
    // Scrollbars will be updated in onLocationChange.
    const contentViewers = allDocShells.map(docShell => docShell.contentViewer).filter(contentViewer => !!contentViewer);

    // Update scrollbar stylesheets.
    for (const contentViewer of contentViewers) {
      const oldScrollbars = this._contentViewerScrollBars.get(contentViewer);
      if (oldScrollbars === this._customScrollbars)
        continue;
      const winUtils = contentViewer.DOMDocument.defaultView.windowUtils;
      if (oldScrollbars)
        winUtils.removeSheet(oldScrollbars, winUtils.AGENT_SHEET);
      if (this._customScrollbars)
        winUtils.loadSheet(this._customScrollbars, winUtils.AGENT_SHEET);
    }
    // Update state for all *existing* docShells.
    this._contentViewerScrollBars.clear();
    for (const contentViewer of contentViewers)
      this._contentViewerScrollBars.set(contentViewer, this._customScrollbars);
  }

  dispose() {
    this._setCustomScrollbars(null);
    helper.removeListeners(this._eventListeners);
  }
}

var EXPORTED_SYMBOLS = ['ScrollbarManager'];
this.ScrollbarManager = ScrollbarManager;


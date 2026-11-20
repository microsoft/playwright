/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const Ci = Components.interfaces;
const FILE_PICKER_CONTRACT_ID = '@mozilla.org/filepicker;1';

// Decide in content, before file-input-picker-opening reports the input to the client.
// An intercepted picker must stay intercepted even if the client then unsubscribes.
class FilePickerOverride {
  constructor() {
    this._interceptedBrowserIds = new Set();
    this._interceptedPickers = new WeakMap();
    this._registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    this._originalCID = this._registrar.contractIDToCID(FILE_PICKER_CONTRACT_ID);
    this._cid = Services.uuid.generateUUID();
    this._factory = {
      createInstance: iid => this._createPicker().QueryInterface(iid),
      QueryInterface: ChromeUtils.generateQI(['nsIFactory']),
    };
    this._registrar.registerFactory(this._cid, 'Juggler file picker', FILE_PICKER_CONTRACT_ID, this._factory);
  }

  setInterceptFileChooserDialog(browserId, enabled) {
    if (enabled)
      this._interceptedBrowserIds.add(browserId);
    else
      this._interceptedBrowserIds.delete(browserId);
  }

  filePickerShown(browsingContext) {
    const opened = this._interceptedPickers.get(browsingContext);
    this._interceptedPickers.delete(browsingContext);
    return opened;
  }

  _createOriginalPicker() {
    this._registrar.registerFactory(this._originalCID, 'Original file picker', FILE_PICKER_CONTRACT_ID, null);
    try {
      return Cc[FILE_PICKER_CONTRACT_ID].createInstance(Ci.nsIFilePicker);
    } finally {
      this._registrar.registerFactory(this._cid, 'Juggler file picker', FILE_PICKER_CONTRACT_ID, null);
    }
  }

  _createPicker() {
    let original = null;
    const state = {};
    const picker = {
      QueryInterface: ChromeUtils.generateQI(['nsIFilePicker']),
      init: (browsingContext, title, mode, global) => {
        if (this._interceptedBrowserIds.has(browsingContext.browserId)) {
          state.mode = mode;
          // The input observer runs synchronously after init(), before another picker can initialize.
          this._interceptedPickers.set(browsingContext, new Promise(resolve => state.resolveOpened = resolve));
          return;
        }
        original = this._createOriginalPicker();
        original.init(browsingContext, title, mode, global);
      },
      open: callback => {
        if (original)
          original.open(callback);
        else
          // HTMLInputElement sets mPickerRunning after open() returns.
          Services.tm.dispatchToMainThread(() => {
            callback.done(Ci.nsIFilePicker.returnOK);
            state.resolveOpened();
          });
      },
      isModeSupported: mode => original ? original.isModeSupported(mode) : Promise.resolve(true),
      appendFilters: filterMask => original?.appendFilters(filterMask),
      appendFilter: (title, filter) => original?.appendFilter(title, filter),
      appendRawFilter: filter => original?.appendRawFilter(filter),

      get defaultString() { return original ? original.defaultString : state.defaultString; },
      set defaultString(value) { if (original) original.defaultString = value; else state.defaultString = value; },
      get defaultExtension() { return original ? original.defaultExtension : state.defaultExtension; },
      set defaultExtension(value) { if (original) original.defaultExtension = value; else state.defaultExtension = value; },
      get filterIndex() { return original ? original.filterIndex : state.filterIndex; },
      set filterIndex(value) { if (original) original.filterIndex = value; else state.filterIndex = value; },
      get displayDirectory() { return original ? original.displayDirectory : state.displayDirectory; },
      set displayDirectory(value) { if (original) original.displayDirectory = value; else state.displayDirectory = value; },
      get displaySpecialDirectory() { return original ? original.displaySpecialDirectory : state.displaySpecialDirectory; },
      set displaySpecialDirectory(value) { if (original) original.displaySpecialDirectory = value; else state.displaySpecialDirectory = value; },
      get addToRecentDocs() { return original ? original.addToRecentDocs : state.addToRecentDocs; },
      set addToRecentDocs(value) { if (original) original.addToRecentDocs = value; else state.addToRecentDocs = value; },
      get okButtonLabel() { return original ? original.okButtonLabel : state.okButtonLabel; },
      set okButtonLabel(value) { if (original) original.okButtonLabel = value; else state.okButtonLabel = value; },
      get capture() { return original ? original.capture : state.capture; },
      set capture(value) { if (original) original.capture = value; else state.capture = value; },

      get mode() { return original ? original.mode : state.mode; },
      get file() { return original ? original.file : null; },
      get fileURL() { return original ? original.fileURL : null; },
      get files() { return original ? original.files : [][Symbol.iterator](); },
      get domFileOrDirectory() { return original ? original.domFileOrDirectory : null; },
      get domFileOrDirectoryEnumerator() { return original ? original.domFileOrDirectoryEnumerator : null; },
      get domFilesInWebKitDirectory() { return original ? original.domFilesInWebKitDirectory : null; },
    };
    return picker;
  }
}

export const filePicker = new FilePickerOverride();

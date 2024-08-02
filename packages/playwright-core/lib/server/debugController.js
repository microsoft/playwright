"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DebugController = void 0;
var _processLauncher = require("../utils/processLauncher");
var _instrumentation = require("./instrumentation");
var _recorder = require("./recorder");
var _recorderApp = require("./recorder/recorderApp");
var _locatorGenerators = require("../utils/isomorphic/locatorGenerators");
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

const internalMetadata = (0, _instrumentation.serverSideCallMetadata)();
class DebugController extends _instrumentation.SdkObject {
  constructor(playwright) {
    super({
      attribution: {
        isInternalPlaywright: true
      },
      instrumentation: (0, _instrumentation.createInstrumentation)()
    }, undefined, 'DebugController');
    this._autoCloseTimer = void 0;
    // TODO: remove in 1.27
    this._autoCloseAllowed = false;
    this._trackHierarchyListener = void 0;
    this._playwright = void 0;
    this._sdkLanguage = 'javascript';
    this._codegenId = 'playwright-test';
    this._playwright = playwright;
  }
  initialize(codegenId, sdkLanguage) {
    this._codegenId = codegenId;
    this._sdkLanguage = sdkLanguage;
    _recorder.Recorder.setAppFactory(async () => new InspectingRecorderApp(this));
  }
  setAutoCloseAllowed(allowed) {
    this._autoCloseAllowed = allowed;
  }
  dispose() {
    this.setReportStateChanged(false);
    this.setAutoCloseAllowed(false);
    _recorder.Recorder.setAppFactory(undefined);
  }
  setReportStateChanged(enabled) {
    if (enabled && !this._trackHierarchyListener) {
      this._trackHierarchyListener = {
        onPageOpen: () => this._emitSnapshot(),
        onPageClose: () => this._emitSnapshot()
      };
      this._playwright.instrumentation.addListener(this._trackHierarchyListener, null);
    } else if (!enabled && this._trackHierarchyListener) {
      this._playwright.instrumentation.removeListener(this._trackHierarchyListener);
      this._trackHierarchyListener = undefined;
    }
  }
  async resetForReuse() {
    const contexts = new Set();
    for (const page of this._playwright.allPages()) contexts.add(page.context());
    for (const context of contexts) await context.resetForReuse(internalMetadata, null);
  }
  async navigate(url) {
    for (const p of this._playwright.allPages()) await p.mainFrame().goto(internalMetadata, url);
  }
  async setRecorderMode(params) {
    // TODO: |file| is only used in the legacy mode.
    await this._closeBrowsersWithoutPages();
    if (params.mode === 'none') {
      for (const recorder of await this._allRecorders()) {
        recorder.hideHighlightedSelector();
        recorder.setMode('none');
      }
      this.setAutoCloseEnabled(true);
      return;
    }
    if (!this._playwright.allBrowsers().length) await this._playwright.chromium.launch(internalMetadata, {
      headless: !!process.env.PW_DEBUG_CONTROLLER_HEADLESS
    });
    // Create page if none.
    const pages = this._playwright.allPages();
    if (!pages.length) {
      const [browser] = this._playwright.allBrowsers();
      const {
        context
      } = await browser.newContextForReuse({}, internalMetadata);
      await context.newPage(internalMetadata);
    }
    // Update test id attribute.
    if (params.testIdAttributeName) {
      for (const page of this._playwright.allPages()) page.context().selectors().setTestIdAttributeName(params.testIdAttributeName);
    }
    // Toggle the mode.
    for (const recorder of await this._allRecorders()) {
      recorder.hideHighlightedSelector();
      if (params.mode !== 'inspecting') recorder.setOutput(this._codegenId, params.file);
      recorder.setMode(params.mode);
    }
    this.setAutoCloseEnabled(true);
  }
  async setAutoCloseEnabled(enabled) {
    if (!this._autoCloseAllowed) return;
    if (this._autoCloseTimer) clearTimeout(this._autoCloseTimer);
    if (!enabled) return;
    const heartBeat = () => {
      if (!this._playwright.allPages().length) (0, _processLauncher.gracefullyProcessExitDoNotHang)(0);else this._autoCloseTimer = setTimeout(heartBeat, 5000);
    };
    this._autoCloseTimer = setTimeout(heartBeat, 30000);
  }
  async highlight(selector) {
    for (const recorder of await this._allRecorders()) recorder.setHighlightedSelector(this._sdkLanguage, selector);
  }
  async hideHighlight() {
    // Hide all active recorder highlights.
    for (const recorder of await this._allRecorders()) recorder.hideHighlightedSelector();
    // Hide all locator.highlight highlights.
    await this._playwright.hideHighlight();
  }
  allBrowsers() {
    return [...this._playwright.allBrowsers()];
  }
  async resume() {
    for (const recorder of await this._allRecorders()) recorder.resume();
  }
  async kill() {
    (0, _processLauncher.gracefullyProcessExitDoNotHang)(0);
  }
  async closeAllBrowsers() {
    await Promise.all(this.allBrowsers().map(browser => browser.close({
      reason: 'Close all browsers requested'
    })));
  }
  _emitSnapshot() {
    const browsers = [];
    let pageCount = 0;
    for (const browser of this._playwright.allBrowsers()) {
      const b = {
        contexts: []
      };
      browsers.push(b);
      for (const context of browser.contexts()) {
        const c = {
          pages: []
        };
        b.contexts.push(c);
        for (const page of context.pages()) c.pages.push(page.mainFrame().url());
        pageCount += context.pages().length;
      }
    }
    this.emit(DebugController.Events.StateChanged, {
      pageCount
    });
  }
  async _allRecorders() {
    const contexts = new Set();
    for (const page of this._playwright.allPages()) contexts.add(page.context());
    const result = await Promise.all([...contexts].map(c => _recorder.Recorder.show(c, {
      omitCallTracking: true
    })));
    return result.filter(Boolean);
  }
  async _closeBrowsersWithoutPages() {
    for (const browser of this._playwright.allBrowsers()) {
      for (const context of browser.contexts()) {
        if (!context.pages().length) await context.close({
          reason: 'Browser collected'
        });
      }
      if (!browser.contexts()) await browser.close({
        reason: 'Browser collected'
      });
    }
  }
}
exports.DebugController = DebugController;
DebugController.Events = {
  StateChanged: 'stateChanged',
  InspectRequested: 'inspectRequested',
  SourceChanged: 'sourceChanged',
  Paused: 'paused',
  SetModeRequested: 'setModeRequested'
};
class InspectingRecorderApp extends _recorderApp.EmptyRecorderApp {
  constructor(debugController) {
    super();
    this._debugController = void 0;
    this._debugController = debugController;
  }
  async setSelector(selector) {
    const locator = (0, _locatorGenerators.asLocator)(this._debugController._sdkLanguage, selector);
    this._debugController.emit(DebugController.Events.InspectRequested, {
      selector,
      locator
    });
  }
  async setSources(sources) {
    const source = sources.find(s => s.id === this._debugController._codegenId);
    const {
      text,
      header,
      footer,
      actions
    } = source || {
      text: ''
    };
    this._debugController.emit(DebugController.Events.SourceChanged, {
      text,
      header,
      footer,
      actions
    });
  }
  async setPaused(paused) {
    this._debugController.emit(DebugController.Events.Paused, {
      paused
    });
  }
  async setMode(mode) {
    this._debugController.emit(DebugController.Events.SetModeRequested, {
      mode
    });
  }
}
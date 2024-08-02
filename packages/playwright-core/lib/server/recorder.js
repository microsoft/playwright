"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Recorder = void 0;
var fs = _interopRequireWildcard(require("fs"));
var _codeGenerator = require("./recorder/codeGenerator");
var _utils = require("./recorder/utils");
var _page = require("./page");
var _frames = require("./frames");
var _browserContext = require("./browserContext");
var _java = require("./recorder/java");
var _javascript = require("./recorder/javascript");
var _jsonl = require("./recorder/jsonl");
var _csharp = require("./recorder/csharp");
var _python = require("./recorder/python");
var recorderSource = _interopRequireWildcard(require("../generated/recorderSource"));
var consoleApiSource = _interopRequireWildcard(require("../generated/consoleApiSource"));
var _recorderApp = require("./recorder/recorderApp");
var _utils2 = require("../utils");
var _recorderUtils = require("./recorder/recorderUtils");
var _debugger = require("./debugger");
var _events = require("events");
var _timeoutRunner = require("../utils/timeoutRunner");
var _locatorParser = require("../utils/isomorphic/locatorParser");
var _stringUtils = require("../utils/isomorphic/stringUtils");
var _eventsHelper = require("./../utils/eventsHelper");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

const recorderSymbol = Symbol('recorderSymbol');
class Recorder {
  static setAppFactory(recorderAppFactory) {
    Recorder.recorderAppFactory = recorderAppFactory;
  }
  static showInspector(context) {
    const params = {};
    if ((0, _utils2.isUnderTest)()) params.language = process.env.TEST_INSPECTOR_LANGUAGE;
    Recorder.show(context, params).catch(() => {});
  }
  static show(context, params = {}) {
    let recorderPromise = context[recorderSymbol];
    if (!recorderPromise) {
      const recorder = new Recorder(context, params);
      recorderPromise = recorder.install().then(() => recorder);
      context[recorderSymbol] = recorderPromise;
    }
    return recorderPromise;
  }
  constructor(context, params) {
    this._context = void 0;
    this._mode = void 0;
    this._highlightedSelector = '';
    this._overlayState = {
      offsetX: 0
    };
    this._recorderApp = null;
    this._currentCallsMetadata = new Map();
    this._recorderSources = [];
    this._userSources = new Map();
    this._debugger = void 0;
    this._contextRecorder = void 0;
    this._handleSIGINT = void 0;
    this._omitCallTracking = false;
    this._currentLanguage = void 0;
    this._mode = params.mode || 'none';
    this._contextRecorder = new ContextRecorder(context, params);
    this._context = context;
    this._omitCallTracking = !!params.omitCallTracking;
    this._debugger = context.debugger();
    this._handleSIGINT = params.handleSIGINT;
    context.instrumentation.addListener(this, context);
    this._currentLanguage = this._contextRecorder.languageName();
    if ((0, _utils2.isUnderTest)()) {
      // Most of our tests put elements at the top left, so get out of the way.
      this._overlayState.offsetX = 200;
    }
  }
  static async defaultRecorderAppFactory(recorder) {
    if (process.env.PW_CODEGEN_NO_INSPECTOR) return new _recorderApp.EmptyRecorderApp();
    return await _recorderApp.RecorderApp.open(recorder, recorder._context, recorder._handleSIGINT);
  }
  async install() {
    const recorderApp = await (Recorder.recorderAppFactory || Recorder.defaultRecorderAppFactory)(this);
    this._recorderApp = recorderApp;
    recorderApp.once('close', () => {
      this._debugger.resume(false);
      this._recorderApp = null;
    });
    recorderApp.on('event', data => {
      if (data.event === 'setMode') {
        this.setMode(data.params.mode);
        return;
      }
      if (data.event === 'selectorUpdated') {
        this.setHighlightedSelector(this._currentLanguage, data.params.selector);
        return;
      }
      if (data.event === 'step') {
        this._debugger.resume(true);
        return;
      }
      if (data.event === 'fileChanged') {
        this._currentLanguage = this._contextRecorder.languageName(data.params.file);
        this._refreshOverlay();
        return;
      }
      if (data.event === 'resume') {
        this._debugger.resume(false);
        return;
      }
      if (data.event === 'pause') {
        this._debugger.pauseOnNextStatement();
        return;
      }
      if (data.event === 'clear') {
        this._contextRecorder.clearScript();
        return;
      }
    });
    await Promise.all([recorderApp.setMode(this._mode), recorderApp.setPaused(this._debugger.isPaused()), this._pushAllSources()]);
    this._context.once(_browserContext.BrowserContext.Events.Close, () => {
      this._contextRecorder.dispose();
      this._context.instrumentation.removeListener(this);
      recorderApp.close().catch(() => {});
    });
    this._contextRecorder.on(ContextRecorder.Events.Change, data => {
      var _this$_recorderApp;
      this._recorderSources = data.sources;
      this._pushAllSources();
      (_this$_recorderApp = this._recorderApp) === null || _this$_recorderApp === void 0 || _this$_recorderApp.setFileIfNeeded(data.primaryFileName);
    });
    await this._context.exposeBinding('__pw_recorderState', false, source => {
      let actionSelector = '';
      let actionPoint;
      const hasActiveScreenshotCommand = [...this._currentCallsMetadata.keys()].some(isScreenshotCommand);
      if (!hasActiveScreenshotCommand) {
        actionSelector = this._highlightedSelector;
        for (const [metadata, sdkObject] of this._currentCallsMetadata) {
          if (source.page === sdkObject.attribution.page) {
            actionPoint = metadata.point || actionPoint;
            actionSelector = actionSelector || metadata.params.selector;
          }
        }
      }
      const uiState = {
        mode: this._mode,
        actionPoint,
        actionSelector,
        language: this._currentLanguage,
        testIdAttributeName: this._contextRecorder.testIdAttributeName(),
        overlay: this._overlayState
      };
      return uiState;
    });
    await this._context.exposeBinding('__pw_recorderSetSelector', false, async ({
      frame
    }, selector) => {
      var _this$_recorderApp2;
      const selectorPromises = [];
      let currentFrame = frame;
      while (currentFrame) {
        selectorPromises.push(findFrameSelector(currentFrame));
        currentFrame = currentFrame.parentFrame();
      }
      const fullSelector = (await Promise.all(selectorPromises)).filter(Boolean);
      fullSelector.push(selector);
      await ((_this$_recorderApp2 = this._recorderApp) === null || _this$_recorderApp2 === void 0 ? void 0 : _this$_recorderApp2.setSelector(fullSelector.join(' >> internal:control=enter-frame >> '), true));
    });
    await this._context.exposeBinding('__pw_recorderSetMode', false, async ({
      frame
    }, mode) => {
      if (frame.parentFrame()) return;
      this.setMode(mode);
    });
    await this._context.exposeBinding('__pw_recorderSetOverlayState', false, async ({
      frame
    }, state) => {
      if (frame.parentFrame()) return;
      this._overlayState = state;
    });
    await this._context.exposeBinding('__pw_resume', false, () => {
      this._debugger.resume(false);
    });
    await this._context.extendInjectedScript(consoleApiSource.source);
    await this._contextRecorder.install();
    if (this._debugger.isPaused()) this._pausedStateChanged();
    this._debugger.on(_debugger.Debugger.Events.PausedStateChanged, () => this._pausedStateChanged());
    this._context.recorderAppForTest = recorderApp;
  }
  _pausedStateChanged() {
    var _this$_recorderApp3;
    // If we are called upon page.pause, we don't have metadatas, populate them.
    for (const {
      metadata,
      sdkObject
    } of this._debugger.pausedDetails()) {
      if (!this._currentCallsMetadata.has(metadata)) this.onBeforeCall(sdkObject, metadata);
    }
    (_this$_recorderApp3 = this._recorderApp) === null || _this$_recorderApp3 === void 0 || _this$_recorderApp3.setPaused(this._debugger.isPaused());
    this._updateUserSources();
    this.updateCallLog([...this._currentCallsMetadata.keys()]);
  }
  setMode(mode) {
    var _this$_recorderApp4;
    if (this._mode === mode) return;
    this._highlightedSelector = '';
    this._mode = mode;
    (_this$_recorderApp4 = this._recorderApp) === null || _this$_recorderApp4 === void 0 || _this$_recorderApp4.setMode(this._mode);
    this._contextRecorder.setEnabled(this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue');
    this._debugger.setMuted(this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue');
    if (this._mode !== 'none' && this._mode !== 'standby' && this._context.pages().length === 1) this._context.pages()[0].bringToFront().catch(() => {});
    this._refreshOverlay();
  }
  resume() {
    this._debugger.resume(false);
  }
  mode() {
    return this._mode;
  }
  setHighlightedSelector(language, selector) {
    this._highlightedSelector = (0, _locatorParser.locatorOrSelectorAsSelector)(language, selector, this._context.selectors().testIdAttributeName());
    this._refreshOverlay();
  }
  hideHighlightedSelector() {
    this._highlightedSelector = '';
    this._refreshOverlay();
  }
  setOutput(codegenId, outputFile) {
    this._contextRecorder.setOutput(codegenId, outputFile);
  }
  _refreshOverlay() {
    for (const page of this._context.pages()) page.mainFrame().evaluateExpression('window.__pw_refreshOverlay()').catch(() => {});
  }
  async onBeforeCall(sdkObject, metadata) {
    if (this._omitCallTracking || this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue') return;
    this._currentCallsMetadata.set(metadata, sdkObject);
    this._updateUserSources();
    this.updateCallLog([metadata]);
    if (isScreenshotCommand(metadata)) {
      this.hideHighlightedSelector();
    } else if (metadata.params && metadata.params.selector) {
      var _this$_recorderApp5;
      this._highlightedSelector = metadata.params.selector;
      (_this$_recorderApp5 = this._recorderApp) === null || _this$_recorderApp5 === void 0 || _this$_recorderApp5.setSelector(this._highlightedSelector).catch(() => {});
    }
  }
  async onAfterCall(sdkObject, metadata) {
    if (this._omitCallTracking || this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue') return;
    if (!metadata.error) this._currentCallsMetadata.delete(metadata);
    this._updateUserSources();
    this.updateCallLog([metadata]);
  }
  _updateUserSources() {
    var _this$_recorderApp6;
    // Remove old decorations.
    for (const source of this._userSources.values()) {
      source.highlight = [];
      source.revealLine = undefined;
    }

    // Apply new decorations.
    let fileToSelect = undefined;
    for (const metadata of this._currentCallsMetadata.keys()) {
      if (!metadata.location) continue;
      const {
        file,
        line
      } = metadata.location;
      let source = this._userSources.get(file);
      if (!source) {
        source = {
          isRecorded: false,
          label: file,
          id: file,
          text: this._readSource(file),
          highlight: [],
          language: languageForFile(file)
        };
        this._userSources.set(file, source);
      }
      if (line) {
        const paused = this._debugger.isPaused(metadata);
        source.highlight.push({
          line,
          type: metadata.error ? 'error' : paused ? 'paused' : 'running'
        });
        source.revealLine = line;
        fileToSelect = source.id;
      }
    }
    this._pushAllSources();
    if (fileToSelect) (_this$_recorderApp6 = this._recorderApp) === null || _this$_recorderApp6 === void 0 || _this$_recorderApp6.setFileIfNeeded(fileToSelect);
  }
  _pushAllSources() {
    var _this$_recorderApp7;
    (_this$_recorderApp7 = this._recorderApp) === null || _this$_recorderApp7 === void 0 || _this$_recorderApp7.setSources([...this._recorderSources, ...this._userSources.values()]);
  }
  async onBeforeInputAction(sdkObject, metadata) {}
  async onCallLog(sdkObject, metadata, logName, message) {
    this.updateCallLog([metadata]);
  }
  updateCallLog(metadatas) {
    var _this$_recorderApp8;
    if (this._mode === 'recording' || this._mode === 'assertingText' || this._mode === 'assertingVisibility' || this._mode === 'assertingValue') return;
    const logs = [];
    for (const metadata of metadatas) {
      if (!metadata.method || metadata.internal) continue;
      let status = 'done';
      if (this._currentCallsMetadata.has(metadata)) status = 'in-progress';
      if (this._debugger.isPaused(metadata)) status = 'paused';
      logs.push((0, _recorderUtils.metadataToCallLog)(metadata, status));
    }
    (_this$_recorderApp8 = this._recorderApp) === null || _this$_recorderApp8 === void 0 || _this$_recorderApp8.updateCallLogs(logs);
  }
  _readSource(fileName) {
    try {
      return fs.readFileSync(fileName, 'utf-8');
    } catch (e) {
      return '// No source available';
    }
  }
}
exports.Recorder = Recorder;
Recorder.recorderAppFactory = void 0;
class ContextRecorder extends _events.EventEmitter {
  constructor(context, params) {
    super();
    this._generator = void 0;
    this._pageAliases = new Map();
    this._lastPopupOrdinal = 0;
    this._lastDialogOrdinal = -1;
    this._lastDownloadOrdinal = -1;
    this._timers = new Set();
    this._context = void 0;
    this._params = void 0;
    this._recorderSources = void 0;
    this._throttledOutputFile = null;
    this._orderedLanguages = [];
    this._listeners = [];
    this._context = context;
    this._params = params;
    this._recorderSources = [];
    const language = params.language || context.attribution.playwright.options.sdkLanguage;
    this.setOutput(language, params.outputFile);
    const generator = new _codeGenerator.CodeGenerator(context._browser.options.name, params.mode === 'recording', params.launchOptions || {}, params.contextOptions || {}, params.device, params.saveStorage);
    generator.on('change', () => {
      this._recorderSources = [];
      for (const languageGenerator of this._orderedLanguages) {
        var _this$_throttledOutpu;
        const {
          header,
          footer,
          actions,
          text
        } = generator.generateStructure(languageGenerator);
        const source = {
          isRecorded: true,
          label: languageGenerator.name,
          group: languageGenerator.groupName,
          id: languageGenerator.id,
          text,
          header,
          footer,
          actions,
          language: languageGenerator.highlighter,
          highlight: []
        };
        source.revealLine = text.split('\n').length - 1;
        this._recorderSources.push(source);
        if (languageGenerator === this._orderedLanguages[0]) (_this$_throttledOutpu = this._throttledOutputFile) === null || _this$_throttledOutpu === void 0 || _this$_throttledOutpu.setContent(source.text);
      }
      this.emit(ContextRecorder.Events.Change, {
        sources: this._recorderSources,
        primaryFileName: this._orderedLanguages[0].id
      });
    });
    context.on(_browserContext.BrowserContext.Events.BeforeClose, () => {
      var _this$_throttledOutpu2;
      (_this$_throttledOutpu2 = this._throttledOutputFile) === null || _this$_throttledOutpu2 === void 0 || _this$_throttledOutpu2.flush();
    });
    this._listeners.push(_eventsHelper.eventsHelper.addEventListener(process, 'exit', () => {
      var _this$_throttledOutpu3;
      (_this$_throttledOutpu3 = this._throttledOutputFile) === null || _this$_throttledOutpu3 === void 0 || _this$_throttledOutpu3.flush();
    }));
    this._generator = generator;
  }
  setOutput(codegenId, outputFile) {
    var _this$_generator;
    const languages = new Set([new _java.JavaLanguageGenerator('junit'), new _java.JavaLanguageGenerator('library'), new _javascript.JavaScriptLanguageGenerator( /* isPlaywrightTest */false), new _javascript.JavaScriptLanguageGenerator( /* isPlaywrightTest */true), new _python.PythonLanguageGenerator( /* isAsync */false, /* isPytest */true), new _python.PythonLanguageGenerator( /* isAsync */false, /* isPytest */false), new _python.PythonLanguageGenerator( /* isAsync */true, /* isPytest */false), new _csharp.CSharpLanguageGenerator('mstest'), new _csharp.CSharpLanguageGenerator('nunit'), new _csharp.CSharpLanguageGenerator('library'), new _jsonl.JsonlLanguageGenerator()]);
    const primaryLanguage = [...languages].find(l => l.id === codegenId);
    if (!primaryLanguage) throw new Error(`\n===============================\nUnsupported language: '${codegenId}'\n===============================\n`);
    languages.delete(primaryLanguage);
    this._orderedLanguages = [primaryLanguage, ...languages];
    this._throttledOutputFile = outputFile ? new ThrottledFile(outputFile) : null;
    (_this$_generator = this._generator) === null || _this$_generator === void 0 || _this$_generator.restart();
  }
  languageName(id) {
    for (const lang of this._orderedLanguages) {
      if (!id || lang.id === id) return lang.highlighter;
    }
    return 'javascript';
  }
  async install() {
    this._context.on(_browserContext.BrowserContext.Events.Page, page => this._onPage(page));
    for (const page of this._context.pages()) this._onPage(page);
    this._context.on(_browserContext.BrowserContext.Events.Dialog, dialog => this._onDialog(dialog.page()));

    // Input actions that potentially lead to navigation are intercepted on the page and are
    // performed by the Playwright.
    await this._context.exposeBinding('__pw_recorderPerformAction', false, (source, action) => this._performAction(source.frame, action));

    // Other non-essential actions are simply being recorded.
    await this._context.exposeBinding('__pw_recorderRecordAction', false, (source, action) => this._recordAction(source.frame, action));
    await this._context.extendInjectedScript(recorderSource.source);
  }
  setEnabled(enabled) {
    this._generator.setEnabled(enabled);
  }
  dispose() {
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.clear();
    _eventsHelper.eventsHelper.removeEventListeners(this._listeners);
  }
  async _onPage(page) {
    // First page is called page, others are called popup1, popup2, etc.
    const frame = page.mainFrame();
    page.on('close', () => {
      this._generator.addAction({
        frame: this._describeMainFrame(page),
        committed: true,
        action: {
          name: 'closePage',
          signals: []
        }
      });
      this._pageAliases.delete(page);
    });
    frame.on(_frames.Frame.Events.InternalNavigation, event => {
      if (event.isPublic) this._onFrameNavigated(frame, page);
    });
    page.on(_page.Page.Events.Download, () => this._onDownload(page));
    const suffix = this._pageAliases.size ? String(++this._lastPopupOrdinal) : '';
    const pageAlias = 'page' + suffix;
    this._pageAliases.set(page, pageAlias);
    if (page.opener()) {
      this._onPopup(page.opener(), page);
    } else {
      this._generator.addAction({
        frame: this._describeMainFrame(page),
        committed: true,
        action: {
          name: 'openPage',
          url: page.mainFrame().url(),
          signals: []
        }
      });
    }
  }
  clearScript() {
    this._generator.restart();
    if (this._params.mode === 'recording') {
      for (const page of this._context.pages()) this._onFrameNavigated(page.mainFrame(), page);
    }
  }
  _describeMainFrame(page) {
    return {
      pageAlias: this._pageAliases.get(page),
      isMainFrame: true
    };
  }
  async _describeFrame(frame) {
    const page = frame._page;
    const pageAlias = this._pageAliases.get(page);
    const chain = [];
    for (let ancestor = frame; ancestor; ancestor = ancestor.parentFrame()) chain.push(ancestor);
    chain.reverse();
    if (chain.length === 1) return this._describeMainFrame(page);
    const selectorPromises = [];
    for (let i = 0; i < chain.length - 1; i++) selectorPromises.push(findFrameSelector(chain[i + 1]));
    const result = await (0, _timeoutRunner.raceAgainstDeadline)(() => Promise.all(selectorPromises), (0, _utils2.monotonicTime)() + 2000);
    if (!result.timedOut && result.result.every(selector => !!selector)) {
      return {
        pageAlias,
        isMainFrame: false,
        selectorsChain: result.result
      };
    }
    // Best effort to find a selector for the frame.
    const selectorsChain = [];
    for (let i = 0; i < chain.length - 1; i++) {
      if (chain[i].name()) selectorsChain.push(`iframe[name=${(0, _stringUtils.quoteCSSAttributeValue)(chain[i].name())}]`);else selectorsChain.push(`iframe[src=${(0, _stringUtils.quoteCSSAttributeValue)(chain[i].url())}]`);
    }
    return {
      pageAlias,
      isMainFrame: false,
      selectorsChain
    };
  }
  testIdAttributeName() {
    return this._params.testIdAttributeName || this._context.selectors().testIdAttributeName() || 'data-testid';
  }
  async _performAction(frame, action) {
    // Commit last action so that no further signals are added to it.
    this._generator.commitLastAction();
    const frameDescription = await this._describeFrame(frame);
    const actionInContext = {
      frame: frameDescription,
      action
    };
    const perform = async (action, params, cb) => {
      const callMetadata = {
        id: `call@${(0, _utils2.createGuid)()}`,
        apiName: 'frame.' + action,
        objectId: frame.guid,
        pageId: frame._page.guid,
        frameId: frame.guid,
        startTime: (0, _utils2.monotonicTime)(),
        endTime: 0,
        type: 'Frame',
        method: action,
        params,
        log: []
      };
      this._generator.willPerformAction(actionInContext);
      try {
        await frame.instrumentation.onBeforeCall(frame, callMetadata);
        await cb(callMetadata);
      } catch (e) {
        callMetadata.endTime = (0, _utils2.monotonicTime)();
        await frame.instrumentation.onAfterCall(frame, callMetadata);
        this._generator.performedActionFailed(actionInContext);
        return;
      }
      callMetadata.endTime = (0, _utils2.monotonicTime)();
      await frame.instrumentation.onAfterCall(frame, callMetadata);
      this._setCommittedAfterTimeout(actionInContext);
      this._generator.didPerformAction(actionInContext);
    };
    const kActionTimeout = 5000;
    if (action.name === 'click') {
      const {
        options
      } = (0, _utils.toClickOptions)(action);
      await perform('click', {
        selector: action.selector
      }, callMetadata => frame.click(callMetadata, action.selector, {
        ...options,
        timeout: kActionTimeout,
        strict: true
      }));
    }
    if (action.name === 'press') {
      const modifiers = (0, _utils.toModifiers)(action.modifiers);
      const shortcut = [...modifiers, action.key].join('+');
      await perform('press', {
        selector: action.selector,
        key: shortcut
      }, callMetadata => frame.press(callMetadata, action.selector, shortcut, {
        timeout: kActionTimeout,
        strict: true
      }));
    }
    if (action.name === 'check') await perform('check', {
      selector: action.selector
    }, callMetadata => frame.check(callMetadata, action.selector, {
      timeout: kActionTimeout,
      strict: true
    }));
    if (action.name === 'uncheck') await perform('uncheck', {
      selector: action.selector
    }, callMetadata => frame.uncheck(callMetadata, action.selector, {
      timeout: kActionTimeout,
      strict: true
    }));
    if (action.name === 'select') {
      const values = action.options.map(value => ({
        value
      }));
      await perform('selectOption', {
        selector: action.selector,
        values
      }, callMetadata => frame.selectOption(callMetadata, action.selector, [], values, {
        timeout: kActionTimeout,
        strict: true
      }));
    }
  }
  async _recordAction(frame, action) {
    // Commit last action so that no further signals are added to it.
    this._generator.commitLastAction();
    const frameDescription = await this._describeFrame(frame);
    const actionInContext = {
      frame: frameDescription,
      action
    };
    this._setCommittedAfterTimeout(actionInContext);
    this._generator.addAction(actionInContext);
  }
  _setCommittedAfterTimeout(actionInContext) {
    const timer = setTimeout(() => {
      // Commit the action after 5 seconds so that no further signals are added to it.
      actionInContext.committed = true;
      this._timers.delete(timer);
    }, (0, _utils2.isUnderTest)() ? 500 : 5000);
    this._timers.add(timer);
  }
  _onFrameNavigated(frame, page) {
    const pageAlias = this._pageAliases.get(page);
    this._generator.signal(pageAlias, frame, {
      name: 'navigation',
      url: frame.url()
    });
  }
  _onPopup(page, popup) {
    const pageAlias = this._pageAliases.get(page);
    const popupAlias = this._pageAliases.get(popup);
    this._generator.signal(pageAlias, page.mainFrame(), {
      name: 'popup',
      popupAlias
    });
  }
  _onDownload(page) {
    const pageAlias = this._pageAliases.get(page);
    ++this._lastDownloadOrdinal;
    this._generator.signal(pageAlias, page.mainFrame(), {
      name: 'download',
      downloadAlias: this._lastDownloadOrdinal ? String(this._lastDownloadOrdinal) : ''
    });
  }
  _onDialog(page) {
    const pageAlias = this._pageAliases.get(page);
    ++this._lastDialogOrdinal;
    this._generator.signal(pageAlias, page.mainFrame(), {
      name: 'dialog',
      dialogAlias: this._lastDialogOrdinal ? String(this._lastDialogOrdinal) : ''
    });
  }
}
ContextRecorder.Events = {
  Change: 'change'
};
function languageForFile(file) {
  if (file.endsWith('.py')) return 'python';
  if (file.endsWith('.java')) return 'java';
  if (file.endsWith('.cs')) return 'csharp';
  return 'javascript';
}
class ThrottledFile {
  constructor(file) {
    this._file = void 0;
    this._timer = void 0;
    this._text = void 0;
    this._file = file;
  }
  setContent(text) {
    this._text = text;
    if (!this._timer) this._timer = setTimeout(() => this.flush(), 250);
  }
  flush() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (this._text) fs.writeFileSync(this._file, this._text);
    this._text = undefined;
  }
}
function isScreenshotCommand(metadata) {
  return metadata.method.toLowerCase().includes('screenshot');
}
async function findFrameSelector(frame) {
  try {
    const parent = frame.parentFrame();
    const frameElement = await frame.frameElement();
    if (!frameElement || !parent) return;
    const utility = await parent._utilityContext();
    const injected = await utility.injectedScript();
    const selector = await injected.evaluate((injected, element) => {
      return injected.generateSelectorSimple(element, {
        testIdAttributeName: '',
        omitInternalEngines: true
      });
    }, frameElement);
    return selector;
  } catch (e) {}
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tracing = void 0;
exports.shouldCaptureSnapshot = shouldCaptureSnapshot;
var _fs = _interopRequireDefault(require("fs"));
var _os = _interopRequireDefault(require("os"));
var _path = _interopRequireDefault(require("path"));
var _debug = require("../../../protocol/debug");
var _utils = require("../../../utils");
var _artifact = require("../../artifact");
var _browserContext = require("../../browserContext");
var _instrumentation = require("../../instrumentation");
var _page = require("../../page");
var _harTracer = require("../../har/harTracer");
var _snapshotter = require("./snapshotter");
var _dispatcher = require("../../dispatchers/dispatcher");
var _errors = require("../../errors");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const version = 7;
const kScreencastOptions = {
  width: 800,
  height: 600,
  quality: 90
};
class Tracing extends _instrumentation.SdkObject {
  constructor(context, tracesDir) {
    super(context, 'tracing');
    this._fs = new _utils.SerializedFS();
    this._snapshotter = void 0;
    this._harTracer = void 0;
    this._screencastListeners = [];
    this._eventListeners = [];
    this._context = void 0;
    // Note: state should only be touched inside API methods, but not inside trace operations.
    this._state = void 0;
    this._isStopping = false;
    this._precreatedTracesDir = void 0;
    this._tracesTmpDir = void 0;
    this._allResources = new Set();
    this._contextCreatedEvent = void 0;
    this._pendingHarEntries = new Set();
    this._context = context;
    this._precreatedTracesDir = tracesDir;
    this._harTracer = new _harTracer.HarTracer(context, null, this, {
      content: 'attach',
      includeTraceInfo: true,
      recordRequestOverrides: false,
      waitForContentOnStop: false
    });
    const testIdAttributeName = 'selectors' in context ? context.selectors().testIdAttributeName() : undefined;
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      origin: 'library',
      browserName: '',
      options: {},
      platform: process.platform,
      wallTime: 0,
      monotonicTime: 0,
      sdkLanguage: context.attribution.playwright.options.sdkLanguage,
      testIdAttributeName
    };
    if (context instanceof _browserContext.BrowserContext) {
      this._snapshotter = new _snapshotter.Snapshotter(context, this);
      (0, _utils.assert)(tracesDir, 'tracesDir must be specified for BrowserContext');
      this._contextCreatedEvent.browserName = context._browser.options.name;
      this._contextCreatedEvent.channel = context._browser.options.channel;
      this._contextCreatedEvent.options = context._options;
    }
  }
  async resetForReuse() {
    var _this$_snapshotter;
    // Discard previous chunk if any and ignore any errors there.
    await this.stopChunk({
      mode: 'discard'
    }).catch(() => {});
    await this.stop();
    (_this$_snapshotter = this._snapshotter) === null || _this$_snapshotter === void 0 || _this$_snapshotter.resetForReuse();
  }
  async start(options) {
    if (this._isStopping) throw new Error('Cannot start tracing while stopping');
    if (this._state) throw new Error('Tracing has been already started');

    // Re-write for testing.
    this._contextCreatedEvent.sdkLanguage = this._context.attribution.playwright.options.sdkLanguage;

    // TODO: passing the same name for two contexts makes them write into a single file
    // and conflict.
    const traceName = options.name || (0, _utils.createGuid)();
    const tracesDir = this._createTracesDirIfNeeded();

    // Init the state synchronously.
    this._state = {
      options,
      traceName,
      tracesDir,
      traceFile: _path.default.join(tracesDir, traceName + '.trace'),
      networkFile: _path.default.join(tracesDir, traceName + '.network'),
      resourcesDir: _path.default.join(tracesDir, 'resources'),
      chunkOrdinal: 0,
      traceSha1s: new Set(),
      networkSha1s: new Set(),
      recording: false,
      callIds: new Set()
    };
    this._fs.mkdir(this._state.resourcesDir);
    this._fs.writeFile(this._state.networkFile, '');
    // Tracing is 10x bigger if we include scripts in every trace.
    if (options.snapshots) this._harTracer.start({
      omitScripts: !options.live
    });
  }
  async startChunk(options = {}) {
    var _this$_snapshotter2;
    if (this._state && this._state.recording) await this.stopChunk({
      mode: 'discard'
    });
    if (!this._state) throw new Error('Must start tracing before starting a new chunk');
    if (this._isStopping) throw new Error('Cannot start a trace chunk while stopping');
    this._state.recording = true;
    this._state.callIds.clear();
    if (options.name && options.name !== this._state.traceName) this._changeTraceName(this._state, options.name);else this._allocateNewTraceFile(this._state);
    this._fs.mkdir(_path.default.dirname(this._state.traceFile));
    const event = {
      ...this._contextCreatedEvent,
      title: options.title,
      wallTime: Date.now(),
      monotonicTime: (0, _utils.monotonicTime)()
    };
    this._fs.appendFile(this._state.traceFile, JSON.stringify(event) + '\n');
    this._context.instrumentation.addListener(this, this._context);
    this._eventListeners.push(_utils.eventsHelper.addEventListener(this._context, _browserContext.BrowserContext.Events.Console, this._onConsoleMessage.bind(this)), _utils.eventsHelper.addEventListener(this._context, _browserContext.BrowserContext.Events.PageError, this._onPageError.bind(this)));
    if (this._state.options.screenshots) this._startScreencast();
    if (this._state.options.snapshots) await ((_this$_snapshotter2 = this._snapshotter) === null || _this$_snapshotter2 === void 0 ? void 0 : _this$_snapshotter2.start());
    return {
      traceName: this._state.traceName
    };
  }
  _startScreencast() {
    if (!(this._context instanceof _browserContext.BrowserContext)) return;
    for (const page of this._context.pages()) this._startScreencastInPage(page);
    this._screencastListeners.push(_utils.eventsHelper.addEventListener(this._context, _browserContext.BrowserContext.Events.Page, this._startScreencastInPage.bind(this)));
  }
  _stopScreencast() {
    _utils.eventsHelper.removeEventListeners(this._screencastListeners);
    if (!(this._context instanceof _browserContext.BrowserContext)) return;
    for (const page of this._context.pages()) page.setScreencastOptions(null);
  }
  _allocateNewTraceFile(state) {
    const suffix = state.chunkOrdinal ? `-chunk${state.chunkOrdinal}` : ``;
    state.chunkOrdinal++;
    state.traceFile = _path.default.join(state.tracesDir, `${state.traceName}${suffix}.trace`);
  }
  _changeTraceName(state, name) {
    state.traceName = name;
    state.chunkOrdinal = 0; // Reset ordinal for the new name.
    this._allocateNewTraceFile(state);

    // Network file survives across chunks, so make a copy with the new name.
    const newNetworkFile = _path.default.join(state.tracesDir, name + '.network');
    this._fs.copyFile(state.networkFile, newNetworkFile);
    state.networkFile = newNetworkFile;
  }
  async stop() {
    if (!this._state) return;
    if (this._isStopping) throw new Error(`Tracing is already stopping`);
    if (this._state.recording) throw new Error(`Must stop trace file before stopping tracing`);
    this._harTracer.stop();
    this.flushHarEntries();
    await this._fs.syncAndGetError();
    this._state = undefined;
  }
  async deleteTmpTracesDir() {
    if (this._tracesTmpDir) await (0, _utils.removeFolders)([this._tracesTmpDir]);
  }
  _createTracesDirIfNeeded() {
    if (this._precreatedTracesDir) return this._precreatedTracesDir;
    this._tracesTmpDir = _fs.default.mkdtempSync(_path.default.join(_os.default.tmpdir(), 'playwright-tracing-'));
    return this._tracesTmpDir;
  }
  abort() {
    var _this$_snapshotter3;
    (_this$_snapshotter3 = this._snapshotter) === null || _this$_snapshotter3 === void 0 || _this$_snapshotter3.dispose();
    this._harTracer.stop();
  }
  async flush() {
    this.abort();
    await this._fs.syncAndGetError();
  }
  async stopChunk(params) {
    var _this$_snapshotter4;
    if (this._isStopping) throw new Error(`Tracing is already stopping`);
    this._isStopping = true;
    if (!this._state || !this._state.recording) {
      this._isStopping = false;
      if (params.mode !== 'discard') throw new Error(`Must start tracing before stopping`);
      return {};
    }
    this._context.instrumentation.removeListener(this);
    _utils.eventsHelper.removeEventListeners(this._eventListeners);
    if (this._state.options.screenshots) this._stopScreencast();
    if (this._state.options.snapshots) await ((_this$_snapshotter4 = this._snapshotter) === null || _this$_snapshotter4 === void 0 ? void 0 : _this$_snapshotter4.stop());
    this.flushHarEntries();

    // Network file survives across chunks, make a snapshot before returning the resulting entries.
    // We should pick a name starting with "traceName" and ending with .network.
    // Something like <traceName>someSuffixHere.network.
    // However, this name must not clash with any other "traceName".network in the same tracesDir.
    // We can use <traceName>-<guid>.network, but "-pwnetcopy-0" suffix is more readable
    // and makes it easier to debug future issues.
    const newNetworkFile = _path.default.join(this._state.tracesDir, this._state.traceName + `-pwnetcopy-${this._state.chunkOrdinal}.network`);
    const entries = [];
    entries.push({
      name: 'trace.trace',
      value: this._state.traceFile
    });
    entries.push({
      name: 'trace.network',
      value: newNetworkFile
    });
    for (const sha1 of new Set([...this._state.traceSha1s, ...this._state.networkSha1s])) entries.push({
      name: _path.default.join('resources', sha1),
      value: _path.default.join(this._state.resourcesDir, sha1)
    });

    // Only reset trace sha1s, network resources are preserved between chunks.
    this._state.traceSha1s = new Set();
    if (params.mode === 'discard') {
      this._isStopping = false;
      this._state.recording = false;
      return {};
    }
    this._fs.copyFile(this._state.networkFile, newNetworkFile);
    const zipFileName = this._state.traceFile + '.zip';
    if (params.mode === 'archive') this._fs.zip(entries, zipFileName);

    // Make sure all file operations complete.
    const error = await this._fs.syncAndGetError();
    this._isStopping = false;
    if (this._state) this._state.recording = false;

    // IMPORTANT: no awaits after this point, to make sure recording state is correct.

    if (error) {
      // This check is here because closing the browser removes the tracesDir and tracing
      // cannot access removed files. Clients are ready for the missing artifact.
      if (this._context instanceof _browserContext.BrowserContext && !this._context._browser.isConnected()) return {};
      throw error;
    }
    if (params.mode === 'entries') return {
      entries
    };
    const artifact = new _artifact.Artifact(this._context, zipFileName);
    artifact.reportFinished();
    return {
      artifact
    };
  }
  async _captureSnapshot(snapshotName, sdkObject, metadata, element) {
    if (!this._snapshotter) return;
    if (!sdkObject.attribution.page) return;
    if (!this._snapshotter.started()) return;
    if (!shouldCaptureSnapshot(metadata)) return;
    await this._snapshotter.captureSnapshot(sdkObject.attribution.page, metadata.id, snapshotName, element).catch(() => {});
  }
  onBeforeCall(sdkObject, metadata) {
    var _sdkObject$attributio, _this$_state;
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createBeforeActionTraceEvent(metadata);
    if (!event) return Promise.resolve();
    (_sdkObject$attributio = sdkObject.attribution.page) === null || _sdkObject$attributio === void 0 || _sdkObject$attributio.temporarilyDisableTracingScreencastThrottling();
    event.beforeSnapshot = `before@${metadata.id}`;
    (_this$_state = this._state) === null || _this$_state === void 0 || _this$_state.callIds.add(metadata.id);
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.beforeSnapshot, sdkObject, metadata);
  }
  onBeforeInputAction(sdkObject, metadata, element) {
    var _this$_state2, _sdkObject$attributio2;
    if (!((_this$_state2 = this._state) !== null && _this$_state2 !== void 0 && _this$_state2.callIds.has(metadata.id))) return Promise.resolve();
    // IMPORTANT: no awaits before this._appendTraceEvent in this method.
    const event = createInputActionTraceEvent(metadata);
    if (!event) return Promise.resolve();
    (_sdkObject$attributio2 = sdkObject.attribution.page) === null || _sdkObject$attributio2 === void 0 || _sdkObject$attributio2.temporarilyDisableTracingScreencastThrottling();
    event.inputSnapshot = `input@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.inputSnapshot, sdkObject, metadata, element);
  }
  onCallLog(sdkObject, metadata, logName, message) {
    if (metadata.isServerSide || metadata.internal) return;
    if (logName !== 'api') return;
    const event = createActionLogTraceEvent(metadata, message);
    if (event) this._appendTraceEvent(event);
  }
  async onAfterCall(sdkObject, metadata) {
    var _this$_state3, _this$_state4, _sdkObject$attributio3;
    if (!((_this$_state3 = this._state) !== null && _this$_state3 !== void 0 && _this$_state3.callIds.has(metadata.id))) return;
    (_this$_state4 = this._state) === null || _this$_state4 === void 0 || _this$_state4.callIds.delete(metadata.id);
    const event = createAfterActionTraceEvent(metadata);
    if (!event) return;
    (_sdkObject$attributio3 = sdkObject.attribution.page) === null || _sdkObject$attributio3 === void 0 || _sdkObject$attributio3.temporarilyDisableTracingScreencastThrottling();
    event.afterSnapshot = `after@${metadata.id}`;
    this._appendTraceEvent(event);
    return this._captureSnapshot(event.afterSnapshot, sdkObject, metadata);
  }
  onEntryStarted(entry) {
    this._pendingHarEntries.add(entry);
  }
  onEntryFinished(entry) {
    this._pendingHarEntries.delete(entry);
    const event = {
      type: 'resource-snapshot',
      snapshot: entry
    };
    const visited = visitTraceEvent(event, this._state.networkSha1s);
    this._fs.appendFile(this._state.networkFile, JSON.stringify(visited) + '\n', true /* flush */);
  }
  flushHarEntries() {
    const harLines = [];
    for (const entry of this._pendingHarEntries) {
      const event = {
        type: 'resource-snapshot',
        snapshot: entry
      };
      const visited = visitTraceEvent(event, this._state.networkSha1s);
      harLines.push(JSON.stringify(visited));
    }
    this._pendingHarEntries.clear();
    if (harLines.length) this._fs.appendFile(this._state.networkFile, harLines.join('\n') + '\n', true /* flush */);
  }
  onContentBlob(sha1, buffer) {
    this._appendResource(sha1, buffer);
  }
  onSnapshotterBlob(blob) {
    this._appendResource(blob.sha1, blob.buffer);
  }
  onFrameSnapshot(snapshot) {
    this._appendTraceEvent({
      type: 'frame-snapshot',
      snapshot
    });
  }
  _onConsoleMessage(message) {
    var _message$page;
    const event = {
      type: 'console',
      messageType: message.type(),
      text: message.text(),
      args: message.args().map(a => ({
        preview: a.toString(),
        value: a.rawValue()
      })),
      location: message.location(),
      time: (0, _utils.monotonicTime)(),
      pageId: (_message$page = message.page()) === null || _message$page === void 0 ? void 0 : _message$page.guid
    };
    this._appendTraceEvent(event);
  }
  _onPageError(error, page) {
    const event = {
      type: 'event',
      time: (0, _utils.monotonicTime)(),
      class: 'BrowserContext',
      method: 'pageError',
      params: {
        error: (0, _errors.serializeError)(error)
      },
      pageId: page.guid
    };
    this._appendTraceEvent(event);
  }
  _startScreencastInPage(page) {
    page.setScreencastOptions(kScreencastOptions);
    const prefix = page.guid;
    this._screencastListeners.push(_utils.eventsHelper.addEventListener(page, _page.Page.Events.ScreencastFrame, params => {
      const suffix = params.timestamp || Date.now();
      const sha1 = `${prefix}-${suffix}.jpeg`;
      const event = {
        type: 'screencast-frame',
        pageId: page.guid,
        sha1,
        width: params.width,
        height: params.height,
        timestamp: (0, _utils.monotonicTime)()
      };
      // Make sure to write the screencast frame before adding a reference to it.
      this._appendResource(sha1, params.buffer);
      this._appendTraceEvent(event);
    }));
  }
  _appendTraceEvent(event) {
    const visited = visitTraceEvent(event, this._state.traceSha1s);
    // Do not flush (console) events, they are too noisy, unless we are in ui mode (live).
    const flush = this._state.options.live || event.type !== 'event' && event.type !== 'console' && event.type !== 'log';
    this._fs.appendFile(this._state.traceFile, JSON.stringify(visited) + '\n', flush);
  }
  _appendResource(sha1, buffer) {
    if (this._allResources.has(sha1)) return;
    this._allResources.add(sha1);
    const resourcePath = _path.default.join(this._state.resourcesDir, sha1);
    this._fs.writeFile(resourcePath, buffer, true /* skipIfExists */);
  }
}
exports.Tracing = Tracing;
function visitTraceEvent(object, sha1s) {
  if (Array.isArray(object)) return object.map(o => visitTraceEvent(o, sha1s));
  if (object instanceof _dispatcher.Dispatcher) return `<${object._type}>`;
  if (object instanceof Buffer) return `<Buffer>`;
  if (object instanceof Date) return object;
  if (typeof object === 'object') {
    const result = {};
    for (const key in object) {
      if (key === 'sha1' || key === '_sha1' || key.endsWith('Sha1')) {
        const sha1 = object[key];
        if (sha1) sha1s.add(sha1);
      }
      result[key] = visitTraceEvent(object[key], sha1s);
    }
    return result;
  }
  return object;
}
function shouldCaptureSnapshot(metadata) {
  return _debug.commandsWithTracingSnapshots.has(metadata.type + '.' + metadata.method);
}
function createBeforeActionTraceEvent(metadata) {
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'before',
    callId: metadata.id,
    startTime: metadata.startTime,
    apiName: metadata.apiName || metadata.type + '.' + metadata.method,
    class: metadata.type,
    method: metadata.method,
    params: metadata.params,
    stepId: metadata.stepId,
    pageId: metadata.pageId
  };
}
function createInputActionTraceEvent(metadata) {
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'input',
    callId: metadata.id,
    point: metadata.point
  };
}
function createActionLogTraceEvent(metadata, message) {
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'log',
    callId: metadata.id,
    time: (0, _utils.monotonicTime)(),
    message
  };
}
function createAfterActionTraceEvent(metadata) {
  var _metadata$error;
  if (metadata.internal || metadata.method.startsWith('tracing')) return null;
  return {
    type: 'after',
    callId: metadata.id,
    endTime: metadata.endTime,
    error: (_metadata$error = metadata.error) === null || _metadata$error === void 0 ? void 0 : _metadata$error.error,
    result: metadata.result,
    point: metadata.point
  };
}
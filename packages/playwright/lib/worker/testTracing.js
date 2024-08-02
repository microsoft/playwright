"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.testTraceEntryName = exports.TestTracing = void 0;
var _fs = _interopRequireDefault(require("fs"));
var _path = _interopRequireDefault(require("path"));
var _utils = require("playwright-core/lib/utils");
var _zipBundle = require("playwright-core/lib/zipBundle");
var _util = require("../util");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
/**
 * Copyright Microsoft Corporation. All rights reserved.
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

const testTraceEntryName = exports.testTraceEntryName = 'test.trace';
const version = 7;
let traceOrdinal = 0;
class TestTracing {
  constructor(testInfo, artifactsDir) {
    this._testInfo = void 0;
    this._options = void 0;
    this._liveTraceFile = void 0;
    this._traceEvents = [];
    this._temporaryTraceFiles = [];
    this._artifactsDir = void 0;
    this._tracesDir = void 0;
    this._contextCreatedEvent = void 0;
    this._testInfo = testInfo;
    this._artifactsDir = artifactsDir;
    this._tracesDir = _path.default.join(this._artifactsDir, 'traces');
    this._contextCreatedEvent = {
      version,
      type: 'context-options',
      origin: 'testRunner',
      browserName: '',
      options: {},
      platform: process.platform,
      wallTime: Date.now(),
      monotonicTime: (0, _utils.monotonicTime)(),
      sdkLanguage: 'javascript'
    };
    this._appendTraceEvent(this._contextCreatedEvent);
  }
  _shouldCaptureTrace() {
    var _this$_options, _this$_options2, _this$_options3, _this$_options4, _this$_options5;
    if (process.env.PW_TEST_DISABLE_TRACING) return false;
    if (((_this$_options = this._options) === null || _this$_options === void 0 ? void 0 : _this$_options.mode) === 'on') return true;
    if (((_this$_options2 = this._options) === null || _this$_options2 === void 0 ? void 0 : _this$_options2.mode) === 'retain-on-failure') return true;
    if (((_this$_options3 = this._options) === null || _this$_options3 === void 0 ? void 0 : _this$_options3.mode) === 'on-first-retry' && this._testInfo.retry === 1) return true;
    if (((_this$_options4 = this._options) === null || _this$_options4 === void 0 ? void 0 : _this$_options4.mode) === 'on-all-retries' && this._testInfo.retry > 0) return true;
    if (((_this$_options5 = this._options) === null || _this$_options5 === void 0 ? void 0 : _this$_options5.mode) === 'retain-on-first-failure' && this._testInfo.retry === 0) return true;
    return false;
  }
  async startIfNeeded(value) {
    const defaultTraceOptions = {
      screenshots: true,
      snapshots: true,
      sources: true,
      attachments: true,
      _live: false,
      mode: 'off'
    };
    if (!value) {
      this._options = defaultTraceOptions;
    } else if (typeof value === 'string') {
      this._options = {
        ...defaultTraceOptions,
        mode: value === 'retry-with-trace' ? 'on-first-retry' : value
      };
    } else {
      const mode = value.mode || 'off';
      this._options = {
        ...defaultTraceOptions,
        ...value,
        mode: mode === 'retry-with-trace' ? 'on-first-retry' : mode
      };
    }
    if (!this._shouldCaptureTrace()) {
      this._options = undefined;
      return;
    }
    if (!this._liveTraceFile && this._options._live) {
      // Note that trace name must start with testId for live tracing to work.
      this._liveTraceFile = {
        file: _path.default.join(this._tracesDir, `${this._testInfo.testId}-test.trace`),
        fs: new _utils.SerializedFS()
      };
      this._liveTraceFile.fs.mkdir(_path.default.dirname(this._liveTraceFile.file));
      const data = this._traceEvents.map(e => JSON.stringify(e)).join('\n') + '\n';
      this._liveTraceFile.fs.writeFile(this._liveTraceFile.file, data);
    }
  }
  artifactsDir() {
    return this._artifactsDir;
  }
  tracesDir() {
    return this._tracesDir;
  }
  traceTitle() {
    return [_path.default.relative(this._testInfo.project.testDir, this._testInfo.file) + ':' + this._testInfo.line, ...this._testInfo.titlePath.slice(1)].join(' › ');
  }
  generateNextTraceRecordingName() {
    const ordinalSuffix = traceOrdinal ? `-recording${traceOrdinal}` : '';
    ++traceOrdinal;
    const retrySuffix = this._testInfo.retry ? `-retry${this._testInfo.retry}` : '';
    // Note that trace name must start with testId for live tracing to work.
    return `${this._testInfo.testId}${retrySuffix}${ordinalSuffix}`;
  }
  generateNextTraceRecordingPath() {
    const file = _path.default.join(this._artifactsDir, (0, _utils.createGuid)() + '.zip');
    this._temporaryTraceFiles.push(file);
    return file;
  }
  traceOptions() {
    return this._options;
  }
  async stopIfNeeded() {
    var _this$_liveTraceFile, _this$_options6, _this$_options7;
    if (!this._options) return;
    const error = await ((_this$_liveTraceFile = this._liveTraceFile) === null || _this$_liveTraceFile === void 0 ? void 0 : _this$_liveTraceFile.fs.syncAndGetError());
    if (error) throw error;
    const testFailed = this._testInfo.status !== this._testInfo.expectedStatus;
    const shouldAbandonTrace = !testFailed && (this._options.mode === 'retain-on-failure' || this._options.mode === 'retain-on-first-failure');
    if (shouldAbandonTrace) {
      for (const file of this._temporaryTraceFiles) await _fs.default.promises.unlink(file).catch(() => {});
      return;
    }
    const zipFile = new _zipBundle.yazl.ZipFile();
    if (!((_this$_options6 = this._options) !== null && _this$_options6 !== void 0 && _this$_options6.attachments)) {
      for (const event of this._traceEvents) {
        if (event.type === 'after') delete event.attachments;
      }
    }
    if ((_this$_options7 = this._options) !== null && _this$_options7 !== void 0 && _this$_options7.sources) {
      const sourceFiles = new Set();
      for (const event of this._traceEvents) {
        if (event.type === 'before') {
          for (const frame of event.stack || []) sourceFiles.add(frame.file);
        }
      }
      for (const sourceFile of sourceFiles) {
        await _fs.default.promises.readFile(sourceFile, 'utf8').then(source => {
          zipFile.addBuffer(Buffer.from(source), 'resources/src@' + (0, _utils.calculateSha1)(sourceFile) + '.txt');
        }).catch(() => {});
      }
    }
    const sha1s = new Set();
    for (const event of this._traceEvents.filter(e => e.type === 'after')) {
      for (const attachment of event.attachments || []) {
        let contentPromise;
        if (attachment.path) contentPromise = _fs.default.promises.readFile(attachment.path).catch(() => undefined);else if (attachment.base64) contentPromise = Promise.resolve(Buffer.from(attachment.base64, 'base64'));
        const content = await contentPromise;
        if (content === undefined) continue;
        const sha1 = (0, _utils.calculateSha1)(content);
        attachment.sha1 = sha1;
        delete attachment.path;
        delete attachment.base64;
        if (sha1s.has(sha1)) continue;
        sha1s.add(sha1);
        zipFile.addBuffer(content, 'resources/' + sha1);
      }
    }
    const traceContent = Buffer.from(this._traceEvents.map(e => JSON.stringify(e)).join('\n'));
    zipFile.addBuffer(traceContent, testTraceEntryName);
    await new Promise(f => {
      zipFile.end(undefined, () => {
        zipFile.outputStream.pipe(_fs.default.createWriteStream(this.generateNextTraceRecordingPath())).on('close', f);
      });
    });
    const tracePath = this._testInfo.outputPath('trace.zip');
    await mergeTraceFiles(tracePath, this._temporaryTraceFiles);
    this._testInfo.attachments.push({
      name: 'trace',
      path: tracePath,
      contentType: 'application/zip'
    });
  }
  appendForError(error) {
    var _error$stack;
    const rawStack = ((_error$stack = error.stack) === null || _error$stack === void 0 ? void 0 : _error$stack.split('\n')) || [];
    const stack = rawStack ? (0, _util.filteredStackTrace)(rawStack) : [];
    this._appendTraceEvent({
      type: 'error',
      message: error.message || String(error.value),
      stack
    });
  }
  appendStdioToTrace(type, chunk) {
    this._appendTraceEvent({
      type,
      timestamp: (0, _utils.monotonicTime)(),
      text: typeof chunk === 'string' ? chunk : undefined,
      base64: typeof chunk === 'string' ? undefined : chunk.toString('base64')
    });
  }
  appendBeforeActionForStep(callId, parentId, apiName, params, stack) {
    this._appendTraceEvent({
      type: 'before',
      callId,
      parentId,
      startTime: (0, _utils.monotonicTime)(),
      class: 'Test',
      method: 'step',
      apiName,
      params: Object.fromEntries(Object.entries(params || {}).map(([name, value]) => [name, generatePreview(value)])),
      stack
    });
  }
  appendAfterActionForStep(callId, error, attachments = []) {
    this._appendTraceEvent({
      type: 'after',
      callId,
      endTime: (0, _utils.monotonicTime)(),
      attachments: serializeAttachments(attachments),
      error
    });
  }
  _appendTraceEvent(event) {
    this._traceEvents.push(event);
    if (this._liveTraceFile) this._liveTraceFile.fs.appendFile(this._liveTraceFile.file, JSON.stringify(event) + '\n', true);
  }
}
exports.TestTracing = TestTracing;
function serializeAttachments(attachments) {
  return attachments.filter(a => a.name !== 'trace').map(a => {
    var _a$body;
    return {
      name: a.name,
      contentType: a.contentType,
      path: a.path,
      base64: (_a$body = a.body) === null || _a$body === void 0 ? void 0 : _a$body.toString('base64')
    };
  });
}
function generatePreview(value, visited = new Set()) {
  if (visited.has(value)) return '';
  visited.add(value);
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return '[' + value.map(v => generatePreview(v, visited)).join(', ') + ']';
  if (typeof value === 'object') return 'Object';
  return String(value);
}
async function mergeTraceFiles(fileName, temporaryTraceFiles) {
  if (temporaryTraceFiles.length === 1) {
    await _fs.default.promises.rename(temporaryTraceFiles[0], fileName);
    return;
  }
  const mergePromise = new _utils.ManualPromise();
  const zipFile = new _zipBundle.yazl.ZipFile();
  const entryNames = new Set();
  zipFile.on('error', error => mergePromise.reject(error));
  for (let i = temporaryTraceFiles.length - 1; i >= 0; --i) {
    const tempFile = temporaryTraceFiles[i];
    const promise = new _utils.ManualPromise();
    _zipBundle.yauzl.open(tempFile, (err, inZipFile) => {
      if (err) {
        promise.reject(err);
        return;
      }
      let pendingEntries = inZipFile.entryCount;
      inZipFile.on('entry', entry => {
        let entryName = entry.fileName;
        if (entry.fileName === testTraceEntryName) {
          // Keep the name for test traces so that the last test trace
          // that contains most of the information is kept in the trace.
          // Note the reverse order of the iteration (from new traces to old).
        } else if (entry.fileName.match(/[\d-]*trace\./)) {
          entryName = i + '-' + entry.fileName;
        }
        if (entryNames.has(entryName)) {
          if (--pendingEntries === 0) promise.resolve();
          return;
        }
        entryNames.add(entryName);
        inZipFile.openReadStream(entry, (err, readStream) => {
          if (err) {
            promise.reject(err);
            return;
          }
          zipFile.addReadStream(readStream, entryName);
          if (--pendingEntries === 0) promise.resolve();
        });
      });
    });
    await promise;
  }
  zipFile.end(undefined, () => {
    zipFile.outputStream.pipe(_fs.default.createWriteStream(fileName)).on('close', () => {
      void Promise.all(temporaryTraceFiles.map(tempFile => _fs.default.promises.unlink(tempFile))).then(() => {
        mergePromise.resolve();
      }).catch(error => mergePromise.reject(error));
    }).on('error', error => mergePromise.reject(error));
  });
  await mergePromise;
}
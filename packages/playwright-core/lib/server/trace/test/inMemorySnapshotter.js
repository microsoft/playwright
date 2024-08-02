"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InMemorySnapshotter = void 0;
var _snapshotStorage = require("../../../../../trace-viewer/src/snapshotStorage");
var _snapshotter = require("../recorder/snapshotter");
var _harTracer = require("../../har/harTracer");
var _utils = require("../../../utils");
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

class InMemorySnapshotter {
  constructor(context) {
    this._blobs = new Map();
    this._snapshotter = void 0;
    this._harTracer = void 0;
    this._snapshotReadyPromises = new Map();
    this._storage = void 0;
    this._snapshotCount = 0;
    this._snapshotter = new _snapshotter.Snapshotter(context, this);
    this._harTracer = new _harTracer.HarTracer(context, null, this, {
      content: 'attach',
      includeTraceInfo: true,
      recordRequestOverrides: false,
      waitForContentOnStop: false
    });
    this._storage = new _snapshotStorage.SnapshotStorage();
  }
  async initialize() {
    await this._snapshotter.start();
    this._harTracer.start({
      omitScripts: true
    });
  }
  async reset() {
    await this._snapshotter.reset();
    await this._harTracer.flush();
    this._harTracer.stop();
    this._harTracer.start({
      omitScripts: true
    });
  }
  async dispose() {
    this._snapshotter.dispose();
    await this._harTracer.flush();
    this._harTracer.stop();
  }
  async captureSnapshot(page, callId, snapshotName, element) {
    if (this._snapshotReadyPromises.has(snapshotName)) throw new Error('Duplicate snapshot name: ' + snapshotName);
    this._snapshotter.captureSnapshot(page, callId, snapshotName, element).catch(() => {});
    const promise = new _utils.ManualPromise();
    this._snapshotReadyPromises.set(snapshotName, promise);
    return promise;
  }
  onEntryStarted(entry) {}
  onEntryFinished(entry) {
    this._storage.addResource(entry);
  }
  onContentBlob(sha1, buffer) {
    this._blobs.set(sha1, buffer);
  }
  onSnapshotterBlob(blob) {
    this._blobs.set(blob.sha1, blob.buffer);
  }
  onFrameSnapshot(snapshot) {
    var _this$_snapshotReadyP;
    ++this._snapshotCount;
    const renderer = this._storage.addFrameSnapshot(snapshot);
    (_this$_snapshotReadyP = this._snapshotReadyPromises.get(snapshot.snapshotName || '')) === null || _this$_snapshotReadyP === void 0 || _this$_snapshotReadyP.resolve(renderer);
  }
  async resourceContentForTest(sha1) {
    return this._blobs.get(sha1);
  }
  snapshotCount() {
    return this._snapshotCount;
  }
}
exports.InMemorySnapshotter = InMemorySnapshotter;
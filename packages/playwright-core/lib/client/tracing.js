"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Tracing = void 0;
var _artifact = require("./artifact");
var _channelOwner = require("./channelOwner");
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

class Tracing extends _channelOwner.ChannelOwner {
  static from(channel) {
    return channel._object;
  }
  constructor(parent, type, guid, initializer) {
    super(parent, type, guid, initializer);
    this._includeSources = false;
    this._tracesDir = void 0;
    this._stacksId = void 0;
    this._isTracing = false;
  }
  async start(options = {}) {
    await this._wrapApiCall(async () => {
      this._includeSources = !!options.sources;
      await this._channel.tracingStart({
        name: options.name,
        snapshots: options.snapshots,
        screenshots: options.screenshots,
        live: options._live
      });
      const response = await this._channel.tracingStartChunk({
        name: options.name,
        title: options.title
      });
      await this._startCollectingStacks(response.traceName);
    }, true);
  }
  async startChunk(options = {}) {
    await this._wrapApiCall(async () => {
      const {
        traceName
      } = await this._channel.tracingStartChunk(options);
      await this._startCollectingStacks(traceName);
    }, true);
  }
  async _startCollectingStacks(traceName) {
    if (!this._isTracing) {
      this._isTracing = true;
      this._connection.setIsTracing(true);
    }
    const result = await this._connection.localUtils()._channel.tracingStarted({
      tracesDir: this._tracesDir,
      traceName
    });
    this._stacksId = result.stacksId;
  }
  async stopChunk(options = {}) {
    await this._wrapApiCall(async () => {
      await this._doStopChunk(options.path);
    }, true);
  }
  async stop(options = {}) {
    await this._wrapApiCall(async () => {
      await this._doStopChunk(options.path);
      await this._channel.tracingStop();
    }, true);
  }
  async _doStopChunk(filePath) {
    this._resetStackCounter();
    if (!filePath) {
      // Not interested in artifacts.
      await this._channel.tracingStopChunk({
        mode: 'discard'
      });
      if (this._stacksId) await this._connection.localUtils()._channel.traceDiscarded({
        stacksId: this._stacksId
      });
      return;
    }
    const isLocal = !this._connection.isRemote();
    if (isLocal) {
      const result = await this._channel.tracingStopChunk({
        mode: 'entries'
      });
      await this._connection.localUtils()._channel.zip({
        zipFile: filePath,
        entries: result.entries,
        mode: 'write',
        stacksId: this._stacksId,
        includeSources: this._includeSources
      });
      return;
    }
    const result = await this._channel.tracingStopChunk({
      mode: 'archive'
    });

    // The artifact may be missing if the browser closed while stopping tracing.
    if (!result.artifact) {
      if (this._stacksId) await this._connection.localUtils()._channel.traceDiscarded({
        stacksId: this._stacksId
      });
      return;
    }

    // Save trace to the final local file.
    const artifact = _artifact.Artifact.from(result.artifact);
    await artifact.saveAs(filePath);
    await artifact.delete();
    await this._connection.localUtils()._channel.zip({
      zipFile: filePath,
      entries: [],
      mode: 'append',
      stacksId: this._stacksId,
      includeSources: this._includeSources
    });
  }
  _resetStackCounter() {
    if (this._isTracing) {
      this._isTracing = false;
      this._connection.setIsTracing(false);
    }
  }
}
exports.Tracing = Tracing;
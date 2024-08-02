"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TracingDispatcher = void 0;
var _artifactDispatcher = require("./artifactDispatcher");
var _dispatcher = require("./dispatcher");
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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

class TracingDispatcher extends _dispatcher.Dispatcher {
  static from(scope, tracing) {
    const result = (0, _dispatcher.existingDispatcher)(tracing);
    return result || new TracingDispatcher(scope, tracing);
  }
  constructor(scope, tracing) {
    super(scope, tracing, 'Tracing', {});
    this._type_Tracing = true;
  }
  async tracingStart(params) {
    await this._object.start(params);
  }
  async tracingStartChunk(params) {
    return await this._object.startChunk(params);
  }
  async tracingStopChunk(params) {
    const {
      artifact,
      entries
    } = await this._object.stopChunk(params);
    return {
      artifact: artifact ? _artifactDispatcher.ArtifactDispatcher.from(this, artifact) : undefined,
      entries
    };
  }
  async tracingStop(params) {
    await this._object.stop();
  }
}
exports.TracingDispatcher = TracingDispatcher;
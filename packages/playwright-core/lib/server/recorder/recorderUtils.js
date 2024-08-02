"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.metadataToCallLog = metadataToCallLog;
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

function metadataToCallLog(metadata, status) {
  var _metadata$params, _metadata$params2, _metadata$error;
  let title = metadata.apiName || metadata.method;
  if (metadata.method === 'waitForEventInfo') title += `(${metadata.params.info.event})`;
  title = title.replace('object.expect', 'expect');
  if (metadata.error) status = 'error';
  const params = {
    url: (_metadata$params = metadata.params) === null || _metadata$params === void 0 ? void 0 : _metadata$params.url,
    selector: (_metadata$params2 = metadata.params) === null || _metadata$params2 === void 0 ? void 0 : _metadata$params2.selector
  };
  let duration = metadata.endTime ? metadata.endTime - metadata.startTime : undefined;
  if (typeof duration === 'number' && metadata.pauseStartTime && metadata.pauseEndTime) {
    duration -= metadata.pauseEndTime - metadata.pauseStartTime;
    duration = Math.max(duration, 0);
  }
  const callLog = {
    id: metadata.id,
    messages: metadata.log,
    title,
    status,
    error: (_metadata$error = metadata.error) === null || _metadata$error === void 0 || (_metadata$error = _metadata$error.error) === null || _metadata$error === void 0 ? void 0 : _metadata$error.message,
    params,
    duration
  };
  return callLog;
}
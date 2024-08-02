"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SdkObject = void 0;
exports.createInstrumentation = createInstrumentation;
exports.kTestSdkObjects = void 0;
exports.serverSideCallMetadata = serverSideCallMetadata;
var _events = require("events");
var _utils = require("../utils");
/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

const kTestSdkObjects = exports.kTestSdkObjects = new WeakSet();
class SdkObject extends _events.EventEmitter {
  constructor(parent, guidPrefix, guid) {
    super();
    this.guid = void 0;
    this.attribution = void 0;
    this.instrumentation = void 0;
    this.guid = guid || `${guidPrefix || ''}@${(0, _utils.createGuid)()}`;
    this.setMaxListeners(0);
    this.attribution = {
      ...parent.attribution
    };
    this.instrumentation = parent.instrumentation;
    if (process.env._PW_INTERNAL_COUNT_SDK_OBJECTS) kTestSdkObjects.add(this);
  }
}
exports.SdkObject = SdkObject;
function createInstrumentation() {
  const listeners = new Map();
  return new Proxy({}, {
    get: (obj, prop) => {
      if (typeof prop !== 'string') return obj[prop];
      if (prop === 'addListener') return (listener, context) => listeners.set(listener, context);
      if (prop === 'removeListener') return listener => listeners.delete(listener);
      if (!prop.startsWith('on')) return obj[prop];
      return async (sdkObject, ...params) => {
        for (const [listener, context] of listeners) {
          var _prop, _ref;
          if (!context || sdkObject.attribution.context === context) await ((_prop = (_ref = listener)[prop]) === null || _prop === void 0 ? void 0 : _prop.call(_ref, sdkObject, ...params));
        }
      };
    }
  });
}
function serverSideCallMetadata() {
  return {
    id: '',
    startTime: 0,
    endTime: 0,
    type: 'Internal',
    method: '',
    params: {},
    log: [],
    isServerSide: true
  };
}
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createInstrumentation = createInstrumentation;
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

function createInstrumentation() {
  const listeners = [];
  return new Proxy({}, {
    get: (obj, prop) => {
      if (typeof prop !== 'string') return obj[prop];
      if (prop === 'addListener') return listener => listeners.push(listener);
      if (prop === 'removeListener') return listener => listeners.splice(listeners.indexOf(listener), 1);
      if (prop === 'removeAllListeners') return () => listeners.splice(0, listeners.length);
      if (prop.startsWith('run')) {
        return async (...params) => {
          for (const listener of listeners) {
            var _prop, _ref;
            await ((_prop = (_ref = listener)[prop]) === null || _prop === void 0 ? void 0 : _prop.call(_ref, ...params));
          }
        };
      }
      if (prop.startsWith('on')) {
        return (...params) => {
          for (const listener of listeners) {
            var _prop2, _ref2;
            (_prop2 = (_ref2 = listener)[prop]) === null || _prop2 === void 0 || _prop2.call(_ref2, ...params);
          }
        };
      }
      return obj[prop];
    }
  });
}
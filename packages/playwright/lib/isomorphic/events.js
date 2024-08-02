"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EventEmitter = exports.Disposable = void 0;
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
let Disposable = exports.Disposable = void 0;
(function (_Disposable) {
  function disposeAll(disposables) {
    for (const disposable of disposables.splice(0)) disposable.dispose();
  }
  _Disposable.disposeAll = disposeAll;
})(Disposable || (exports.Disposable = Disposable = {}));
class EventEmitter {
  constructor() {
    this.event = void 0;
    this._deliveryQueue = void 0;
    this._listeners = new Set();
    this.event = (listener, disposables) => {
      this._listeners.add(listener);
      let disposed = false;
      const self = this;
      const result = {
        dispose() {
          if (!disposed) {
            disposed = true;
            self._listeners.delete(listener);
          }
        }
      };
      if (disposables) disposables.push(result);
      return result;
    };
  }
  fire(event) {
    const dispatch = !this._deliveryQueue;
    if (!this._deliveryQueue) this._deliveryQueue = [];
    for (const listener of this._listeners) this._deliveryQueue.push({
      listener,
      event
    });
    if (!dispatch) return;
    for (let index = 0; index < this._deliveryQueue.length; index++) {
      const {
        listener,
        event
      } = this._deliveryQueue[index];
      listener.call(null, event);
    }
    this._deliveryQueue = undefined;
  }
  dispose() {
    this._listeners.clear();
    if (this._deliveryQueue) this._deliveryQueue = [];
  }
}
exports.EventEmitter = EventEmitter;
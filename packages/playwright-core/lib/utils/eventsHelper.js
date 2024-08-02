"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.eventsHelper = void 0;
/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

class EventsHelper {
  static addEventListener(emitter, eventName, handler) {
    emitter.on(eventName, handler);
    return {
      emitter,
      eventName,
      handler
    };
  }
  static removeEventListeners(listeners) {
    for (const listener of listeners) listener.emitter.removeListener(listener.eventName, listener.handler);
    listeners.splice(0, listeners.length);
  }
}
const eventsHelper = exports.eventsHelper = EventsHelper;
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

import { EventEmitter } from 'events';

export type RegisteredListener = {
  emitter: EventEmitter;
  eventName: (string | symbol);
  handler: (...args: any[]) => void;
};

class EventsHelper {
  // Used for normal EventEmitter instances, in order to benefit from
  // auto-completion, use ManagedEventEmitter.addManagedListener instead
  static addEventListener(
    emitter: EventEmitter,
    eventName: (string | symbol),
    handler: (...args: any[]) => void): RegisteredListener {
    emitter.on(eventName, handler);
    return { emitter, eventName, handler };
  }

  static removeEventListeners(listeners: Array<{
      emitter: EventEmitter;
      eventName: (string | symbol);
      handler: (...args: any[]) => void;
    }>) {
    for (const listener of listeners)
      listener.emitter.removeListener(listener.eventName, listener.handler);
    listeners.splice(0, listeners.length);
  }
}

// From node_modules/@types/node/events.d.ts
type DefaultEventMap = [never];
type Listener<K, T, F> = T extends DefaultEventMap ? F : (
  K extends keyof T ? (
          T[K] extends unknown[] ? (...args: T[K]) => void : never
      )
      : never
);
type Listener1<K, T> = Listener<K, T, (...args: any[]) => void>;
type Key<K, T> = T extends DefaultEventMap ? string | symbol : K | keyof T;

export class ManagedEventEmitter<T extends Record<keyof T, any[]>> extends EventEmitter<T> {
  public _events!: T;

  addManagedListener<K>(eventName: Key<K, T>, listener: Listener1<K, T>): RegisteredListener {
    this.on(eventName, listener);
    return {
      emitter: this as EventEmitter, 
      eventName: eventName as string,
      handler: listener
    };
  }
}

export const eventsHelper = EventsHelper;

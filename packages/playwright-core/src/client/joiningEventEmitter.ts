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

import { EventEmitter } from 'events';
import { MultiMap } from '../utils/multimap';

const originalListener = Symbol('originalListener');
const wrapperListener = Symbol('wrapperListener');

export class JoiningEventEmitter implements EventEmitter {
  private _emitterDelegate = new EventEmitter();
  private _pendingPromises = new MultiMap<string | symbol, Promise<void>>();

  addListener(event: string | symbol, listener: (...args: any[]) => void): this {
    this._emitterDelegate.addListener(event, this._wrap(event, listener));
    return this;
  }

  on(event: string | symbol, listener: (...args: any[]) => void): this {
    this._emitterDelegate.on(event, this._wrap(event, listener));
    return this;
  }

  once(event: string | symbol, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
    return this;
  }

  removeListener(event: string | symbol, listener: (...args: any[]) => void): this {
    this._emitterDelegate.removeListener(event, this._wrapper(listener));
    return this;
  }

  off(event: string | symbol, listener: (...args: any[]) => void): this {
    this._emitterDelegate.off(event, this._wrapper(listener));
    return this;
  }

  removeAllListeners(event?: string | symbol | undefined): this {
    this._emitterDelegate.removeAllListeners(event);
    return this;
  }

  setMaxListeners(n: number): this {
    this._emitterDelegate.setMaxListeners(n);
    return this;
  }

  getMaxListeners(): number {
    return this._emitterDelegate.getMaxListeners();
  }

  listeners(event: string | symbol): Function[] {
    return this._emitterDelegate.listeners(event).map(f => this._original(f));
  }

  rawListeners(event: string | symbol): Function[] {
    return this._emitterDelegate.rawListeners(event).map(f => this._original(f));
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    return this._emitterDelegate.emit(event, ...args);
  }

  listenerCount(event: string | symbol): number {
    return this._emitterDelegate.listenerCount(event);
  }

  prependListener(event: string | symbol, listener: (...args: any[]) => void): this {
    this._emitterDelegate.prependListener(event, this._wrap(event, listener));
    return this;
  }

  prependOnceListener(event: string | symbol, listener: (...args: any[]) => void): this {
    const onceWrapper = (...args: any) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    this.prependListener(event, onceWrapper);
    return this;
  }

  eventNames(): (string | symbol)[] {
    return this._emitterDelegate.eventNames();
  }

  async _joinPendingEventHandlers() {
    await Promise.all([...this._pendingPromises.values()]);
  }

  private _wrap(event: string | symbol, listener: (...args: any[]) => void) {
    const wrapper = (...args: any) => {
      const result = listener(...args) as any;
      if (result instanceof Promise) {
        this._pendingPromises.set(event, result);
        result.finally(() => this._pendingPromises.delete(event, result));
      }
    };
    (wrapper as any)[originalListener] = listener;
    (listener as any)[wrapperListener] = wrapper;
    return wrapper;
  }

  private _wrapper(listener: (...args: any[]) => void) {
    // Fallback to original listener if not wrapped to ensure backwards compatibility Node.js's event emitter
    return (listener as any)[wrapperListener] ?? listener;
  }

  private _original(wrapper: Function): Function {
    return (wrapper as any)[originalListener];
  }
}

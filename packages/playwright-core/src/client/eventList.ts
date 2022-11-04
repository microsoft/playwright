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
import type * as api from '../../types/types';
import { captureStackTrace } from '../utils/stackTrace';
import { Waiter } from './waiter';
import type { WaitForEventOptions } from './types';
import type { Page } from './page';
import type { BrowserContext } from './browserContext';
import { EventEmitter } from 'events';

type WrappedEvent<T> = { event: T };

export class EventList<T> implements api.EventList<T> {
  private _list: WrappedEvent<T>[] = [];
  private _pageOrContext: Page | BrowserContext;
  private _eventName: string;
  private _apiNameBase: string;
  private _eventListener: (event: T) => void;
  private _emitter: EventEmitter;

  constructor(pageOrContext: Page | BrowserContext, eventName: string, apiNameBase: string) {
    this._pageOrContext = pageOrContext;
    this._eventName = eventName;
    this._emitter = new EventEmitter();
    this._emitter.on(this._eventName, (obj: WrappedEvent<T>) => this._list.push(obj));
    this._eventListener = (event: T) => this._emitter.emit(this._eventName, { event });
    this._apiNameBase = apiNameBase;
  }

  track() {
    this._pageOrContext.on(this._eventName, this._eventListener);
  }

  untrack() {
    this._pageOrContext.removeListener(this._eventName, this._eventListener);
  }

  clear() {
    this._list = [];
  }

  async take(optionsOrPredicate: WaitForEventOptions = {}): Promise<T> {
    const apiName = this._apiNameBase + '.take';
    return await this._pageOrContext._wrapApiCall(async () => {
      const predicate = typeof optionsOrPredicate === 'function' ? optionsOrPredicate : optionsOrPredicate.predicate;
      const timeout = this._pageOrContext._timeoutSettings.timeout(typeof optionsOrPredicate === 'function' ? {} : optionsOrPredicate);
      const waiter = new Waiter(this._pageOrContext, this._eventName, apiName);
      this._pageOrContext._setupWaiter(waiter, this._eventName, timeout, `waiting for ${apiName}`);

      const wrappedPredicate = predicate ? (arg: WrappedEvent<T>) => predicate(arg.event) : undefined;

      while (true) {
        // The `waiter.waitForEvent` will throw after timeout or certain page events.
        const uniqueObj = await waiter.waitForEvent(this._emitter, this._eventName, wrappedPredicate, this._list);
        const index = this._list.indexOf(uniqueObj);
        if (index !== -1) {
          waiter.dispose();
          return this._list.splice(index, 1)[0].event;
        }
      }
    }, false /* isInternal */, {
      ...captureStackTrace(),
      apiName,
    });
  }

  all(): T[] {
    return this._list.map(({ event }) => event);
  }
}


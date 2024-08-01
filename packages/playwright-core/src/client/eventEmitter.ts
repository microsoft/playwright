/**
 * Copyright Joyent, Inc. and other Node contributors.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to permit
 * persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

type EventType = string | symbol;
type Listener = (...args: any[]) => any;
type EventMap = Record<EventType, Listener | Listener[]>;
import { EventEmitter as OriginalEventEmitter } from 'events';
import type { EventEmitter as EventEmitterType } from 'events';
import { isUnderTest } from '../utils';

export class EventEmitter implements EventEmitterType {

  private _events: EventMap | undefined = undefined;
  private _eventsCount = 0;
  private _maxListeners: number | undefined = undefined;
  readonly _pendingHandlers = new Map<EventType, Set<Promise<void>>>();
  private _rejectionHandler: ((error: Error) => void) | undefined;

  constructor() {
    if (this._events === undefined || this._events === Object.getPrototypeOf(this)._events) {
      this._events = Object.create(null);
      this._eventsCount = 0;
    }
    this._maxListeners = this._maxListeners || undefined;
    this.on = this.addListener;
    this.off = this.removeListener;
  }

  setMaxListeners(n: number): this {
    if (typeof n !== 'number' || n < 0 || Number.isNaN(n))
      throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
    this._maxListeners = n;
    return this;
  }

  getMaxListeners(): number {
    return this._maxListeners === undefined ? OriginalEventEmitter.defaultMaxListeners : this._maxListeners;
  }

  emit(type: EventType, ...args: any[]): boolean {
    const events = this._events;
    if (events === undefined)
      return false;

    const handler = events?.[type];
    if (handler === undefined)
      return false;

    if (typeof handler === 'function') {
      this._callHandler(type, handler, args);
    } else {
      const len = handler.length;
      const listeners = handler.slice();
      for (let i = 0; i < len; ++i)
        this._callHandler(type, listeners[i], args);
    }
    return true;
  }

  private _callHandler(type: EventType, handler: Listener, args: any[]): void {
    const promise = Reflect.apply(handler, this, args);
    if (!(promise instanceof Promise))
      return;
    let set = this._pendingHandlers.get(type);
    if (!set) {
      set = new Set();
      this._pendingHandlers.set(type, set);
    }
    set.add(promise);
    promise.catch(e => {
      if (this._rejectionHandler)
        this._rejectionHandler(e);
      else
        throw e;
    }).finally(() => set.delete(promise));
  }

  addListener(type: EventType, listener: Listener): this {
    return this._addListener(type, listener, false);
  }

  on(type: EventType, listener: Listener): this {
    return this._addListener(type, listener, false);
  }

  private _addListener(type: EventType, listener: Listener, prepend: boolean): this {
    checkListener(listener);
    let events = this._events;
    let existing;
    if (events === undefined) {
      events = this._events = Object.create(null);
      this._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener !== undefined) {
        this.emit('newListener', type, unwrapListener(listener));

        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = this._events!;
      }
      existing = events[type];
    }

    if (existing === undefined) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events![type] = listener;
      ++this._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events![type] =
          prepend ? [listener, existing] : [existing, listener];
        // If we've already got an array, just append.
      } else if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }

      // Check for listener leak
      const m = this.getMaxListeners();
      if (m > 0 && existing.length > m && !(existing as any).warned) {
        (existing as any).warned = true;
        // No error code for this since it is a Warning
        const w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + String(type) + ' listeners ' +
                            'added. Use emitter.setMaxListeners() to ' +
                            'increase limit') as any;
        w.name = 'MaxListenersExceededWarning';
        w.emitter = this;
        w.type = type;
        w.count = existing.length;
        if (!isUnderTest()) {
          // eslint-disable-next-line no-console
          console.warn(w);
        }
      }
    }

    return this;
  }

  prependListener(type: EventType, listener: Listener): this {
    return this._addListener(type, listener, true);
  }

  once(type: EventType, listener: Listener): this {
    checkListener(listener);
    this.on(type, new OnceWrapper(this, type, listener).wrapperFunction);
    return this;
  }

  prependOnceListener(type: EventType, listener: Listener): this {
    checkListener(listener);
    this.prependListener(type, new OnceWrapper(this, type, listener).wrapperFunction);
    return this;
  }

  removeListener(type: EventType, listener: Listener): this {
    checkListener(listener);

    const events = this._events;
    if (events === undefined)
      return this;

    const list = events[type];
    if (list === undefined)
      return this;

    if (list === listener || (list as any).listener === listener) {
      if (--this._eventsCount === 0) {
        this._events = Object.create(null);
      } else {
        delete events[type];
        if (events.removeListener)
          this.emit('removeListener', type, (list as any).listener ?? listener);
      }
    } else if (typeof list !== 'function') {
      let position = -1;
      let originalListener;

      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i] === listener || wrappedListener(list[i]) === listener) {
          originalListener = wrappedListener(list[i]);
          position = i;
          break;
        }
      }

      if (position < 0)
        return this;

      if (position === 0)
        list.shift();
      else
        list.splice(position, 1);

      if (list.length === 1)
        events[type] = list[0];

      if (events.removeListener !== undefined)
        this.emit('removeListener', type, originalListener || listener);
    }

    return this;

  }

  off(type: EventType, listener: Listener): this {
    return this.removeListener(type, listener);
  }

  removeAllListeners(type?: EventType): this;
  removeAllListeners(type: EventType | undefined, options: { behavior?: 'wait'|'ignoreErrors'|'default' }): Promise<void>;
  removeAllListeners(type?: string, options?: { behavior?: 'wait'|'ignoreErrors'|'default' }): this | Promise<void> {
    this._removeAllListeners(type);
    if (!options)
      return this;

    if (options.behavior === 'wait') {
      const errors: Error[] = [];
      this._rejectionHandler = error => errors.push(error);
      // eslint-disable-next-line internal-playwright/await-promise-in-class-returns
      return this._waitFor(type).then(() => {
        if (errors.length)
          throw errors[0];
      });
    }

    if (options.behavior === 'ignoreErrors')
      this._rejectionHandler = () => {};

    // eslint-disable-next-line internal-playwright/await-promise-in-class-returns
    return Promise.resolve();
  }

  private _removeAllListeners(type?: string) {
    const events = this._events;
    if (!events)
      return;

    // not listening for removeListener, no need to emit
    if (!events.removeListener) {
      if (type === undefined) {
        this._events = Object.create(null);
        this._eventsCount = 0;
      } else if (events[type] !== undefined) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else
          delete events[type];
      }
      return;
    }

    // emit removeListener for all listeners on all events
    if (type === undefined) {
      const keys = Object.keys(events);
      let key;
      for (let i = 0; i < keys.length; ++i) {
        key = keys[i];
        if (key === 'removeListener')
          continue;
        this._removeAllListeners(key);
      }
      this._removeAllListeners('removeListener');
      this._events = Object.create(null);
      this._eventsCount = 0;
      return;
    }

    const listeners = events[type];

    if (typeof listeners === 'function') {
      this.removeListener(type, listeners);
    } else if (listeners !== undefined) {
      // LIFO order
      for (let i = listeners.length - 1; i >= 0; i--)
        this.removeListener(type, listeners[i]);
    }
  }

  listeners(type: EventType): Listener[] {
    return this._listeners(this, type, true);
  }

  rawListeners(type: EventType): Listener[] {
    return this._listeners(this, type, false);
  }

  listenerCount(type: EventType): number {
    const events = this._events;
    if (events !== undefined) {
      const listener = events[type];
      if (typeof listener === 'function')
        return 1;
      if (listener !== undefined)
        return listener.length;
    }
    return 0;
  }

  eventNames(): Array<string | symbol> {
    return this._eventsCount > 0 && this._events ? Reflect.ownKeys(this._events) : [];
  }

  private async _waitFor(type?: EventType) {
    let promises: Promise<void>[] = [];
    if (type) {
      promises = [...(this._pendingHandlers.get(type) || [])];
    } else {
      promises = [];
      for (const [, pending] of this._pendingHandlers)
        promises.push(...pending);
    }
    await Promise.all(promises);
  }

  private _listeners(target: EventEmitter, type: EventType, unwrap: boolean): Listener[] {
    const events = target._events;

    if (events === undefined)
      return [];

    const listener = events[type];
    if (listener === undefined)
      return [];

    if (typeof listener === 'function')
      return unwrap ? [unwrapListener(listener)] : [listener];

    return unwrap ? unwrapListeners(listener) : listener.slice();
  }
}

function checkListener(listener: any) {
  if (typeof listener !== 'function')
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
}

class OnceWrapper {
  private _fired = false;
  readonly wrapperFunction: (...args: any[]) => Promise<void> | void;
  readonly _listener: Listener;
  private _eventEmitter: EventEmitter;
  private _eventType: EventType;

  constructor(eventEmitter: EventEmitter, eventType: EventType, listener: Listener) {
    this._eventEmitter = eventEmitter;
    this._eventType = eventType;
    this._listener = listener;
    this.wrapperFunction = this._handle.bind(this);
    (this.wrapperFunction as any).listener = listener;
  }

  private _handle(...args: any[]) {
    if (this._fired)
      return;
    this._fired = true;
    this._eventEmitter.removeListener(this._eventType, this.wrapperFunction);
    return this._listener.apply(this._eventEmitter, args);
  }
}

function unwrapListener(l: Listener): Listener {
  return wrappedListener(l) ?? l;
}

function unwrapListeners(arr: Listener[]): Listener[] {
  return arr.map(l => wrappedListener(l) ?? l);
}

function wrappedListener(l: Listener): Listener {
  return (l as any).listener;
}

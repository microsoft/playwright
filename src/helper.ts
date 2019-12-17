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

import * as debug from 'debug';
import * as types from './types';
import { TimeoutError } from './errors';

export const debugError = debug(`playwright:error`);

export type RegisteredListener = {
  emitter: NodeJS.EventEmitter;
  eventName: (string | symbol);
  handler: (...args: any[]) => void;
};

class Helper {
  static evaluationString(fun: Function | string, ...args: any[]): string {
    if (Helper.isString(fun)) {
      assert(args.length === 0, 'Cannot evaluate a string with arguments');
      return fun as string;
    }
    return `(${fun})(${args.map(serializeArgument).join(',')})`;

    function serializeArgument(arg: any): string {
      if (Object.is(arg, undefined))
        return 'undefined';
      return JSON.stringify(arg);
    }
  }

  static installAsyncStackHooks(classType: any) {
    for (const methodName of Reflect.ownKeys(classType.prototype)) {
      const method = Reflect.get(classType.prototype, methodName);
      if (methodName === 'constructor' || typeof methodName !== 'string' || methodName.startsWith('_') || typeof method !== 'function' || method.constructor.name !== 'AsyncFunction')
        continue;
      Reflect.set(classType.prototype, methodName, function(...args: any[]) {
        const syncStack: any = {};
        Error.captureStackTrace(syncStack);
        return method.call(this, ...args).catch(e => {
          const stack = syncStack.stack.substring(syncStack.stack.indexOf('\n') + 1);
          const clientStack = stack.substring(stack.indexOf('\n'));
          if (e instanceof Error && e.stack && !e.stack.includes(clientStack))
            e.stack += '\n  -- ASYNC --\n' + stack;
          throw e;
        });
      });
    }
  }

  static addEventListener(
    emitter: NodeJS.EventEmitter,
    eventName: (string | symbol),
    handler: (...args: any[]) => void): RegisteredListener {
    emitter.on(eventName, handler);
    return { emitter, eventName, handler };
  }

  static removeEventListeners(listeners: Array<{
      emitter: NodeJS.EventEmitter;
      eventName: (string | symbol);
      handler: (...args: any[]) => void;
    }>) {
    for (const listener of listeners)
      listener.emitter.removeListener(listener.eventName, listener.handler);
    listeners.splice(0, listeners.length);
  }

  static isString(obj: any): obj is string {
    return typeof obj === 'string' || obj instanceof String;
  }

  static isNumber(obj: any): obj is number {
    return typeof obj === 'number' || obj instanceof Number;
  }

  static promisify(nodeFunction: Function): Function {
    function promisified(...args) {
      return new Promise((resolve, reject) => {
        function callback(err, ...result) {
          if (err)
            return reject(err);
          if (result.length === 1)
            return resolve(result[0]);
          return resolve(result);
        }
        nodeFunction.call(null, ...args, callback);
      });
    }
    return promisified;
  }

  static async waitForEvent(
    emitter: NodeJS.EventEmitter,
    eventName: (string | symbol),
    predicate: Function,
    timeout: number,
    abortPromise: Promise<Error>): Promise<any> {
    let eventTimeout, resolveCallback, rejectCallback;
    const promise = new Promise((resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    });
    const listener = Helper.addEventListener(emitter, eventName, event => {
      try {
        if (!predicate(event))
          return;
        resolveCallback(event);
      } catch (e) {
        rejectCallback(e);
      }
    });
    if (timeout) {
      eventTimeout = setTimeout(() => {
        rejectCallback(new TimeoutError('Timeout exceeded while waiting for event'));
      }, timeout);
    }
    function cleanup() {
      Helper.removeEventListeners([listener]);
      clearTimeout(eventTimeout);
    }
    const result = await Promise.race([promise, abortPromise]).then(r => {
      cleanup();
      return r;
    }, e => {
      cleanup();
      throw e;
    });
    if (result instanceof Error)
      throw result;
    return result;
  }

  static async waitWithTimeout<T>(promise: Promise<T>, taskName: string, timeout: number): Promise<T> {
    let reject: (error: Error) => void;
    const timeoutError = new TimeoutError(`waiting for ${taskName} failed: timeout ${timeout}ms exceeded`);
    const timeoutPromise = new Promise<T>((resolve, x) => reject = x);
    let timeoutTimer = null;
    if (timeout)
      timeoutTimer = setTimeout(() => reject(timeoutError), timeout);
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutTimer)
        clearTimeout(timeoutTimer);
    }
  }

  static stringMatches(s: string, match: string | RegExp, name: string): boolean {
    if (helper.isString(match))
      return s === match;
    if (match instanceof RegExp)
      return match.test(s);
    throw new Error(`url match field "${name}" must be a string or a RegExp, got ${typeof match}`);
  }

  static searchParamsMatch(params: URLSearchParams, match: types.SearchParamsMatch, strict: boolean, name: string): boolean {
    if (typeof match !== 'object' || match === null)
      throw new Error(`url match field "${name}" must be an object, got ${typeof match}`);
    const keys = new Set((params as any).keys()) as Set<string>;
    if (strict && keys.size !== Object.keys(match).length)
      return false;
    for (const key of keys) {
      let expected = [];
      if (key in match) {
        let keyMatch = match[key];
        if (!Array.isArray(keyMatch))
          keyMatch = [keyMatch];
        expected = keyMatch;
      } else if (!strict) {
        continue;
      }
      const values = params.getAll(key);
      if (strict && values.length !== expected.length)
        return false;
      for (const v of values) {
        let found = false;
        for (const e of expected) {
          if (helper.stringMatches(v, e, name + '.' + key)) {
            found = true;
            break;
          }
        }
        if (!found)
          return false;
      }
    }
    return true;
  }

  static urlMatches(urlString: string, match: types.URLMatch): boolean {
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      return urlString === match.url &&
        match.hash === undefined &&
        match.host === undefined &&
        match.hostname === undefined &&
        match.origin === undefined &&
        match.password === undefined &&
        match.pathname === undefined &&
        match.port === undefined &&
        match.protocol === undefined &&
        match.search === undefined &&
        match.searchParams === undefined &&
        match.username === undefined;
    }
    if (match.url !== undefined && !helper.stringMatches(urlString, match.url, 'url'))
      return false;
    if (match.hash !== undefined && !helper.stringMatches(url.hash, match.hash, 'hash'))
      return false;
    if (match.host !== undefined && !helper.stringMatches(url.host, match.host, 'host'))
      return false;
    if (match.hostname !== undefined && !helper.stringMatches(url.hostname, match.hostname, 'hostname'))
      return false;
    if (match.origin !== undefined && !helper.stringMatches(url.origin, match.origin, 'origin'))
      return false;
    if (match.password !== undefined && !helper.stringMatches(url.password, match.password, 'password'))
      return false;
    if (match.pathname !== undefined && !helper.stringMatches(url.pathname, match.pathname, 'pathname'))
      return false;
    if (match.port !== undefined && !helper.stringMatches(url.port, match.port, 'port'))
      return false;
    if (match.protocol !== undefined && !helper.stringMatches(url.protocol, match.protocol, 'protocol'))
      return false;
    if (match.search !== undefined && !helper.stringMatches(url.search, match.search, 'search'))
      return false;
    if (match.username !== undefined && !helper.stringMatches(url.username, match.username, 'username'))
      return false;
    if (match.searchParams !== undefined && !helper.searchParamsMatch(url.searchParams, match.searchParams, !!match.strictSearchParams, 'searchParams'))
      return false;
    return true;
  }
}

export function assert(value: any, message?: string) {
  if (!value)
    throw new Error(message);
}

export const helper = Helper;

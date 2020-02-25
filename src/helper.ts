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

import { TimeoutError } from './errors';
import * as platform from './platform';

export const debugError = platform.debug(`pw:error`);

export type RegisteredListener = {
  emitter: platform.EventEmitterType;
  eventName: (string | symbol);
  handler: (...args: any[]) => void;
};

class Helper {
  static evaluationString(fun: Function | string, ...args: any[]): string {
    if (Helper.isString(fun)) {
      assert(args.length === 0, 'Cannot evaluate a string with arguments');
      return fun;
    }
    return `(${fun})(${args.map(serializeArgument).join(',')})`;

    function serializeArgument(arg: any): string {
      if (Object.is(arg, undefined))
        return 'undefined';
      return JSON.stringify(arg);
    }
  }

  static installApiHooks(className: string, classType: any) {
    const log = platform.debug('pw:api');
    for (const methodName of Reflect.ownKeys(classType.prototype)) {
      const method = Reflect.get(classType.prototype, methodName);
      if (methodName === 'constructor' || typeof methodName !== 'string' || methodName.startsWith('_') || typeof method !== 'function')
        continue;
      const isAsync = method.constructor.name === 'AsyncFunction';
      if (!isAsync && !log.enabled)
        continue;
      Reflect.set(classType.prototype, methodName, function(this: any, ...args: any[]) {
        const syncStack: any = {};
        Error.captureStackTrace(syncStack);
        if (log.enabled) {
          const frames = syncStack.stack.substring('Error\n'.length)
              .split('\n')
              .map((f: string) => f.replace(/\s+at\s/, '').trim());
          const userCall = frames.length <= 1 || !frames[1].includes('playwright/lib');
          if (userCall) {
            const match = /([^/\\]+)(:\d+:\d+)[)]?$/.exec(frames[1]);
            let location = '';
            if (match) {
              const fileName = helper.trimMiddle(match[1], 20 - match[2].length);
              location = `\u001b[33m[${fileName}${match[2]}]\u001b[39m `;
            }
            if (args.length)
              log(`${location}${className}.${methodName} %o`, args);
            else
              log(`${location}${className}.${methodName}`);
          }
        }
        if (!isAsync)
          return method.call(this, ...args);
        return method.call(this, ...args).catch((e: any) => {
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
    emitter: platform.EventEmitterType,
    eventName: (string | symbol),
    handler: (...args: any[]) => void): RegisteredListener {
    emitter.on(eventName, handler);
    return { emitter, eventName, handler };
  }

  static removeEventListeners(listeners: Array<{
      emitter: platform.EventEmitterType;
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

  static isRegExp(obj: any): obj is RegExp {
    return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
  }

  static isObject(obj: any): obj is NonNullable<object> {
    return typeof obj === 'object' && obj !== null;
  }

  static isBoolean(obj: any): obj is boolean {
    return typeof obj === 'boolean' || obj instanceof Boolean;
  }

  static async waitForEvent(
    emitter: platform.EventEmitterType,
    eventName: (string | symbol),
    predicate: Function,
    timeout: number,
    abortPromise: Promise<Error>): Promise<any> {
    let eventTimeout: NodeJS.Timer;
    let resolveCallback: (event: any) => void = () => {};
    let rejectCallback: (error: any) => void = () => {};
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
        rejectCallback(new TimeoutError(`Timeout exceeded while waiting for ${String(eventName)}`));
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

  static globToRegex(glob: string): RegExp {
    const tokens = ['^'];
    let inGroup;
    for (let i = 0; i < glob.length; ++i) {
      const c = glob[i];
      if (escapeGlobChars.has(c)) {
        tokens.push('\\' + c);
        continue;
      }
      if (c === '*') {
        const beforeDeep = glob[i - 1];
        let starCount = 1;
        while (glob[i + 1] === '*') {
          starCount++;
          i++;
        }
        const afterDeep = glob[i + 1];
        const isDeep = starCount > 1 &&
            (beforeDeep === '/' || beforeDeep === undefined) &&
            (afterDeep === '/' || afterDeep === undefined);
        if (isDeep) {
          tokens.push('((?:[^/]*(?:\/|$))*)');
          i++;
        } else {
          tokens.push('([^/]*)');
        }
        continue;
      }

      switch (c) {
        case '?':
          tokens.push('.');
          break;
        case '{':
          inGroup = true;
          tokens.push('(');
          break;
        case '}':
          inGroup = false;
          tokens.push(')');
          break;
        case ',':
          if (inGroup) {
            tokens.push('|');
            break;
          }
          tokens.push('\\' + c);
          break;
        default:
          tokens.push(c);
      }
    }
    tokens.push('$');
    return new RegExp(tokens.join(''));
  }

  static completeUserURL(urlString: string): string {
    if (urlString.startsWith('localhost') || urlString.startsWith('127.0.0.1'))
      urlString = 'http://' + urlString;
    return urlString;
  }

  static trimMiddle(string: string, maxLength: number) {
    if (string.length <= maxLength)
      return string;

    const leftHalf = maxLength >> 1;
    const rightHalf = maxLength - leftHalf - 1;
    return string.substr(0, leftHalf) + '\u2026' + string.substr(this.length - rightHalf, rightHalf);
  }
}

export function assert(value: any, message?: string): asserts value {
  if (!value)
    throw new Error(message);
}

const escapeGlobChars = new Set(['/', '$', '^', '+', '.', '(', ')', '=', '!', '|']);

export const helper = Helper;

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

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as removeFolder from 'rimraf';
import * as util from 'util';
import * as types from './types';
import { Progress } from './progress';

const removeFolderAsync = util.promisify(removeFolder);

export type RegisteredListener = {
  emitter: EventEmitter;
  eventName: (string | symbol);
  handler: (...args: any[]) => void;
};

export type Listener = (...args: any[]) => void;

const isInDebugMode = !!getFromENV('PWDEBUG');

const deprecatedHits = new Set();
export function deprecate(methodName: string, message: string) {
  if (deprecatedHits.has(methodName))
    return;
  deprecatedHits.add(methodName);
  console.warn(message);
}

class Helper {

  static evaluationString(fun: Function | string, ...args: any[]): string {
    if (Helper.isString(fun)) {
      assert(args.length === 0 || (args.length === 1 && args[0] === undefined), 'Cannot evaluate a string with arguments');
      return fun;
    }
    return Helper.evaluationStringForFunctionBody(String(fun), ...args);
  }

  static evaluationStringForFunctionBody(functionBody: string, ...args: any[]): string {
    return `(${functionBody})(${args.map(serializeArgument).join(',')})`;
    function serializeArgument(arg: any): string {
      if (Object.is(arg, undefined))
        return 'undefined';
      return JSON.stringify(arg);
    }
  }

  static async evaluationScript(fun: Function | string | { path?: string, content?: string }, arg?: any, addSourceUrl: boolean = true): Promise<string> {
    if (!helper.isString(fun) && typeof fun !== 'function') {
      if (fun.content !== undefined) {
        fun = fun.content;
      } else if (fun.path !== undefined) {
        let contents = await util.promisify(fs.readFile)(fun.path, 'utf8');
        if (addSourceUrl)
          contents += '//# sourceURL=' + fun.path.replace(/\n/g, '');
        fun = contents;
      } else {
        throw new Error('Either path or content property must be present');
      }
    }
    return helper.evaluationString(fun, arg);
  }

  static installApiHooks(className: string, classType: any) {
    for (const methodName of Reflect.ownKeys(classType.prototype)) {
      const method = Reflect.get(classType.prototype, methodName);
      if (methodName === 'constructor' || typeof methodName !== 'string' || methodName.startsWith('_') || typeof method !== 'function')
        continue;
      const isAsync = method.constructor.name === 'AsyncFunction';
      if (!isAsync)
        continue;
      const override = function(this: any, ...args: any[]) {
        const syncStack: any = {};
        Error.captureStackTrace(syncStack);
        return method.call(this, ...args).catch((e: any) => {
          const stack = syncStack.stack.substring(syncStack.stack.indexOf('\n') + 1);
          const clientStack = stack.substring(stack.indexOf('\n'));
          if (e instanceof Error && e.stack && !e.stack.includes(clientStack))
            e.stack += '\n  -- ASYNC --\n' + stack;
          throw e;
        });
      };
      Object.defineProperty(override, 'name', { writable: false, value: methodName });
      Reflect.set(classType.prototype, methodName, override);
    }
  }

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

  static isString(obj: any): obj is string {
    return typeof obj === 'string' || obj instanceof String;
  }

  static isNumber(obj: any): obj is number {
    return typeof obj === 'number' || obj instanceof Number;
  }

  static isRegExp(obj: any): obj is RegExp {
    return obj instanceof RegExp || Object.prototype.toString.call(obj) === '[object RegExp]';
  }

  static isError(obj: any): obj is Error {
    return obj instanceof Error || (obj && obj.__proto__ && obj.__proto__.name === 'Error');
  }

  static isObject(obj: any): obj is NonNullable<object> {
    return typeof obj === 'object' && obj !== null;
  }

  static isBoolean(obj: any): obj is boolean {
    return typeof obj === 'boolean' || obj instanceof Boolean;
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

  static enclosingIntRect(rect: types.Rect): types.Rect {
    const x = Math.floor(rect.x + 1e-3);
    const y = Math.floor(rect.y + 1e-3);
    const x2 = Math.ceil(rect.x + rect.width - 1e-3);
    const y2 = Math.ceil(rect.y + rect.height - 1e-3);
    return { x, y, width: x2 - x, height: y2 - y };
  }

  static enclosingIntSize(size: types.Size): types.Size {
    return { width: Math.floor(size.width + 1e-3), height: Math.floor(size.height + 1e-3) };
  }

  static urlMatches(urlString: string, match: types.URLMatch | undefined): boolean {
    if (match === undefined || match === '')
      return true;
    if (helper.isString(match))
      match = helper.globToRegex(match);
    if (helper.isRegExp(match))
      return match.test(urlString);
    if (typeof match === 'string' && match === urlString)
      return true;
    const url = new URL(urlString);
    if (typeof match === 'string')
      return url.pathname === match;

    assert(typeof match === 'function', 'url parameter should be string, RegExp or function');
    return match(url);
  }

  // See https://joel.tools/microtasks/
  static makeWaitForNextTask() {
    if (parseInt(process.versions.node, 10) >= 11)
      return setImmediate;

    // Unlike Node 11, Node 10 and less have a bug with Task and MicroTask execution order:
    // - https://github.com/nodejs/node/issues/22257
    //
    // So we can't simply run setImmediate to dispatch code in a following task.
    // However, we can run setImmediate from-inside setImmediate to make sure we're getting
    // in the following task.

    let spinning = false;
    const callbacks: (() => void)[] = [];
    const loop = () => {
      const callback = callbacks.shift();
      if (!callback) {
        spinning = false;
        return;
      }
      setImmediate(loop);
      // Make sure to call callback() as the last thing since it's
      // untrusted code that might throw.
      callback();
    };

    return (callback: () => void) => {
      callbacks.push(callback);
      if (!spinning) {
        spinning = true;
        setImmediate(loop);
      }
    };
  }

  static guid(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static getViewportSizeFromWindowFeatures(features: string[]): types.Size | null {
    const widthString = features.find(f => f.startsWith('width='));
    const heightString = features.find(f => f.startsWith('height='));
    const width = widthString ? parseInt(widthString.substring(6), 10) : NaN;
    const height = heightString ? parseInt(heightString.substring(7), 10) : NaN;
    if (!Number.isNaN(width) && !Number.isNaN(height))
      return { width, height };
    return null;
  }

  static async removeFolders(dirs: string[]) {
    await Promise.all(dirs.map(dir => {
      return removeFolderAsync(dir).catch((err: Error) => console.error(err));
    }));
  }

  static waitForEvent(progress: Progress | null, emitter: EventEmitter, event: string | symbol, predicate?: Function): { promise: Promise<any>, dispose: () => void } {
    const listeners: RegisteredListener[] = [];
    const promise = new Promise((resolve, reject) => {
      listeners.push(helper.addEventListener(emitter, event, eventArg => {
        try {
          if (predicate && !predicate(eventArg))
            return;
          helper.removeEventListeners(listeners);
          resolve(eventArg);
        } catch (e) {
          helper.removeEventListeners(listeners);
          reject(e);
        }
      }));
    });
    const dispose = () => helper.removeEventListeners(listeners);
    if (progress)
      progress.cleanupWhenAborted(dispose);
    return { promise, dispose };
  }

  static isDebugMode(): boolean {
    return isInDebugMode;
  }
}

export function assert(value: any, message?: string): asserts value {
  if (!value)
    throw new Error(message);
}

let _isUnderTest = false;

export function setUnderTest() {
  _isUnderTest = true;
}

export function isUnderTest(): boolean {
  return _isUnderTest;
}

export function debugAssert(value: any, message?: string): asserts value {
  if (_isUnderTest && !value)
    throw new Error(message);
}

export function assertMaxArguments(count: number, max: number): asserts count {
  assert(count <= max, 'Too many arguments. If you need to pass more than 1 argument to the function wrap them in an object.');
}

export function getFromENV(name: string) {
  let value = process.env[name];
  value = value || process.env[`npm_config_${name.toLowerCase()}`];
  value = value || process.env[`npm_package_config_${name.toLowerCase()}`];
  return value;
}

export function logPolitely(toBeLogged: string) {
  const logLevel = process.env.npm_config_loglevel;
  const logLevelDisplay = ['silent', 'error', 'warn'].indexOf(logLevel || '') > -1;

  if (!logLevelDisplay)
    console.log(toBeLogged);  // eslint-disable-line no-console
}

const escapeGlobChars = new Set(['/', '$', '^', '+', '.', '(', ')', '=', '!', '|']);

export const helper = Helper;

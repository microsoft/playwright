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
import * as os from 'os';
import * as removeFolder from 'rimraf';
import * as util from 'util';
import * as path from 'path';
import * as types from './types';
import { Progress } from './progress';
import * as debug from 'debug';

const removeFolderAsync = util.promisify(removeFolder);
const readFileAsync = util.promisify(fs.readFile.bind(fs));
const mkdirAsync = util.promisify(fs.mkdir.bind(fs));

export type RegisteredListener = {
  emitter: EventEmitter;
  eventName: (string | symbol);
  handler: (...args: any[]) => void;
};

export type Listener = (...args: any[]) => void;

const isInDebugMode = !!getFromENV('PWDEBUG');

class Helper {
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

  static completeUserURL(urlString: string): string {
    if (urlString.startsWith('localhost') || urlString.startsWith('127.0.0.1'))
      urlString = 'http://' + urlString;
    return urlString;
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

export async function getUbuntuVersion(): Promise<string> {
  if (os.platform() !== 'linux')
    return '';
  const osReleaseText = await readFileAsync('/etc/os-release', 'utf8').catch(e => '');
  if (!osReleaseText)
    return '';
  return getUbuntuVersionInternal(osReleaseText);
}

export function getUbuntuVersionSync(): string {
  if (os.platform() !== 'linux')
    return '';
  try {
    const osReleaseText = fs.readFileSync('/etc/os-release', 'utf8');
    if (!osReleaseText)
      return '';
    return getUbuntuVersionInternal(osReleaseText);
  } catch (e) {
    return '';
  }
}

function getUbuntuVersionInternal(osReleaseText: string): string {
  const fields = new Map();
  for (const line of osReleaseText.split('\n')) {
    const tokens = line.split('=');
    const name = tokens.shift();
    let value = tokens.join('=').trim();
    if (value.startsWith('"') && value.endsWith('"'))
      value = value.substring(1, value.length - 1);
    if (!name)
      continue;
    fields.set(name.toLowerCase(), value);
  }
  if (!fields.get('name') || fields.get('name').toLowerCase() !== 'ubuntu')
    return '';
  return fields.get('version_id') || '';
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

export function getFromENV(name: string) {
  let value = process.env[name];
  value = value || process.env[`npm_config_${name.toLowerCase()}`];
  value = value || process.env[`npm_package_config_${name.toLowerCase()}`];
  return value;
}

export async function doSlowMo(amount?: number) {
  if (!amount)
    return;
  await new Promise(x => setTimeout(x, amount));
}

export async function mkdirIfNeeded(filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await mkdirAsync(path.dirname(filePath), {recursive: true}).catch(() => {});
}

export const helper = Helper;

const debugLoggerColorMap = {
  'api': 45, // cyan
  'protocol': 34, // green
  'browser': 0, // reset
  'error': 160, // red,
  'channel:command': 33, // blue
  'channel:response': 202, // orange
  'channel:event': 207, // magenta
};
export type LogName = keyof typeof debugLoggerColorMap;

export class DebugLogger {
  private _debuggers = new Map<string, debug.IDebugger>();

  constructor() {
    if (process.env.DEBUG_FILE) {
      const ansiRegex = new RegExp([
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))'
      ].join('|'), 'g');
      const stream = fs.createWriteStream(process.env.DEBUG_FILE);
      (debug as any).log = (data: string) => {
        stream.write(data.replace(ansiRegex, ''));
        stream.write('\n');
      };
    }
  }

  log(name: LogName, message: string | Error | object) {
    let cachedDebugger = this._debuggers.get(name);
    if (!cachedDebugger) {
      cachedDebugger = debug(`pw:${name}`);
      this._debuggers.set(name, cachedDebugger);
      (cachedDebugger as any).color = debugLoggerColorMap[name];
    }
    cachedDebugger(message);
  }

  isEnabled(name: LogName) {
    return debug.enabled(`pw:${name}`);
  }
}

export const debugLogger = new DebugLogger();

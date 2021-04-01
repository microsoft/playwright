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

import path from 'path';
import util from 'util';
import StackUtils from 'stack-utils';
import { TestError } from './types';
import { default as minimatch } from 'minimatch';

const FOLIO_DIRS = [__dirname, path.join(__dirname, '..', 'src')];
const cwd = process.cwd();
const stackUtils = new StackUtils({ cwd });

export async function raceAgainstDeadline<T>(promise: Promise<T>, deadline: number): Promise<{ result?: T, timedOut?: boolean }> {
  if (!deadline)
    return { result: await promise };

  const timeout = deadline - monotonicTime();
  if (timeout <= 0)
    return { timedOut: true };

  let timer: NodeJS.Timer;
  let done = false;
  let fulfill: (t: { result?: T, timedOut?: boolean }) => void;
  let reject: (e: Error) => void;
  const result = new Promise((f, r) => {
    fulfill = f;
    reject = r;
  });
  setTimeout(() => {
    done = true;
    fulfill({ timedOut: true });
  }, timeout);
  promise.then(result => {
    clearTimeout(timer);
    if (!done) {
      done = true;
      fulfill({ result });
    }
  }).catch(e => {
    clearTimeout(timer);
    if (!done)
      reject(e);
  });
  return result;
}

export function serializeError(error: Error | any): TestError {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }
  return {
    value: util.inspect(error)
  };
}

function callFrames(): string[] {
  const obj = { stack: '' };
  Error.captureStackTrace(obj);
  const frames = obj.stack.split('\n').slice(1);
  while (frames.length && FOLIO_DIRS.some(dir => frames[0].includes(dir)))
    frames.shift();
  return frames;
}

export function callLocation(fallbackFile: string): {file: string, line: number, column: number} {
  const frames = callFrames();
  if (!frames.length)
    return {file: fallbackFile, line: 1, column: 1};
  const location = stackUtils.parseLine(frames[0]);
  return {
    file: path.resolve(cwd, location.file),
    line: location.line,
    column: location.column,
  };
}

export function errorWithCallLocation(message: string): Error {
  const frames = callFrames();
  const error = new Error(message);
  error.stack = 'Error: ' + message + '\n' + frames.join('\n');
  return error;
}

export function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000000 | 0);
}

export function prependErrorMessage(e: Error, message: string) {
  let stack = e.stack || '';
  if (stack.includes(e.message))
    stack = stack.substring(stack.indexOf(e.message) + e.message.length);
  let m = e.message;
  if (m.startsWith('Error:'))
    m = m.substring('Error:'.length);
  e.message = message + m;
  e.stack = e.message + stack;
}

export function interpretCondition(arg?: boolean | string, description?: string): { condition: boolean, description?: string } {
  if (arg === undefined && description === undefined)
    return { condition: true };
  if (typeof arg === 'string')
    return { condition: true, description: arg };
  return { condition: !!arg, description };
}

export function createMatcher(patterns: string | RegExp | (string | RegExp)[]): (value: string) => boolean {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  return (value: string) => {
    for (const pattern of list) {
      if (pattern instanceof RegExp || Object.prototype.toString.call(pattern) === '[object RegExp]') {
        if ((pattern as RegExp).test(value))
          return true;
      } else {
        if (minimatch(value, pattern))
          return true;
      }
    }
    return false;
  };
}

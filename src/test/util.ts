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

import type { TestInfoImpl } from './types';
import util from 'util';
import path from 'path';
import type { TestError, Location } from './types';
import { default as minimatch } from 'minimatch';
import { errors } from '../..';

export async function pollUntilDeadline(testInfo: TestInfoImpl, func: (remainingTime: number) => Promise<boolean>, pollTime: number | undefined, deadlinePromise: Promise<void>): Promise<void> {
  let defaultExpectTimeout = testInfo.project.expect?.timeout;
  if (typeof defaultExpectTimeout === 'undefined')
    defaultExpectTimeout = 5000;
  pollTime = pollTime === 0 ? 0 : pollTime || defaultExpectTimeout;
  const deadline = pollTime ? monotonicTime() + pollTime : 0;

  let aborted = false;
  const abortedPromise = deadlinePromise.then(() => {
    aborted = true;
    return true;
  });

  const pollIntervals = [100, 250, 500];
  let attempts = 0;
  while (!aborted) {
    const remainingTime = deadline ? deadline - monotonicTime() : 1000 * 3600 * 24;
    if (remainingTime <= 0)
      break;

    try {
      // Either aborted, or func() returned truthy.
      const result = await Promise.race([
        func(remainingTime),
        abortedPromise,
      ]);
      if (result)
        return;
    } catch (e) {
      if (e instanceof errors.TimeoutError)
        return;
      throw e;
    }

    let timer: NodeJS.Timer;
    const timeoutPromise = new Promise(f => timer = setTimeout(f, pollIntervals[attempts++] || 1000));
    await Promise.race([abortedPromise, timeoutPromise]);
    clearTimeout(timer!);
  }
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

export function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime();
  return seconds * 1000 + (nanoseconds / 1000000 | 0);
}

export function isRegExp(e: any): e is RegExp {
  return e && typeof e === 'object' && (e instanceof RegExp || Object.prototype.toString.call(e) === '[object RegExp]');
}

export type Matcher = (value: string) => boolean;

export type FilePatternFilter = {
  re: RegExp;
  line: number | null;
};

export function createMatcher(patterns: string | RegExp | (string | RegExp)[]): Matcher {
  const reList: RegExp[] = [];
  const filePatterns: string[] = [];
  for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
    if (isRegExp(pattern)) {
      reList.push(pattern);
    } else {
      if (!pattern.startsWith('**/') && !pattern.startsWith('**/'))
        filePatterns.push('**/' + pattern);
      else
        filePatterns.push(pattern);
    }
  }

  return (value: string) => {
    for (const re of reList) {
      re.lastIndex = 0;
      if (re.test(value))
        return true;
    }
    for (const pattern of filePatterns) {
      if (minimatch(value, pattern, {
        nocase: true,
      }))
        return true;
    }
    return false;
  };
}

export function mergeObjects<A extends object, B extends object>(a: A | undefined | void, b: B | undefined | void): A & B {
  const result = { ...a } as any;
  if (!Object.is(b, undefined)) {
    for (const [name, value] of Object.entries(b as B)) {
      if (!Object.is(value, undefined))
        result[name] = value;
    }
  }
  return result as any;
}

export async function wrapInPromise(value: any) {
  return value;
}

export function forceRegExp(pattern: string): RegExp {
  const match = pattern.match(/^\/(.*)\/([gi]*)$/);
  if (match)
    return new RegExp(match[1], match[2]);
  return new RegExp(pattern, 'g');
}

export function relativeFilePath(file: string): string {
  if (!path.isAbsolute(file))
    return file;
  return path.relative(process.cwd(), file);
}

export function formatLocation(location: Location) {
  return relativeFilePath(location.file) + ':' + location.line + ':' + location.column;
}

export function errorWithFile(file: string, message: string) {
  return new Error(`${relativeFilePath(file)}: ${message}`);
}

export function errorWithLocation(location: Location, message: string) {
  return new Error(`${formatLocation(location)}: ${message}`);
}

export function expectType(receiver: any, type: string, matcherName: string) {
  if (typeof receiver !== 'object' || receiver.constructor.name !== type)
    throw new Error(`${matcherName} can be only used with ${type} object`);
}

export function sanitizeForFilePath(s: string) {
  return s.replace(/[\x00-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-');
}

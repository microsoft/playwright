/**
 * Copyright Microsoft Corporation. All rights reserved.
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

import expectLibrary from 'expect';
import { raceAgainstTimeout, monotonicTime } from 'playwright-core/lib/utils';
import path from 'path';
import {
  INVERTED_COLOR,
  RECEIVED_COLOR,
  printReceived,
} from 'jest-matcher-utils';
import {
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeOK,
  toBeVisible,
  toContainText,
  toHaveAttribute,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveId,
  toHaveJSProperty,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue
} from './matchers/matchers';
import { toMatchSnapshot, toHaveScreenshot as _toHaveScreenshot } from './matchers/toMatchSnapshot';
import type { Expect } from './types';
import { currentTestInfo } from './globals';
import { serializeError, captureStackTrace, currentExpectTimeout } from './util';

// from expect/build/types
export type SyncExpectationResult = {
  pass: boolean;
  message: () => string;
};

// #region
// Mirrored from https://github.com/facebook/jest/blob/f13abff8df9a0e1148baf3584bcde6d1b479edc7/packages/expect/src/print.ts
/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found here
 * https://github.com/facebook/jest/blob/1547740bbc26400d69f4576bf35645163e942829/LICENSE
 */

// Format substring but do not enclose in double quote marks.
// The replacement is compatible with pretty-format package.
const printSubstring = (val: string): string => val.replace(/"|\\/g, '\\$&');

export const printReceivedStringContainExpectedSubstring = (
  received: string,
  start: number,
  length: number, // not end
): string =>
  RECEIVED_COLOR(
      '"' +
      printSubstring(received.slice(0, start)) +
      INVERTED_COLOR(printSubstring(received.slice(start, start + length))) +
      printSubstring(received.slice(start + length)) +
      '"',
  );

export const printReceivedStringContainExpectedResult = (
  received: string,
  result: RegExpExecArray | null,
): string =>
  result === null
    ? printReceived(received)
    : printReceivedStringContainExpectedSubstring(
        received,
        result.index,
        result[0].length,
    );

// #endregion

type ExpectMessageOrOptions = undefined | string | { message?: string, timeout?: number };

function createExpect(actual: unknown, messageOrOptions: ExpectMessageOrOptions, isSoft: boolean, isPoll: boolean, generator?: Generator) {
  return new Proxy(expectLibrary(actual), new ExpectMetaInfoProxyHandler(messageOrOptions, isSoft, isPoll, generator));
}

export const expect: Expect = new Proxy(expectLibrary as any, {
  apply: function(target: any, thisArg: any, argumentsList: [actual: unknown, messageOrOptions: ExpectMessageOrOptions]) {
    const [actual, messageOrOptions] = argumentsList;
    return createExpect(actual, messageOrOptions, false /* isSoft */, false /* isPoll */);
  }
});

expect.soft = (actual: unknown, messageOrOptions: ExpectMessageOrOptions) => {
  return createExpect(actual, messageOrOptions, true /* isSoft */, false /* isPoll */);
};

expect.poll = (actual: unknown, messageOrOptions: ExpectMessageOrOptions) => {
  if (typeof actual !== 'function')
    throw new Error('`expect.poll()` accepts only function as a first argument');
  return createExpect(actual, messageOrOptions, false /* isSoft */, true /* isPoll */, actual as any);
};

expectLibrary.setState({ expand: false });
const customMatchers = {
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeOK,
  toBeVisible,
  toContainText,
  toHaveAttribute,
  toHaveClass,
  toHaveCount,
  toHaveCSS,
  toHaveId,
  toHaveJSProperty,
  toHaveText,
  toHaveTitle,
  toHaveURL,
  toHaveValue,
  toMatchSnapshot,
  _toHaveScreenshot,
};

type Generator = () => any;

type ExpectMetaInfo = {
  message?: string;
  isNot: boolean;
  isSoft: boolean;
  isPoll: boolean;
  pollTimeout?: number;
  generator?: Generator;
};

class ExpectMetaInfoProxyHandler {
  private _info: ExpectMetaInfo;

  constructor(messageOrOptions: ExpectMessageOrOptions, isSoft: boolean, isPoll: boolean, generator?: Generator) {
    this._info = { isSoft, isPoll, generator, isNot: false };
    if (typeof messageOrOptions === 'string') {
      this._info.message = messageOrOptions;
    } else {
      this._info.message = messageOrOptions?.message;
      this._info.pollTimeout = messageOrOptions?.timeout;
    }
  }

  get(target: any, matcherName: any, receiver: any): any {
    const matcher = Reflect.get(target, matcherName, receiver);
    if (matcher === undefined)
      throw new Error(`expect: Property '${matcherName}' not found.`);
    if (typeof matcher !== 'function') {
      if (matcherName === 'not')
        this._info.isNot = !this._info.isNot;
      return new Proxy(matcher, this);
    }
    return (...args: any[]) => {
      const testInfo = currentTestInfo();
      if (!testInfo)
        return matcher.call(target, ...args);

      const stackTrace = captureStackTrace();
      const stackLines = stackTrace.frameTexts;
      const frame = stackTrace.frames[0];
      const customMessage = this._info.message || '';
      const defaultTitle = `expect${this._info.isPoll ? '.poll' : ''}${this._info.isSoft ? '.soft' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}`;
      const step = testInfo._addStep({
        location: frame && frame.file ? { file: path.resolve(process.cwd(), frame.file), line: frame.line || 0, column: frame.column || 0 } : undefined,
        category: 'expect',
        title: customMessage || defaultTitle,
        canHaveChildren: true,
        forceNoParent: false
      });
      testInfo.currentStep = step;

      const reportStepError = (jestError: Error) => {
        const message = jestError.message;
        if (customMessage) {
          const messageLines = message.split('\n');
          // Jest adds something like the following error to all errors:
          //    expect(received).toBe(expected); // Object.is equality
          const uselessMatcherLineIndex = messageLines.findIndex((line: string) => /expect.*\(.*received.*\)/.test(line));
          if (uselessMatcherLineIndex !== -1) {
            // if there's a newline after the matcher text, then remove it as well.
            if (uselessMatcherLineIndex + 1 < messageLines.length && messageLines[uselessMatcherLineIndex + 1].trim() === '')
              messageLines.splice(uselessMatcherLineIndex, 2);
            else
              messageLines.splice(uselessMatcherLineIndex, 1);
          }
          const newMessage = [
            'Error: ' + customMessage,
            '',
            ...messageLines,
          ].join('\n');
          jestError.message = newMessage;
          jestError.stack = newMessage + '\n' + stackLines.join('\n');
        }

        const serializerError = serializeError(jestError);
        step.complete({ error: serializerError });
        if (this._info.isSoft)
          testInfo._failWithError(serializerError, false /* isHardError */);
        else
          throw jestError;
      };

      try {
        let result;
        if (this._info.isPoll) {
          if ((customMatchers as any)[matcherName] || matcherName === 'resolves' || matcherName === 'rejects')
            throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
          result = pollMatcher(matcherName, this._info.isNot, currentExpectTimeout({ timeout: this._info.pollTimeout }), this._info.generator!, ...args);
        } else {
          result = matcher.call(target, ...args);
        }
        if ((result instanceof Promise))
          return result.then(() => step.complete({})).catch(reportStepError);
        else
          step.complete({});
      } catch (e) {
        reportStepError(e);
      }
    };
  }
}

async function pollMatcher(matcherName: any, isNot: boolean, timeout: number, generator: () => any, ...args: any[]) {
  let matcherError;
  const startTime = monotonicTime();
  const pollIntervals = [100, 250, 500];
  while (true) {
    const elapsed = monotonicTime() - startTime;
    if (timeout !== 0 && elapsed > timeout)
      break;
    const received = timeout !== 0 ? await raceAgainstTimeout(generator, timeout - elapsed) : await generator();
    if (received.timedOut)
      break;
    try {
      let expectInstance = expectLibrary(received.result) as any;
      if (isNot)
        expectInstance = expectInstance.not;
      expectInstance[matcherName].call(expectInstance, ...args);
      return;
    } catch (e) {
      matcherError = e;
    }
    await new Promise(x => setTimeout(x, pollIntervals.shift() ?? 1000));
  }

  const timeoutMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
  const message = matcherError ? [
    matcherError.message,
    '',
    `Call Log:`,
    `- ${timeoutMessage}`,
  ].join('\n') : timeoutMessage;

  throw new Error(message);
}

expectLibrary.extend(customMatchers);

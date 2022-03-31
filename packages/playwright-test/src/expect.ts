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
import { raceAgainstTimeout } from 'playwright-core/lib/utils/async';
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
import { toMatchSnapshot, toHaveScreenshot } from './matchers/toMatchSnapshot';
import type { Expect, TestError } from './types';
import matchers from 'expect/build/matchers';
import { currentTestInfo } from './globals';
import { serializeError, captureStackTrace, currentExpectTimeout } from './util';
import { monotonicTime } from 'playwright-core/lib/utils/utils';

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

function createExpect(actual: unknown, messageOrOptions: ExpectMessageOrOptions, isSoft: boolean, isPoll: boolean) {
  return new Proxy(expectLibrary(actual), new ExpectMetaInfoProxyHandler(messageOrOptions, isSoft, isPoll));
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
  return createExpect(actual, messageOrOptions, false /* isSoft */, true /* isPoll */);
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
  toHaveScreenshot,
};

type ExpectMetaInfo = {
  message?: string;
  isSoft: boolean;
  isPoll: boolean;
  pollTimeout?: number;
};

let expectCallMetaInfo: undefined|ExpectMetaInfo = undefined;

class ExpectMetaInfoProxyHandler {
  private _info: ExpectMetaInfo;

  constructor(messageOrOptions: ExpectMessageOrOptions, isSoft: boolean, isPoll: boolean) {
    this._info = { isSoft, isPoll };
    if (typeof messageOrOptions === 'string') {
      this._info.message = messageOrOptions;
    } else {
      this._info.message = messageOrOptions?.message;
      this._info.pollTimeout = messageOrOptions?.timeout;
    }
  }

  get(target: any, prop: any, receiver: any): any {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value !== 'function')
      return new Proxy(value, this);
    return (...args: any[]) => {
      const testInfo = currentTestInfo();
      if (!testInfo)
        return value.call(target, ...args);
      const handleError = (e: Error) => {
        if (this._info.isSoft)
          testInfo._failWithError(serializeError(e), false /* isHardError */);
        else
          throw e;
      };
      try {
        expectCallMetaInfo = {
          message: this._info.message,
          isSoft: this._info.isSoft,
          isPoll: this._info.isPoll,
          pollTimeout: this._info.pollTimeout,
        };
        let result = value.call(target, ...args);
        if ((result instanceof Promise))
          result = result.catch(handleError);
        return result;
      } catch (e) {
        handleError(e);
      } finally {
        expectCallMetaInfo = undefined;
      }
    };
  }
}

async function pollMatcher(matcher: any, timeout: number, thisArg: any, generator: () => any, ...args: any[]) {
  let result: { pass: boolean, message: () => string } | undefined = undefined;
  const startTime = monotonicTime();
  const pollIntervals = [100, 250, 500];
  while (true) {
    const elapsed = monotonicTime() - startTime;
    if (timeout !== 0 && elapsed > timeout)
      break;
    const received = timeout !== 0 ? await raceAgainstTimeout(generator, timeout - elapsed) : await generator();
    if (received.timedOut)
      break;
    result = matcher.call(thisArg, received.result, ...args);
    const success = result!.pass !== thisArg.isNot;
    if (success)
      return result;
    await new Promise(x => setTimeout(x, pollIntervals.shift() ?? 1000));
  }
  const timeoutMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
  const message = result ? [
    result.message(),
    '',
    `Call Log:`,
    `- ${timeoutMessage}`,
  ].join('\n') : timeoutMessage;
  return {
    pass: thisArg.isNot,
    message: () => message,
  };
}

function wrap(matcherName: string, matcher: any) {
  return function(this: any, ...args: any[]) {
    const testInfo = currentTestInfo();
    if (!testInfo)
      return matcher.call(this, ...args);

    const stackTrace = captureStackTrace();
    const stackLines = stackTrace.frameTexts;
    const frame = stackTrace.frames[0];
    const customMessage = expectCallMetaInfo?.message ?? '';
    const isSoft = expectCallMetaInfo?.isSoft ?? false;
    const isPoll = expectCallMetaInfo?.isPoll ?? false;
    const pollTimeout = expectCallMetaInfo?.pollTimeout;
    const defaultTitle = `expect${isPoll ? '.poll' : ''}${isSoft ? '.soft' : ''}${this.isNot ? '.not' : ''}.${matcherName}`;
    const step = testInfo._addStep({
      location: frame && frame.file ? { file: path.resolve(process.cwd(), frame.file), line: frame.line || 0, column: frame.column || 0 } : undefined,
      category: 'expect',
      title: customMessage || defaultTitle,
      canHaveChildren: true,
      forceNoParent: false
    });

    const reportStepEnd = (result: any, options: { refinedTitle?: string }) => {
      const success = result.pass !== this.isNot;
      let error: TestError | undefined;
      if (!success) {
        const message = result.message();
        error = { message, stack: message + '\n' + stackLines.join('\n') };
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
            customMessage,
            '',
            ...messageLines,
          ].join('\n');
          result.message = () => newMessage;
        }
      }
      step.complete({ ...options, error });
      return result;
    };

    const reportStepError = (error: Error) => {
      step.complete({ error: serializeError(error) });
      throw error;
    };

    const refineTitle = (result: SyncExpectationResult & { titleSuffix?: string }): string | undefined => {
      return !customMessage && result.titleSuffix ? defaultTitle + result.titleSuffix : undefined;
    };

    try {
      let result;
      const [receivedOrGenerator, ...otherArgs] = args;
      if (isPoll) {
        if (typeof receivedOrGenerator !== 'function')
          throw new Error('`expect.poll()` accepts only function as a first argument');
        if ((customMatchers as any)[matcherName] || matcherName === 'resolves' || matcherName === 'rejects')
          throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
        result = pollMatcher(matcher, currentExpectTimeout({ timeout: pollTimeout }), this, receivedOrGenerator, ...otherArgs);
      } else {
        if (typeof receivedOrGenerator === 'function')
          throw new Error('Cannot accept function as a first argument; did you mean to use `expect.poll()`?');
        result = matcher.call(this, ...args);
      }
      if (result instanceof Promise)
        return result.then(result => reportStepEnd(result, { refinedTitle: refineTitle(result) })).catch(reportStepError);
      return reportStepEnd(result, { refinedTitle: refineTitle(result) });
    } catch (e) {
      reportStepError(e);
    }
  };
}

const wrappedMatchers: any = {};
for (const matcherName in matchers)
  wrappedMatchers[matcherName] = wrap(matcherName, matchers[matcherName]);
for (const matcherName in customMatchers)
  wrappedMatchers[matcherName] = wrap(matcherName, (customMatchers as any)[matcherName]);

expectLibrary.extend(wrappedMatchers);

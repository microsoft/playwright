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

import { captureRawStack, pollAgainstTimeout } from 'playwright-core/lib/utils';
import type { ExpectZone } from 'playwright-core/lib/utils';
import {
  toBeChecked,
  toBeDisabled,
  toBeEditable,
  toBeEmpty,
  toBeEnabled,
  toBeFocused,
  toBeHidden,
  toBeInViewport,
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
  toHaveValues,
  toPass
} from './matchers';
import { toMatchSnapshot, toHaveScreenshot } from './toMatchSnapshot';
import type { Expect } from '../common/types';
import { currentTestInfo, currentExpectTimeout } from '../common/globals';
import { filteredStackTrace, serializeError, stringifyStackFrames, trimLongString } from '../util';
import {
  expect as expectLibrary,
  INVERTED_COLOR,
  RECEIVED_COLOR,
  printReceived,
} from '../common/expectBundle';
import { zones } from 'playwright-core/lib/utils';

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

type ExpectMessageOrOptions = undefined | string | { message?: string, timeout?: number, intervals?: number[] };

function createExpect(actual: unknown, messageOrOptions: ExpectMessageOrOptions, isSoft: boolean, isPoll: boolean, generator?: Generator) {
  return new Proxy(expectLibrary(actual), new ExpectMetaInfoProxyHandler(messageOrOptions, isSoft, isPoll, generator));
}

export const expect: Expect = new Proxy(expectLibrary, {
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
  toBeInViewport,
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
  toHaveValues,
  toMatchSnapshot,
  toHaveScreenshot,
  toPass,
};

type Generator = () => any;

type ExpectMetaInfo = {
  message?: string;
  isNot: boolean;
  isSoft: boolean;
  isPoll: boolean;
  nameTokens: string[];
  pollTimeout?: number;
  pollIntervals?: number[];
  generator?: Generator;
};

class ExpectMetaInfoProxyHandler {
  private _info: ExpectMetaInfo;

  constructor(messageOrOptions: ExpectMessageOrOptions, isSoft: boolean, isPoll: boolean, generator?: Generator) {
    this._info = { isSoft, isPoll, generator, isNot: false, nameTokens: [] };
    if (typeof messageOrOptions === 'string') {
      this._info.message = messageOrOptions;
    } else {
      this._info.message = messageOrOptions?.message;
      this._info.pollTimeout = messageOrOptions?.timeout;
      this._info.pollIntervals = messageOrOptions?.intervals;
    }
  }

  get(target: any, matcherName: any, receiver: any): any {
    let matcher = Reflect.get(target, matcherName, receiver);
    if (matcher === undefined)
      throw new Error(`expect: Property '${matcherName}' not found.`);
    if (typeof matcher !== 'function') {
      if (matcherName === 'not')
        this._info.isNot = !this._info.isNot;
      return new Proxy(matcher, this);
    }
    if (this._info.isPoll) {
      if ((customMatchers as any)[matcherName] || matcherName === 'resolves' || matcherName === 'rejects')
        throw new Error(`\`expect.poll()\` does not support "${matcherName}" matcher.`);
      matcher = (...args: any[]) => pollMatcher(matcherName, this._info.isNot, this._info.pollIntervals, currentExpectTimeout({ timeout: this._info.pollTimeout }), this._info.generator!, ...args);
    }
    return (...args: any[]) => {
      const testInfo = currentTestInfo();
      if (!testInfo)
        return matcher.call(target, ...args);

      const rawStack = captureRawStack();
      const stackFrames = filteredStackTrace(rawStack);
      const customMessage = this._info.message || '';
      const defaultTitle = `expect${this._info.isPoll ? '.poll' : ''}${this._info.isSoft ? '.soft' : ''}${this._info.isNot ? '.not' : ''}.${matcherName}`;
      const wallTime = Date.now();
      const step = testInfo._addStep({
        location: stackFrames[0],
        category: 'expect',
        title: trimLongString(customMessage || defaultTitle, 1024),
        canHaveChildren: true,
        forceNoParent: false,
        wallTime
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
            customMessage,
            '',
            ...messageLines,
          ].join('\n');
          jestError.message = newMessage;
          jestError.stack = jestError.name + ': ' + newMessage + '\n' + stringifyStackFrames(stackFrames).join('\n');
        }

        const serializerError = serializeError(jestError);
        step.complete({ error: serializerError });
        if (this._info.isSoft)
          testInfo._failWithError(serializerError, false /* isHardError */);
        else
          throw jestError;
      };

      try {
        const expectZone: ExpectZone = { title: defaultTitle, wallTime };
        const result = zones.run<ExpectZone, any>('expectZone', expectZone, () => {
          return matcher.call(target, ...args);
        });
        if (result instanceof Promise)
          return result.then(() => step.complete({})).catch(reportStepError);
        else
          step.complete({});
      } catch (e) {
        reportStepError(e);
      }
    };
  }
}

async function pollMatcher(matcherName: any, isNot: boolean, pollIntervals: number[] | undefined, timeout: number, generator: () => any, ...args: any[]) {
  const result = await pollAgainstTimeout<Error|undefined>(async () => {
    const value = await generator();
    let expectInstance = expectLibrary(value) as any;
    if (isNot)
      expectInstance = expectInstance.not;
    try {
      expectInstance[matcherName].call(expectInstance, ...args);
      return { continuePolling: false, result: undefined };
    } catch (error) {
      return { continuePolling: true, result: error };
    }
  }, timeout, pollIntervals ?? [100, 250, 500, 1000]);

  if (result.timedOut) {
    const timeoutMessage = `Timeout ${timeout}ms exceeded while waiting on the predicate`;
    const message = result.result ? [
      result.result.message,
      '',
      `Call Log:`,
      `- ${timeoutMessage}`,
    ].join('\n') : timeoutMessage;

    throw new Error(message);
  }
}

expectLibrary.extend(customMatchers);
